import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { startExam, listUserExams, getExam, deleteExam } from "../controllers/exams.controller.js";

const router = Router();

router.post("/", startExam);
router.get("/", requireAuth, listUserExams);
router.get("/:examAttemptId", requireAuth, getExam);
router.post("/:examAttemptId/segments/:segmentId/attempts", requireAuth, deleteExam);



export default router;
