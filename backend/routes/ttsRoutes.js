import { Router } from "express";
import { getTtsStatus, synthesizeText, ttsDiagnose } from "../controllers/ttsController.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { ttsAccess } from "../middleware/geminiKey.js";
import { chargeFlat } from "../lib/billing.js";
import { ttsLimiter } from "../middleware/rateLimiters.js";

const router = Router();
router.get("/", getTtsStatus);
router.get("/voices", getTtsStatus);
router.get("/diagnose", ttsDiagnose);
// Free tool → the visitor's own Gemini key; Video Editor → a paid "voice" job (x-job) — see ttsAccess.
router.post("/", ttsLimiter, optionalAuth, ttsAccess, chargeFlat("ttsPerUse", "tts", { skip: (req) => Boolean(req.voiceJob) }), synthesizeText);
router.post("/synthesize", ttsLimiter, optionalAuth, ttsAccess, chargeFlat("ttsPerUse", "tts", { skip: (req) => Boolean(req.voiceJob) }), synthesizeText);
export default router;
