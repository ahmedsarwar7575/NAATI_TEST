import { Router } from "express";
import multer from "multer";
import { runAiExam } from "../controllers/mockTest.js";
import { requireAuth } from "../middleware/auth.js";
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post("/ai-exam", requireAuth, upload.single("userAudio"), runAiExam);

export default router;
