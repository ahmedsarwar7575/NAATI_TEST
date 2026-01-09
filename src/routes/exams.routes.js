import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
// import { startExam, listMyExams, upsertSegmentAttempt } from "../controllers/exams.controller.js";
import {
  createExamImage,
  listExamImages,
  getExamImage,
  updateExamImage,
  deleteExamImage,
} from "../controllers/examImages.controller.js";

const router = Router();

// router.post("/", requireAuth, startExam);
// router.get("/", requireAuth, listMyExams);
// router.get("/:examAttemptId", requireAuth, getExamDetail);
// router.post("/:examAttemptId/segments/:segmentId/attempts", requireAuth, upsertSegmentAttempt);

router.post("/:examAttemptId/images", requireAuth, createExamImage);
router.get("/:examAttemptId/images", requireAuth, listExamImages);

router.get("/images/:imageId", requireAuth, getExamImage);
router.put("/images/:imageId", requireAuth, updateExamImage);
router.delete("/images/:imageId", requireAuth, deleteExamImage);

export default router;
