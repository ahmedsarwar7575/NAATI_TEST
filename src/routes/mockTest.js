import { Router } from "express";
import multer from "multer";
import { runAiExam } from "../controllers/mockTest.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

router.post("/ai-exam", upload.single("userAudio"), runAiExam);

export default router;
