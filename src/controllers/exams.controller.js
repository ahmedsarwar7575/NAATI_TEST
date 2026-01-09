import { models } from "../models/index.js";

const { ExamAttempt, Dialogue, Segment, SegmentAttempt } = models;

const ensureOwnerOrAdmin = (req, ownerId) => {
  if (req.user?.role === "admin") return;
  if (!req.user?.id || req.user.id !== ownerId) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
};

const toInt = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const createExam = async (req, res, next) => {
  try {
    return res.status(501).json({ message: "Not implemented" });
  } catch (e) {
    next(e);
  }
};

export const startExam = async (req, res, next) => {
  try {
    const { examType, dialogueId } = req.body;

    if (
      !examType ||
      !["rapid_review", "complete_dialogue"].includes(examType)
    ) {
      return res.status(400).json({ message: "Invalid examType" });
    }

    const dialogueIdNum = toInt(dialogueId);
    if (!dialogueIdNum)
      return res.status(400).json({ message: "dialogueId is required" });

    const dialogue = await Dialogue.findByPk(dialogueIdNum);
    if (!dialogue)
      return res.status(404).json({ message: "Dialogue not found" });

    const attempt = await ExamAttempt.create({
      userId: req.user.id,
      dialogueId: dialogueIdNum,
      examType,
      status: "in_progress",
    });

    const segments = await Segment.findAll({
      where: { dialogueId: dialogueIdNum },
      order: [["segmentOrder", "ASC"]],
    });

    return res.status(201).json({ attempt, dialogue, segments });
  } catch (e) {
    next(e);
  }
};

export const listUserExams = async (req, res, next) => {
  try {
    const where = {};

    if (req.user?.role === "admin") {
      const userIdNum = toInt(req.query.userId);
      if (userIdNum) where.userId = userIdNum;
    } else {
      where.userId = req.user.id;
    }

    const dialogueIdNum = toInt(req.query.dialogueId);
    if (dialogueIdNum) where.dialogueId = dialogueIdNum;

    if (req.query.status) where.status = req.query.status;

    const attempts = await ExamAttempt.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    return res.json({ attempts });
  } catch (e) {
    next(e);
  }
};

export const getExam = async (req, res, next) => {
  try {
    const examAttemptId = toInt(req.params.id);
    if (!examAttemptId)
      return res.status(400).json({ message: "Invalid exam id" });

    const attempt = await ExamAttempt.findByPk(examAttemptId);
    if (!attempt) return res.status(404).json({ message: "Exam not found" });

    ensureOwnerOrAdmin(req, attempt.userId);

    const dialogue = await Dialogue.findByPk(attempt.dialogueId);
    const segments = await Segment.findAll({
      where: { dialogueId: attempt.dialogueId },
      order: [["segmentOrder", "ASC"]],
    });

    const segmentAttempts = await SegmentAttempt.findAll({
      where: { examAttemptId: attempt.id },
      order: [["createdAt", "ASC"]],
    });

    return res.json({ attempt, dialogue, segments, segmentAttempts });
  } catch (e) {
    next(e);
  }
};

export const deleteExam = async (req, res, next) => {
  try {
    const examAttemptId = toInt(req.params.id);
    if (!examAttemptId)
      return res.status(400).json({ message: "Invalid exam id" });

    const attempt = await ExamAttempt.findByPk(examAttemptId);
    if (!attempt) return res.status(404).json({ message: "Exam not found" });

    ensureOwnerOrAdmin(req, attempt.userId);

    const sequelize = ExamAttempt.sequelize;

    await sequelize.transaction(async (t) => {
      await SegmentAttempt.destroy({
        where: { examAttemptId },
        transaction: t,
      });
      await attempt.destroy({ transaction: t });
    });

    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    next(e);
  }
};
