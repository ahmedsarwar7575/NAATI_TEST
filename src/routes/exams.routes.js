import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { startExam, listUserExams, getExam, deleteExam, computeResult } from "../controllers/exams.controller.js";

const router = Router();

router.post("/", startExam);
router.get("/", requireAuth, listUserExams);
router.get("/:examAttemptId", requireAuth, getExam);
router.get("/computeResult/:examAttemptId", computeResult);
router.post("/:examAttemptId/segments/:segmentId/attempts", requireAuth, deleteExam);



export default router;
