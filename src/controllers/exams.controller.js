import {models} from "../models/index.js";

const { ExamAttempt, Dialogue, Segment, SegmentAttempt } = models;

const ensureOwnerOrAdmin = (req, ownerId) => {
  if (req.user?.role === "admin") return;
  if (!req.user?.id || req.user.id !== ownerId) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
};

export const startExam = async (req, res, next) => {
  try {
    const { examType, dialogueId } = req.body;
    if (!examType || !["rapid_review", "complete_dialogue"].includes(examType)) {
      return res.status(400).json({ message: "Invalid examType" });
    }
    if (!dialogueId) return res.status(400).json({ message: "dialogueId is required" });

    const dialogue = await Dialogue.findByPk(dialogueId);
    if (!dialogue) return res.status(404).json({ message: "Dialogue not found" });

    const attempt = await ExamAttempt.create({
      userId: req.user.id,
      dialogueId,
      examType,
      status: "in_progress"
    });

    res.status(201).json({ attempt });
  } catch (e) {
    next(e);
  }
};

export const listMyExams = async (req, res, next) => {
  try {
    const where = req.user?.role === "admin" && req.query.userId ? { userId: req.query.userId } : { userId: req.user.id };
    const attempts = await ExamAttempt.findAll({
      where,
      order: [["createdAt", "DESC"]]
    });
    res.json({ attempts });
  } catch (e) {
    next(e);
  }
};

export const getExamDetail = async (req, res, next) => {
  try {
    const { examAttemptId } = req.params;

    const attempt = await ExamAttempt.findByPk(examAttemptId);
    if (!attempt) return res.status(404).json({ message: "Exam attempt not found" });

    ensureOwnerOrAdmin(req, attempt.userId);

    const dialogue = await Dialogue.findByPk(attempt.dialogueId, {
      include: [{ model: Segment, as: "Segments" }],
    });

    const segments = await Segment.findAll({
      where: { dialogueId: attempt.dialogueId },
      order: [["segmentOrder", "ASC"]]
    });

    const segmentAttempts = await SegmentAttempt.findAll({
      where: { examAttemptId: attempt.id },
      order: [["createdAt", "ASC"]]
    });

    res.json({ attempt, dialogue, segments, segmentAttempts });
  } catch (e) {
    next(e);
  }
};

export const upsertSegmentAttempt = async (req, res, next) => {
  try {
    const { examAttemptId, segmentId } = req.params;
    const payload = req.body || {};

    const attempt = await ExamAttempt.findByPk(examAttemptId);
    if (!attempt) return res.status(404).json({ message: "Exam attempt not found" });

    ensureOwnerOrAdmin(req, attempt.userId);

    const segment = await Segment.findByPk(segmentId);
    if (!segment) return res.status(404).json({ message: "Segment not found" });
    if (segment.dialogueId !== attempt.dialogueId) return res.status(400).json({ message: "Segment not in this dialogue" });

    const repeatCount = payload.repeatCount ? Number(payload.repeatCount) : 1;

    const existing = await SegmentAttempt.findOne({
      where: { examAttemptId, segmentId, repeatCount }
    });

    const data = {
      examAttemptId,
      userId: attempt.userId,
      segmentId,
      audioUrl: payload.audioUrl ?? null,
      userTranscription: payload.userTranscription ?? null,
      aiScores: payload.aiScores ?? null,
      accuracyScore: payload.accuracyScore ?? null,
      overallScore: payload.overallScore ?? null,
      feedback: payload.feedback ?? null,
      languageQualityScore: payload.languageQualityScore ?? null,
      languageQualityText: payload.languageQualityText ?? null,
      fluencyPronunciationScore: payload.fluencyPronunciationScore ?? null,
      fluencyPronunciationText: payload.fluencyPronunciationText ?? null,
      deliveryCoherenceScore: payload.deliveryCoherenceScore ?? null,
      deliveryCoherenceText: payload.deliveryCoherenceText ?? null,
      culturalControlScore: payload.culturalControlScore ?? null,
      culturalControlText: payload.culturalControlText ?? null,
      responseManagementScore: payload.responseManagementScore ?? null,
      responseManagementText: payload.responseManagementText ?? null,
      totalRawScore: payload.totalRawScore ?? null,
      finalScore: payload.finalScore ?? null,
      oneLineFeedback: payload.oneLineFeedback ?? null,
      language: payload.language ?? null,
      repeatCount
    };

    let result;
    if (existing) {
      await existing.update(data);
      result = existing;
    } else {
      result = await SegmentAttempt.create(data);
    }

    res.status(201).json({ segmentAttempt: result });
  } catch (e) {
    next(e);
  }
};
