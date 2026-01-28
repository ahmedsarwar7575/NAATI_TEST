import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import { models } from "../models/index.js";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import MockTestSession from "../models/mockTestSession.model.js";
import MockTestAttempts from "../models/mockTestAttempt.js";
import { Segment } from "../models/segment.model.js";

const toInt = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const daysLeft = (end) => {
  if (!end) return null;
  const now = new Date();
  const diff = new Date(end).getTime() - now.getTime();
  if (!Number.isFinite(diff)) return null;
  const d = Math.ceil(diff / 86400000);
  return d < 0 ? null : d;
};

const getActiveSubscriptions = async (userId) => {
  const now = new Date();

  const subs = await Subscription.findAll({
    where: {
      userId,
      status: { [Op.in]: ["active", "trialing", "past_due"] },
      [Op.or]: [
        { currentPeriodEnd: { [Op.is]: null } },
        { currentPeriodEnd: { [Op.gte]: now } },
      ],
    },
    attributes: [
      "id",
      "languageId",
      "status",
      "currentPeriodEnd",
      "cancelAtPeriodEnd",
      "stripeSubscriptionId",
      "stripePriceId",
    ],
    order: [["currentPeriodEnd", "DESC"]],
  });

  return subs.map((s) => ({
    id: s.id,
    languageId: s.languageId ?? null,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd ?? null,
    daysLeft: daysLeft(s.currentPeriodEnd),
    cancelAtPeriodEnd: !!s.cancelAtPeriodEnd,
    stripeSubscriptionId: s.stripeSubscriptionId,
    stripePriceId: s.stripePriceId ?? null,
  }));
};

const countCompletedMockTests = async (userId) => {
  return MockTestSession.count({
    where: { userId, status: "completed" },
  });
};

const countCompletedDialogues = async (userId) => {
  const attempts = await MockTestAttempts.findAll({
    where: {
      userId,
      mockTestSessionId: { [Op.is]: null },
      dialogueId: { [Op.ne]: null },
      segmentId: { [Op.ne]: null },
    },
    attributes: ["dialogueId", "segmentId"],
    raw: true,
  });

  if (!attempts.length) return { completedDialogues: 0, attemptedDialogues: 0 };

  const dialogueToSegs = new Map();
  for (const a of attempts) {
    const dId = Number(a.dialogueId);
    const sId = Number(a.segmentId);
    if (!Number.isFinite(dId) || !Number.isFinite(sId)) continue;
    const key = String(dId);
    if (!dialogueToSegs.has(key)) dialogueToSegs.set(key, new Set());
    dialogueToSegs.get(key).add(String(sId));
  }

  const dialogueIds = Array.from(dialogueToSegs.keys())
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  if (!dialogueIds.length)
    return { completedDialogues: 0, attemptedDialogues: 0 };

  const segCounts = await Segment.findAll({
    where: { dialogueId: { [Op.in]: dialogueIds } },
    attributes: [
      "dialogueId",
      [sequelize.fn("COUNT", sequelize.col("id")), "segmentCount"],
    ],
    group: ["dialogueId"],
    raw: true,
  });

  const totalSegMap = new Map(
    segCounts.map((r) => [String(r.dialogueId), Number(r.segmentCount)])
  );

  let completed = 0;
  for (const [dKey, segSet] of dialogueToSegs.entries()) {
    const total = totalSegMap.get(dKey) || 0;
    if (total > 0 && segSet.size >= total) completed += 1;
  }

  return {
    completedDialogues: completed,
    attemptedDialogues: dialogueToSegs.size,
  };
};

const findRapidReviewModel = () => {
  const names = [
    "RapidReviewAttempt",
    "RapidReviewAttempts",
    "RapidReviewSession",
    "RapidReviewSessions",
    "RapidReview",
    "RapidReviewResult",
    "RapidReviewProgress",
  ];
  for (const n of names) {
    if (models?.[n]) return models[n];
  }
  return null;
};

const countRapidReviews = async (userId) => {
  const Model = findRapidReviewModel();
  if (!Model) return { used: 0, sourceModel: null };

  const attrs = Model.rawAttributes || {};
  const where = { userId };

  if (attrs.status) where.status = "completed";
  else if (attrs.isCompleted) where.isCompleted = true;
  else if (attrs.completedAt) where.completedAt = { [Op.ne]: null };

  const used = await Model.count({ where });
  return { used, sourceModel: Model?.name || null };
};

export const getUserStatus = async (req, res, next) => {
  try {
    const userId = toInt(
      req.query.userId ?? req.params.userId ?? req.body?.userId
    );
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });

    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "preferredLanguage",
        "naatiCclExamDate",
        "createdAt",
      ],
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const activeSubscriptions = await getActiveSubscriptions(userId);

    if (activeSubscriptions.length) {
      const languageIds = Array.from(
        new Set(
          activeSubscriptions
            .map((s) => Number(s.languageId))
            .filter((x) => Number.isFinite(x))
        )
      );

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            preferredLanguage: user.preferredLanguage,
            naatiCclExamDate: user.naatiCclExamDate,
            createdAt: user.createdAt,
          },
          activeSubscriptionsCount: activeSubscriptions.length,
          subscribedLanguageIds: languageIds,
          subscriptions: activeSubscriptions,
          isTrial: null,
          trial: null,
        },
      });
    }

    const mockTestsUsed = await countCompletedMockTests(userId);
    const { completedDialogues, attemptedDialogues } =
      await countCompletedDialogues(userId);
    const rapid = await countRapidReviews(userId);

    const limits = {
      mockTest: 1,
      rapidReview: 5,
      dialogue: 1,
    };

    const used = {
      mockTest: mockTestsUsed,
      rapidReview: rapid.used,
      dialogue: completedDialogues,
      attemptedDialogues,
    };

    const remaining = {
      mockTest: Math.max(0, limits.mockTest - used.mockTest),
      rapidReview: Math.max(0, limits.rapidReview - used.rapidReview),
      dialogue: Math.max(0, limits.dialogue - used.dialogue),
    };

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          preferredLanguage: user.preferredLanguage,
          naatiCclExamDate: user.naatiCclExamDate,
          createdAt: user.createdAt,
        },
        activeSubscriptionsCount: 0,
        subscribedLanguageIds: [],
        subscriptions: [],
        isTrial: true,
        trial: {
          limits,
          used,
          remaining,
          canUse: {
            mockTest: remaining.mockTest > 0,
            rapidReview: remaining.rapidReview > 0,
            dialogue: remaining.dialogue > 0,
          },
          rapidReviewSourceModel: rapid.sourceModel,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};
