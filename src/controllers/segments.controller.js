import { models } from "../models/index.js";

export async function createSegment(req, res, next) {
  try {
    const { dialogueId, textContent, audioUrl, suggestedAudioUrl, segmentOrder } = req.body;
    if (!dialogueId || !textContent || !segmentOrder) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const dialogue = await models.Dialogue.findByPk(dialogueId);
    if (!dialogue) return res.status(400).json({ success: false, message: "Invalid dialogueId" });

    const segment = await models.Segment.create({
      dialogueId,
      textContent,
      audioUrl: audioUrl || null,
      suggestedAudioUrl: suggestedAudioUrl || null,
      segmentOrder
    });

    return res.status(201).json({ success: true, data: { segment } });
  } catch (e) {
    return next(e);
  }
}

export async function listSegments(req, res, next) {
  try {
    const where = {};
    if (req.query.dialogueId) where.dialogueId = req.query.dialogueId;

    const segments = await models.Segment.findAll({
      where,
      order: [["segmentOrder", "ASC"]]
    });

    return res.json({ success: true, data: { segments } });
  } catch (e) {
    return next(e);
  }
}

export async function getSegment(req, res, next) {
  try {
    const segment = await models.Segment.findByPk(req.params.id);
    if (!segment) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: { segment } });
  } catch (e) {
    return next(e);
  }
}

export async function updateSegment(req, res, next) {
  try {
    const segment = await models.Segment.findByPk(req.params.id);
    if (!segment) return res.status(404).json({ success: false, message: "Not found" });

    const { textContent, audioUrl, suggestedAudioUrl, segmentOrder } = req.body;

    if (textContent !== undefined) segment.textContent = textContent;
    if (audioUrl !== undefined) segment.audioUrl = audioUrl || null;
    if (suggestedAudioUrl !== undefined) segment.suggestedAudioUrl = suggestedAudioUrl || null;
    if (segmentOrder !== undefined) segment.segmentOrder = segmentOrder;

    await segment.save();
    return res.json({ success: true, data: { segment } });
  } catch (e) {
    return next(e);
  }
}

export async function deleteSegment(req, res, next) {
  try {
    const segment = await models.Segment.findByPk(req.params.id);
    if (!segment) return res.status(404).json({ success: false, message: "Not found" });
    await segment.destroy();
    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return next(e);
  }
}
