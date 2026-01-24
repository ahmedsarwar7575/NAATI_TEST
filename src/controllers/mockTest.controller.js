import { Op } from "sequelize";
import MockTest from "../models/mocketTest.model.js";
import { Dialogue } from "../models/dialogue.model.js";

const toInt = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toNum = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj?.[k] !== undefined) return obj[k];
  }
  return undefined;
};

export const createMockTest = async (req, res, next) => {
  try {
    const title = pick(req.body, "title");
    const languageRaw = pick(req.body, "language_id", "languageId");
    const d1Raw = pick(req.body, "dialogue_id", "dialogueId");
    const d2Raw = pick(req.body, "dialogue_id_2", "dialogueId2");

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "title is required" });
    }

    const languageId = toInt(languageRaw);
    if (!languageId) {
      return res.status(400).json({ message: "language_id is required" });
    }

    const dialogueId = toInt(d1Raw);
    const dialogueId2 = toInt(d2Raw);

    if (!dialogueId || !dialogueId2) {
      return res.status(400).json({
        message:
          "dialogue_id and dialogue_id_2 are required (MockTest needs 2 dialogues)",
      });
    }

    if (String(dialogueId) === String(dialogueId2)) {
      return res
        .status(400)
        .json({ message: "dialogue_id and dialogue_id_2 must be different" });
    }

    // Ensure both dialogues exist
    const dialogues = await Dialogue.findAll({
      where: { id: { [Op.in]: [dialogueId, dialogueId2] } },
    });

    if (!dialogues || dialogues.length !== 2) {
      return res
        .status(404)
        .json({ message: "One or both dialogues not found" });
    }

    // ✅ Use MODEL ATTRIBUTE NAMES (camelCase), not DB column names
    const mockTest = await MockTest.create({
      title: title.trim(),
      languageId,
      dialogueId,
      dialogueId2,
      durationSeconds: 1200,
      totalMarks: 90,
      passMarks: 62,
    });

    const created = await MockTest.findByPk(mockTest.id, {
      include: [
        { model: Dialogue, as: "dialogue1" },
        { model: Dialogue, as: "dialogue2" },
      ],
    });

    return res.status(201).json({ data: created });
  } catch (err) {
    return next(err);
  }
};

export const getMockTests = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10", 10), 1),
      100,
    );
    const offset = (page - 1) * limit;

    const where = {};

    const languageId = toInt(pick(req.query, "language_id", "languageId"));
    if (languageId) where.languageId = languageId;

    const dialogueFilter = toInt(pick(req.query, "dialogue_id", "dialogueId"));
    if (dialogueFilter) {
      where[Op.or] = [
        { dialogueId: dialogueFilter },
        { dialogueId2: dialogueFilter },
      ];
    }

    const { rows, count } = await MockTest.findAndCountAll({
      where,
      include: [
        { model: Dialogue, as: "dialogue1" },
        { model: Dialogue, as: "dialogue2" },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const getMockTestById = async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const mockTest = await MockTest.findByPk(id, {
      include: [
        { model: Dialogue, as: "dialogue1" },
        { model: Dialogue, as: "dialogue2" },
      ],
    });

    if (!mockTest)
      return res.status(404).json({ message: "MockTest not found" });

    return res.json({ data: mockTest });
  } catch (err) {
    return next(err);
  }
};

export const updateMockTest = async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const mockTest = await MockTest.findByPk(id);
    if (!mockTest)
      return res.status(404).json({ message: "MockTest not found" });

    const title = pick(req.body, "title");
    const languageRaw = pick(req.body, "language_id", "languageId");
    const d1Raw = pick(req.body, "dialogue_id", "dialogueId");
    const d2Raw = pick(req.body, "dialogue_id_2", "dialogueId2");
    const durationRaw = pick(req.body, "duration_seconds", "durationSeconds");
    const totalMarksRaw = pick(req.body, "total_marks", "totalMarks");
    const passMarksRaw = pick(req.body, "pass_marks", "passMarks");

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res
          .status(400)
          .json({ message: "title must be a non-empty string" });
      }
      mockTest.title = title.trim();
    }

    if (languageRaw !== undefined) {
      const languageId = toInt(languageRaw);
      if (!languageId)
        return res.status(400).json({ message: "Invalid language_id" });
      mockTest.languageId = languageId;
    }

    if (d1Raw !== undefined) {
      const dialogueId = toInt(d1Raw);
      if (!dialogueId)
        return res.status(400).json({ message: "Invalid dialogue_id" });
      mockTest.dialogueId = dialogueId;
    }

    if (d2Raw !== undefined) {
      const dialogueId2 = toInt(d2Raw);
      if (!dialogueId2)
        return res.status(400).json({ message: "Invalid dialogue_id_2" });
      mockTest.dialogueId2 = dialogueId2;
    }

    // if both set, ensure not same
    if (
      mockTest.dialogueId !== undefined &&
      mockTest.dialogueId2 !== undefined &&
      String(mockTest.dialogueId) === String(mockTest.dialogueId2)
    ) {
      return res.status(400).json({
        message: "dialogue_id and dialogue_id_2 must be different",
      });
    }

    if (durationRaw !== undefined) {
      const durationSeconds = toNum(durationRaw);
      if (durationSeconds === undefined || durationSeconds < 0) {
        return res
          .status(400)
          .json({ message: "duration_seconds must be a non-negative number" });
      }
      mockTest.durationSeconds = durationSeconds;
    }

    if (totalMarksRaw !== undefined) {
      const totalMarks = toInt(totalMarksRaw);
      if (!totalMarks || totalMarks < 0) {
        return res
          .status(400)
          .json({ message: "total_marks must be a non-negative integer" });
      }
      mockTest.totalMarks = totalMarks;
    }

    if (passMarksRaw !== undefined) {
      const passMarks = toInt(passMarksRaw);
      if (!passMarks || passMarks < 0) {
        return res
          .status(400)
          .json({ message: "pass_marks must be a non-negative integer" });
      }
      mockTest.passMarks = passMarks;
    }

    await mockTest.save();

    const updated = await MockTest.findByPk(mockTest.id, {
      include: [
        { model: Dialogue, as: "dialogue1" },
        { model: Dialogue, as: "dialogue2" },
      ],
    });

    return res.json({ data: updated });
  } catch (err) {
    return next(err);
  }
};

export const deleteMockTest = async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const mockTest = await MockTest.findByPk(id);
    if (!mockTest)
      return res.status(404).json({ message: "MockTest not found" });

    await mockTest.destroy();
    return res.json({ message: "MockTest deleted successfully" });
  } catch (err) {
    return next(err);
  }
};
