import { models } from "../models/index.js";

export async function createDialogue(req, res, next) {
  try {
    const { domainId, languageId, title, description, duration, difficulty } = req.body;
    if (!domainId || !languageId || !title) return res.status(400).json({ success: false, message: "Missing fields" });

    const domain = await models.Domain.findByPk(domainId);
    if (!domain) return res.status(400).json({ success: false, message: "Invalid domainId" });

    const lang = await models.Language.findByPk(languageId);
    if (!lang) return res.status(400).json({ success: false, message: "Invalid languageId" });

    const dialogue = await models.Dialogue.create({
      domainId,
      languageId,
      title,
      description: description || null,
      duration: duration ?? null,
      difficulty: difficulty || "easy"
    });

    return res.status(201).json({ success: true, data: { dialogue } });
  } catch (e) {
    return next(e);
  }
}

export async function listDialogues(req, res, next) {
  try {
    const where = {};
    if (req.query.domainId) where.domainId = req.query.domainId;
    if (req.query.languageId) where.languageId = req.query.languageId;

    const dialogues = await models.Dialogue.findAll({
      where,
      include: [{ model: models.Domain }, { model: models.Language }]
    });

    return res.json({ success: true, data: { dialogues } });
  } catch (e) {
    return next(e);
  }
}

export async function getDialogue(req, res, next) {
  try {
    const dialogue = await models.Dialogue.findByPk(req.params.id, {
      include: [{ model: models.Domain }, { model: models.Language }, { model: models.Segment }]
    });

    if (!dialogue) return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, data: { dialogue } });
  } catch (e) {
    return next(e);
  }
}

export async function updateDialogue(req, res, next) {
  try {
    const dialogue = await models.Dialogue.findByPk(req.params.id);
    if (!dialogue) return res.status(404).json({ success: false, message: "Not found" });

    const { domainId, languageId, title, description, duration, difficulty } = req.body;

    if (domainId !== undefined && String(domainId) !== String(dialogue.domainId)) {
      const domain = await models.Domain.findByPk(domainId);
      if (!domain) return res.status(400).json({ success: false, message: "Invalid domainId" });
      dialogue.domainId = domainId;
    }

    if (languageId !== undefined && String(languageId) !== String(dialogue.languageId)) {
      const lang = await models.Language.findByPk(languageId);
      if (!lang) return res.status(400).json({ success: false, message: "Invalid languageId" });
      dialogue.languageId = languageId;
    }

    if (title !== undefined) dialogue.title = title;
    if (description !== undefined) dialogue.description = description || null;
    if (duration !== undefined) dialogue.duration = duration ?? null;
    if (difficulty !== undefined) dialogue.difficulty = difficulty;

    await dialogue.save();
    return res.json({ success: true, data: { dialogue } });
  } catch (e) {
    return next(e);
  }
}

export async function deleteDialogue(req, res, next) {
  try {
    const dialogue = await models.Dialogue.findByPk(req.params.id);
    if (!dialogue) return res.status(404).json({ success: false, message: "Not found" });
    await dialogue.destroy();
    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return next(e);
  }
}
