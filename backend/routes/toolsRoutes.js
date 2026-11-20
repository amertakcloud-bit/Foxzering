import { Router } from "express";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { requireGeminiKey } from "../middleware/geminiKey.js";
import { protect } from "../middleware/authMiddleware.js";
import { chargeFlat } from "../lib/billing.js";
import { dbReady } from "../middleware/dbReady.js";
import { aiLimiter, downloadLimiter, lightLimiter } from "../middleware/rateLimiters.js";
import { uploadImage, uploadMedia } from "../middleware/uploads.js";
import { listMyQrImages, removeQrImage, uploadQrImage, viewQrImage, convertAudio, createImagePrompt, createQr, downloadVideo, getTools, resolveVideoLink } from "../controllers/toolsController.js";

const router = Router();

router.get("/tools", optionalAuth, getTools);
router.post("/qr", lightLimiter, optionalAuth, chargeFlat("qrPerUse", "qr"), createQr);
router.post("/qr/image", lightLimiter, dbReady, protect, uploadImage, uploadQrImage);
router.get("/qr/images", lightLimiter, dbReady, protect, listMyQrImages);
router.delete("/qr/image/:id", lightLimiter, dbReady, protect, removeQrImage);
router.get("/qr/image/:id", lightLimiter, viewQrImage);
router.post("/image-prompt", aiLimiter, optionalAuth, requireGeminiKey, uploadImage, chargeFlat("imagePromptPerUse", "imageprompt"), createImagePrompt);
router.post("/video/resolve", downloadLimiter, optionalAuth, chargeFlat("downloaderPerUse", "downloader"), resolveVideoLink);
router.get("/video/download", downloadLimiter, downloadVideo);
router.post("/audio/convert", lightLimiter, optionalAuth, uploadMedia, chargeFlat("audioExportPerUse", "audioexport"), convertAudio);

export default router;
