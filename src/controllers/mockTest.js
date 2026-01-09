import path from "node:path";
import { models } from "../models/index.js";
import { uploadAudioToS3 } from "../utils/aws.js";

const { Segment, Dialogue, SegmentAttempt } = models;

const toInt = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const clamp = (num, min, max) => {
  const n = typeof num === "number" ? num : Number(num);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const normalizeScores = (raw) => {
  const accuracy_score = clamp(raw.accuracy_score, 0, 15);
  const language_quality_score = clamp(raw.language_quality_score, 0, 10);
  const fluency_pronunciation_score = clamp(raw.fluency_pronunciation_score, 0, 8);
  const delivery_coherence_score = clamp(raw.delivery_coherence_score, 0, 5);
  const cultural_context_score = clamp(raw.cultural_context_score, 0, 4);
  const response_management_score = clamp(raw.response_management_score, 0, 3);

  const total_raw_score =
    accuracy_score +
    language_quality_score +
    fluency_pronunciation_score +
    delivery_coherence_score +
    cultural_context_score +
    response_management_score;

  const final_score = Math.max(5, total_raw_score);

  return {
    accuracy_score,
    accuracy_feedback: raw.accuracy_feedback ?? "",
    language_quality_score,
    language_quality_feedback: raw.language_quality_feedback ?? "",
    fluency_pronunciation_score,
    fluency_pronunciation_feedback: raw.fluency_pronunciation_feedback ?? "",
    delivery_coherence_score,
    delivery_coherence_feedback: raw.delivery_coherence_feedback ?? "",
    cultural_context_score,
    cultural_context_feedback: raw.cultural_context_feedback ?? "",
    response_management_score,
    response_management_feedback: raw.response_management_feedback ?? "",
    total_raw_score,
    final_score,
    one_line_feedback: raw.one_line_feedback ?? ""
  };
};

const scoreSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "accuracy_score",
    "accuracy_feedback",
    "language_quality_score",
    "language_quality_feedback",
    "fluency_pronunciation_score",
    "fluency_pronunciation_feedback",
    "delivery_coherence_score",
    "delivery_coherence_feedback",
    "cultural_context_score",
    "cultural_context_feedback",
    "response_management_score",
    "response_management_feedback",
    "one_line_feedback"
  ],
  properties: {
    accuracy_score: { type: "number" },
    accuracy_feedback: { type: "string" },
    language_quality_score: { type: "number" },
    language_quality_feedback: { type: "string" },
    fluency_pronunciation_score: { type: "number" },
    fluency_pronunciation_feedback: { type: "string" },
    delivery_coherence_score: { type: "number" },
    delivery_coherence_feedback: { type: "string" },
    cultural_context_score: { type: "number" },
    cultural_context_feedback: { type: "string" },
    response_management_score: { type: "number" },
    response_management_feedback: { type: "string" },
    one_line_feedback: { type: "string" }
  }
};

const extractResponseText = (json) => {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text;
  const out = Array.isArray(json?.output) ? json.output : [];
  for (const item of out) {
    if (item?.type === "message" && Array.isArray(item?.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c?.text === "string" && c.text.trim()) return c.text;
      }
    }
  }
  return "";
};

const guessMimeFromUrl = (url) => {
  let ext = "";
  try {
    ext = path.extname(new URL(url).pathname).toLowerCase();
  } catch {
    ext = path.extname(String(url)).toLowerCase();
  }
  const map = {
    ".mp3": "audio/mpeg",
    ".mpeg": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/x-m4a",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".flac": "audio/flac"
  };
  return map[ext] || "audio/webm";
};

const fetchAudio = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio: ${url}`);
  const ab = await res.arrayBuffer();
  const contentType = res.headers.get("content-type");
  const mimetype = contentType ? contentType.split(";")[0].trim() : guessMimeFromUrl(url);
  return { buffer: Buffer.from(ab), mimetype };
};

const transcribeWithOpenAI = async ({ buffer, mimetype, language }) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
  const form = new FormData();
  const filename = `audio${mimetype === "audio/wav" ? ".wav" : mimetype === "audio/mpeg" ? ".mp3" : ".webm"}`;
  form.append("file", new Blob([buffer], { type: mimetype }), filename);
  form.append("model", model);
  if (language) form.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription error: ${text}`);
  }

  const json = await res.json();
  return json?.text ? String(json.text) : "";
};

const scoreWithOpenAI = async ({ combinedTranscript, language, referenceText }) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");

  const model = process.env.OPENAI_SCORE_MODEL || "gpt-4o-mini";

  const prompt = `
You are an expert NAATI speaking examiner.

This is a repetition practice:
- REFERENCE: what the audio said
- SUGGESTED: an ideal version (if present)
- STUDENT: what the student said

Language (optional): ${language || "unspecified"}.

REFERENCE SCRIPT (optional):
${referenceText || "Not provided. Use ASR transcripts as reference."}

FULL TRANSCRIPT:
${combinedTranscript}

Score with:
1) Accuracy & Meaning Transfer (0–15)
2) Language Quality (0–10)
3) Fluency & Pronunciation (0–8)
4) Delivery & Coherence (0–5)
5) Cultural & Contextual Appropriateness (0–4)
6) Response Management (0–3)

Return only JSON that matches the schema.
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "You are an expert NAATI speaking examiner." },
        { role: "user", content: prompt }
      ],
      temperature: 0.25,
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          strict: true,
          schema: scoreSchema
        }
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Scoring error: ${text}`);
  }

  const json = await res.json();
  const text = extractResponseText(json);
  const parsed = JSON.parse(text);
  return normalizeScores(parsed);
};

