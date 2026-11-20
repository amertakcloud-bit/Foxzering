import { AppError } from "../lib/AppError.js";
import { asyncHandler } from "../middleware/errorMiddleware.js";
import { KHMER_VOICES, diagnose, synthesizeSpeech } from "../lib/edgeTts.js";
import { DEFAULT_VOICES, GEMINI_VOICES, STYLES, synthesizeGemini } from "../lib/geminiTts.js";
import { jobHasBudget, jobSpend } from "../lib/billing.js";

export const MAX_TEXT_LENGTH = 3000;

const provider = () => (process.env.TTS_PROVIDER || "gemini").toLowerCase(); // default provider: "gemini" | "edge"
// Per request: body.provider ("gemini" = Google AI Speech, "edge" = Microsoft Edge TTS) wins over the default.
export const pickProvider = (req) => {
  const p = String(req?.body?.provider || "").toLowerCase();
  return p === "edge" || p === "gemini" ? p : provider();
};

export function getTtsStatus(_req, res) {
  const gem = provider() === "gemini";
  res.json({
    success: true,
    online: true,
    service: gem ? "Khmer AI Voice (Gemini TTS)" : "Khmer TTS API",
    provider: provider(),
    voices: gem ? GEMINI_VOICES : KHMER_VOICES,
    styles: gem ? Object.keys(STYLES) : [],
    needsOwnKey: false,
    maxCharacters: MAX_TEXT_LENGTH,
    ranges: gem ? {} : { rate: [-50, 100], pitch: [-50, 50], volume: [-50, 50] },
    // Both engines, so the UI can offer a switch.
    providers: {
      gemini: { label: "Google AI Speech", voices: GEMINI_VOICES, styles: Object.keys(STYLES), free: false },
      edge: { label: "Microsoft Edge TTS", voices: KHMER_VOICES, styles: [], free: true, ranges: { rate: [-50, 100], pitch: [-50, 50], volume: [-50, 50] } },
    },
  });
}

export const synthesizeText = asyncHandler(async (req, res) => {
  const prov = pickProvider(req);
  const { text = "", voice = prov === "gemini" ? DEFAULT_VOICES.m : "piseth", style = "natural", rate = 0, pitch = 0, volume = 0 } = req.body || {};
  const safe = String(text).replace(/\s+/g, " ").trim();
  if (!safe) throw new AppError(400, "EMPTY_TEXT", "Please enter some text to convert to speech.");
  if (safe.length > MAX_TEXT_LENGTH) {
    throw new AppError(400, "TEXT_TOO_LONG", `Text is too long. Please keep it under ${MAX_TEXT_LENGTH} characters.`);
  }
  let out;
  if (prov === "gemini") {
    if (req.voiceJob) await jobHasBudget(req.voiceJob, req.user._id, "voice", safe.length);
    out = await synthesizeGemini({ apiKey: req.gemini.key, text: safe, voice, style });
    if (req.voiceJob) await jobSpend(req.voiceJob, req.user._id, "voice", safe.length);
  } else {
    // Microsoft Edge TTS: in-memory (no temp files), free — never touches the Gemini key or a paid job.
    out = await synthesizeSpeech(safe, { voice, rate, pitch, volume });
  }
  res.set({
    "Content-Type": out.contentType,
    "Content-Disposition": `inline; filename="khmer-voice.${out.contentType === "audio/wav" ? "wav" : "mp3"}"`,
    "Cache-Control": "no-store",
    "X-Voice": out.voice,
    "X-TTS-Provider": prov === "edge" ? (out.provider || "edge") : "gemini",
  });
  res.send(out.audio);
});

export const ttsDiagnose = asyncHandler(async (_req, res) => {
  const results = await diagnose();
  res.json({ success: true, working: results.some((r) => r.ok && r.provider !== "google"), googleOnly: !results.some((r) => r.ok && r.provider !== "google") && results.some((r) => r.ok), results });
});
