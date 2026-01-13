import { models } from "../models/index.js";
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      userId: req.body.userId,
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
    console.error(e);
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

const toNumberOrNull = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const avgOfField = (segments, field) => {
  let sum = 0;
  let count = 0;

  for (const seg of segments) {
    const s = typeof seg.get === "function" ? seg.get() : seg;
    const val = toNumberOrNull(s[field]);
    if (val !== null) {
      sum += val;
      count++;
    }
  }

  return count ? Number((sum / count).toFixed(2)) : null;
};

const buildFeedbackNotes = (segments) => {
  return segments
    .map((seg, i) => {
      const s = typeof seg.get === "function" ? seg.get() : seg;

      const texts = [
        s.accuracyText && `Accuracy: ${s.accuracyText}`,
        s.languageQualityText && `Language: ${s.languageQualityText}`,
        s.fluencyPronunciationText && `Fluency: ${s.fluencyPronunciationText}`,
        s.deliveryCoherenceText && `Delivery: ${s.deliveryCoherenceText}`,
        s.culturalControlText && `Culture: ${s.culturalControlText}`,
        s.responseManagementText &&
          `Response mgmt: ${s.responseManagementText}`,
        s.oneLineFeedback && `One-line: ${s.oneLineFeedback}`,
      ].filter(Boolean);

      return texts.length ? `Segment ${i + 1}: ${texts.join(" | ")}` : null;
    })
    .filter(Boolean)
    .join("\n");
};

export const computeResult = async (req, res, next) => {
  try {
    const examAttemptId = toInt(req.params.examAttemptId);

    const segments = await SegmentAttempt.findAll({
      where: { exam_attempt_id: examAttemptId },
      order: [["createdAt", "ASC"]],
    });

    const averages = {
      accuracyScore: avgOfField(segments, "accuracyScore"),
      languageQualityScore: avgOfField(segments, "languageQualityScore"),
      fluencyPronunciationScore: avgOfField(
        segments,
        "fluencyPronunciationScore"
      ),
      deliveryCoherenceScore: avgOfField(segments, "deliveryCoherenceScore"),
      culturalControlScore: avgOfField(segments, "culturalControlScore"),
      responseManagementScore: avgOfField(segments, "responseManagementScore"),
      finalScore: avgOfField(segments, "finalScore"),
      totalRawScore: avgOfField(segments, "totalRawScore"),
    };

    if (!segments.length) {
      return res.json({
        segments,
        summary: { segmentCount: 0, averages, overallFeedback: null },
      });
    }

    let notes = buildFeedbackNotes(segments);

    const MAX_CHARS = 12000;
    if (notes.length > MAX_CHARS)
      notes = notes.slice(0, MAX_CHARS) + "\n...(truncated)";

    const prompt = [
      `Averages (0–?? scale depending on your rubric): ${JSON.stringify(
        averages
      )}`,
      `Per-segment feedback notes:`,
      notes,
    ].join("\n\n");

    const ai = await openai.responses.create({
      model: "gpt-5.2",
      instructions:
        "You are an English speaking exam evaluator. Read the per-segment feedback notes and averages, then write overall feedback in 5 to 7 short lines. Mention patterns across segments, 2 strengths, 2 improvement areas, and 1 specific actionable next step. Do not repeat the notes verbatim. No headings.",
      input: prompt,
    });

    const overallFeedback = (ai.output_text || "").trim();

    return res.json({
      summary: {
        segmentCount: segments.length,
        averages,
        overallFeedback,
      },
      segments
    });
  } catch (e) {
    next(e);
  }
};