export const runAiExam = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ success: false, message: "userAudio file is required" });

    const segmentId = toInt(req.body.segmentId);
    const dialogueId = toInt(req.body.dialogueId);
    const language = req.body.language ? String(req.body.language) : null;
    const audioTranscript = req.body.audioTranscript ? String(req.body.audioTranscript) : null;

    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!segmentId) return res.status(400).json({ success: false, message: "segmentId is required" });

    const segment = await Segment.findByPk(segmentId);
    if (!segment) return res.status(404).json({ success: false, message: "Segment not found" });

    if (dialogueId && segment.dialogueId !== dialogueId) {
      return res.status(400).json({ success: false, message: "segmentId does not belong to dialogueId" });
    }

    const effectiveDialogueId = dialogueId || segment.dialogueId;

    const dialogue = await Dialogue.findByPk(effectiveDialogueId);
    if (!dialogue) return res.status(404).json({ success: false, message: "Dialogue not found" });

    const referenceAudioUrl = req.body.audioUrl ? String(req.body.audioUrl) : segment.audioUrl || null;
    const suggestedAudioUrl = req.body.suggestedAudioUrl ? String(req.body.suggestedAudioUrl) : segment.suggestedAudioUrl || null;

    if (!referenceAudioUrl && !suggestedAudioUrl) {
      return res.status(400).json({ success: false, message: "No reference audio found (audioUrl/suggestedAudioUrl missing)" });
    }

    const uploaded = await uploadAudioToS3({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      keyPrefix: `users/${authUserId}/ai-exam/dialogues/${effectiveDialogueId}/segments/${segmentId}`
    });

    const userAudioUrl = uploaded.url;

    const refAudio = referenceAudioUrl ? await fetchAudio(referenceAudioUrl) : null;
    const sugAudio = suggestedAudioUrl ? await fetchAudio(suggestedAudioUrl) : null;
    const userAudio = { buffer: file.buffer, mimetype: file.mimetype };

    const referenceTranscript = refAudio ? await transcribeWithOpenAI({ buffer: refAudio.buffer, mimetype: refAudio.mimetype, language }) : "";
    const suggestedTranscript = sugAudio ? await transcribeWithOpenAI({ buffer: sugAudio.buffer, mimetype: sugAudio.mimetype, language }) : "";
    const studentTranscript = audioTranscript || (await transcribeWithOpenAI({ buffer: userAudio.buffer, mimetype: userAudio.mimetype, language }));

    const combinedTranscript =
      `SEGMENT:\n` +
      `REFERENCE: ${referenceTranscript || "(empty)"}\n` +
      `SUGGESTED: ${suggestedTranscript || "(empty)"}\n` +
      `STUDENT: ${studentTranscript || "(empty)"}`;

    const scores = await scoreWithOpenAI({
      combinedTranscript,
      language,
      referenceText: segment.textContent || null
    });

    let segmentAttempt = null;

    if (SegmentAttempt) {
      const hasExamAttemptId = Boolean(SegmentAttempt?.rawAttributes?.examAttemptId);
      const examAttemptId = toInt(req.body.examAttemptId);
      const whereForCount = { userId: authUserId, segmentId };
      if (hasExamAttemptId && examAttemptId) whereForCount.examAttemptId = examAttemptId;

      const prevMax = await SegmentAttempt.max("repeatCount", { where: whereForCount });
      const repeatCount = Number(prevMax || 0) + 1;

      const data = {
        userId: authUserId,
        segmentId,
        audioUrl: userAudioUrl,
        userTranscription: studentTranscript,
        aiScores: scores,
        accuracyScore: scores.accuracy_score,
        overallScore: scores.final_score,
        feedback: scores.one_line_feedback,
        languageQualityScore: scores.language_quality_score,
        languageQualityText: scores.language_quality_feedback,
        fluencyPronunciationScore: scores.fluency_pronunciation_score,
        fluencyPronunciationText: scores.fluency_pronunciation_feedback,
        deliveryCoherenceScore: scores.delivery_coherence_score,
        deliveryCoherenceText: scores.delivery_coherence_feedback,
        culturalControlScore: scores.cultural_context_score,
        culturalControlText: scores.cultural_context_feedback,
        responseManagementScore: scores.response_management_score,
        responseManagementText: scores.response_management_feedback,
        totalRawScore: scores.total_raw_score,
        finalScore: scores.final_score,
        oneLineFeedback: scores.one_line_feedback,
        language: language,
        repeatCount
      };

      if (hasExamAttemptId) data.examAttemptId = examAttemptId || null;

      segmentAttempt = await SegmentAttempt.create(data);
    }

    return res.json({
      success: true,
      data: {
        userAudioUrl,
        referenceAudioUrl,
        suggestedAudioUrl,
        transcripts: {
          referenceTranscript,
          suggestedTranscript,
          studentTranscript,
          combinedTranscript
        },
        scores,
        segmentAttempt
      }
    });
  } catch (e) {
    return next(e);
  }
};
