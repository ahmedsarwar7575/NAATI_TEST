import { Op } from "sequelize";
import { User } from "../models/user.model.js";
import MockTestSession from "../models/mockTestSession.model.js";
import MockTestResult from "../models/mockTestResult.js";

const toInt = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const avg = (arr) => {
  const vals = (arr || []).map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  const s = vals.reduce((a, b) => a + b, 0);
  return Number((s / vals.length).toFixed(2));
};

const daysBetweenDateOnly = (fromDate, toDate) => {
  const a = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const b = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
  const diff = b.getTime() - a.getTime();
  return Math.floor(diff / 86400000);
};

const dateOnlyToUTCDate = (dateOnly) => {
  if (!dateOnly) return null;
  const s = String(dateOnly);
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const getUserDashboardKpis = async (req, res, next) => {
  try {
    const userId = toInt(req.params.userId ?? req.query.userId);
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "phone", "preferredLanguage", "naatiCclExamDate", "createdAt"],
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const now = new Date();
    const startTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const startTomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const startLast7DaysUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0));

    const totalTests = await MockTestSession.count({ where: { userId } });
    const completedTests = await MockTestSession.count({ where: { userId, status: "completed" } });
    const pendingTests = await MockTestSession.count({
      where: { userId, status: { [Op.ne]: "completed" } },
    });

    const completedToday = await MockTestSession.findAll({
      where: {
        userId,
        status: "completed",
        completedAt: { [Op.gte]: startTodayUTC, [Op.lt]: startTomorrowUTC },
      },
      attributes: ["totalScore"],
      order: [["completedAt", "DESC"]],
    });

    const completedLast7Days = await MockTestSession.findAll({
      where: {
        userId,
        status: "completed",
        completedAt: { [Op.gte]: startLast7DaysUTC, [Op.lte]: now },
      },
      attributes: ["totalScore", "completedAt"],
      order: [["completedAt", "DESC"]],
    });

    const avgScoreToday = avg(completedToday.map((s) => s.totalScore));
    const avgScoreLast7Days = avg(completedLast7Days.map((s) => s.totalScore));

    const lastCompletedSession = await MockTestSession.findOne({
      where: { userId, status: "completed" },
      order: [["completedAt", "DESC"]],
      attributes: ["id", "totalScore", "completedAt", "mockTestId"],
    });

    const activeSession = await MockTestSession.findOne({
      where: { userId, status: "in_progress" },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "createdAt", "mockTestId", "status"],
    });

    let activeSessionSegments = null;

    if (activeSession?.id) {
      const completedSegments = await MockTestResult.count({
        where: { userId, mockTestSessionId: activeSession.id, status: "completed" },
      });

      const pendingSegments = await MockTestResult.count({
        where: { userId, mockTestSessionId: activeSession.id, status: { [Op.ne]: "completed" } },
      });

      const totalSegments = completedSegments + pendingSegments;

      activeSessionSegments = {
        mockTestSessionId: activeSession.id,
        totalSegments,
        completedSegments,
        pendingSegments,
      };
    }

    const examDateUTC = dateOnlyToUTCDate(user.naatiCclExamDate);
    let daysLeftUntilExam = null;

    if (examDateUTC) {
      const diff = daysBetweenDateOnly(now, examDateUTC);
      daysLeftUntilExam = diff < 0 ? null : diff;
    }

    const daysSinceSignup = user.createdAt ? Math.max(0, daysBetweenDateOnly(user.createdAt, now)) : null;

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          preferredLanguage: user.preferredLanguage,
          naatiCclExamDate: user.naatiCclExamDate,
        },
        kpis: {
          tests: {
            total: totalTests,
            pending: pendingTests,
            completed: completedTests,
          },
          scores: {
            avgToday: avgScoreToday,
            avgLast7Days: avgScoreLast7Days,
            completedTodayCount: completedToday.length,
            completedLast7DaysCount: completedLast7Days.length,
            lastCompleted: lastCompletedSession
              ? {
                  mockTestSessionId: lastCompletedSession.id,
                  mockTestId: lastCompletedSession.mockTestId,
                  totalScore: lastCompletedSession.totalScore,
                  completedAt: lastCompletedSession.completedAt,
                }
              : null,
          },
          activeSession: activeSession
            ? {
                mockTestSessionId: activeSession.id,
                mockTestId: activeSession.mockTestId,
                status: activeSession.status,
                startedAt: activeSession.createdAt,
              }
            : null,
          activeSessionSegments,
          dates: {
            daysLeftUntilExam,
            daysSinceSignup,
          },
        },
      },
    });
  } catch (e) {
    next(e);
  }
};
