import crypto from "node:crypto";
import dns from "node:dns";

// CloudShare stores files in its OWN MongoDB database (CLOUD_MONGODB_URI), separate from
// the main app database. Works on Vercel (no filesystem needed).
// Vercel limits a request body to ~4.5 MB, so the default limit there is 4 MB.
const DEFAULT_MB = process.env.VERCEL ? 4 : 15;
const MAX_MB = Math.min(Number(process.env.CLOUDSHARE_MAX_MB || process.env.MAX_FILE_SIZE_MB || DEFAULT_MB) || DEFAULT_MB, 15);
export const CLOUDSHARE_MAX_BYTES = MAX_MB * 1024 * 1024;

const EXPIRY_OPTIONS = Object.freeze({
  never: null,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
});

import { cloudOdm, cloudSqlitePath, sqliteAllowed, useCloudMongo } from "../lib/odm/index.js";

// Available with CLOUD_MONGODB_URI (MongoDB) or, on a local PC, a SQLite file (CLOUD_DATABASE_PATH).
export function isCloudShareAvailable() {
  return useCloudMongo() || sqliteAllowed("CLOUD_DATABASE_PATH");
}

let connPromise = null;
let connection = null;
let Model = null;

// One cached connection to the CloudShare database (CLOUD_MONGODB_URI), shared by CloudShare
// and the video-editor projects.
export async function getCloudConnection() {
  if (connection && connection.readyState === 1) return connection;
  await getCloudModel();
  return connection;
}

export async function getCloudModel() {
  if (Model && Model.db.readyState === 1) return Model;
  if (!isCloudShareAvailable()) {
    const e = new Error("CloudShare database is not configured (set CLOUD_MONGODB_URI, or CLOUD_DATABASE_PATH for a local SQLite file).");
    e.code = "STORAGE_UNAVAILABLE";
    throw e;
  }
  if (!connPromise) {
    connPromise = (async () => {
      const mongoose = await cloudOdm(); // real mongoose (CLOUD_MONGODB_URI) or the SQLite look-alike
    const fileSchema = new mongoose.Schema(
      {
        shareId: { type: String, required: true, unique: true, index: true },
        originalName: { type: String, required: true },
        title: { type: String, default: "" },
        owner: { type: String, default: "", index: true },
        mimeType: { type: String, default: "application/octet-stream" },
        size: { type: Number, required: true },
        data: { type: Buffer, required: true, select: false },
        downloadCount: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null },
      },
      { timestamps: true }
    );
    // MongoDB removes expired documents automatically (TTL); null expiresAt is ignored.
    fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


      const uri = process.env.CLOUD_MONGODB_URI;
      const opts = { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, maxPoolSize: 5 };
      let conn;
      try {
        conn = useCloudMongo() ? await mongoose.createConnection(uri, opts).asPromise() : await mongoose.createConnection(cloudSqlitePath()).asPromise();
      } catch (err) {
        if (uri && uri.startsWith("mongodb+srv") && /querySrv|ESERVFAIL|ECONNREFUSED|ENOTFOUND/i.test(String(err?.message))) {
          dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean));
          conn = await mongoose.createConnection(uri, opts).asPromise();
        } else throw err;
      }
      connection = conn;
      Model = conn.model("CloudFile", fileSchema);
      return Model;
    })().catch((err) => {
      connPromise = null; // retry on next request
      throw err;
    });
  }
  return connPromise;
}

// Test hook: inject a fake model.
export function __setCloudModel(m) {
  Model = m;
  connPromise = m ? Promise.resolve(m) : null;
  if (m && !m.db) m.db = { readyState: 1 };
}

export function getCloudShareConfig() {
  return {
    available: isCloudShareAvailable(),
    maxFileSizeMB: MAX_MB,
    maxFileSizeBytes: CLOUDSHARE_MAX_BYTES,
    expirationOptions: Object.keys(EXPIRY_OPTIONS),
    tokensPerMB: 2,
  };
}

function sanitizeFilename(name) {
  const n = String(name || "upload").replace(/[\\/<>:"|?*\u0000-\u001F]/g, "_").trim();
  return n.slice(0, 200) || "upload";
}

function getExpiresAt(expiresIn) {
  const key = String(expiresIn || "never").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(EXPIRY_OPTIONS, key)) {
    const e = new Error("Invalid expiration option.");
    e.code = "INVALID_EXPIRATION";
    throw e;
  }
  const d = EXPIRY_OPTIONS[key];
  return d === null ? null : new Date(Date.now() + d);
}

export function sanitizeTitle(t) {
  return String(t ?? "").replace(/[\u0000-\u001F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

// Rough file type used for the icon / preview on the share page.
export function fileKind(mime = "", name = "") {
  const m = String(mime).toLowerCase();
  const ext = (String(name).split(".").pop() || "").toLowerCase();
  if (m === "image/svg+xml" || ext === "svg") return "svg";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (/zip|rar|7z|tar|gzip/.test(m) || ["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "sheet";
  if (["ppt", "pptx", "odp"].includes(ext)) return "slides";
  if (["js", "ts", "jsx", "tsx", "json", "html", "css", "py", "java", "c", "cpp", "go", "rs", "php", "sh", "xml", "yml", "yaml"].includes(ext)) return "code";
  if (m.startsWith("text/") || ["txt", "md", "log"].includes(ext)) return "text";
  return "other";
}
// Only these are streamed inline (as <img>/<video>/<audio> sources). Everything else is download-only.
export const PREVIEW_KINDS = new Set(["image", "svg", "video", "audio"]);

export async function createCloudShareRecord({ originalName, mimeType, buffer, expiresIn, title, owner }) {
  const expiresAt = getExpiresAt(expiresIn);
  const M = await getCloudModel();
  const doc = await M.create({
    shareId: crypto.randomBytes(9).toString("base64url"),
    originalName: sanitizeFilename(originalName),
    title: sanitizeTitle(title),
    owner: owner ? String(owner) : "",
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
    data: buffer,
    expiresAt,
  });
  return plain(doc);
}

function plain(doc) {
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return { ...o, expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString() : null };
}

export async function findCloudShareRecord(shareId, { withData = false, includeExpired = false } = {}) {
  const M = await getCloudModel();
  let q = M.findOne({ shareId: String(shareId) });
  if (withData) q = q.select("+data");
  const doc = await q;
  if (!doc) return null;
  const rec = plain(doc);
  const expired = Boolean(rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now());
  if (expired && !includeExpired) return null;
  return { ...rec, expired };
}

export async function incrementCloudShareDownloadCount(shareId) {
  const M = await getCloudModel();
  await M.updateOne({ shareId: String(shareId) }, { $inc: { downloadCount: 1 } });
}

// Files uploaded by one user (newest first, no file bytes).
export async function listCloudShareByOwner(owner, limit = 100) {
  const M = await getCloudModel();
  const docs = await M.find({ owner: String(owner) }).select("-data").sort({ createdAt: -1 }).limit(limit);
  return docs.map(plain);
}

export async function deleteCloudShareRecord(shareId, owner = null) {
  const M = await getCloudModel();
  const filter = { shareId: String(shareId) };
  if (owner) filter.owner = String(owner);
  const rec = await M.findOne(filter);
  if (!rec) return false;
  await M.deleteOne(filter);
  return true;
}

// Admin overview: totals + the newest files (all users).
export async function cloudShareOverview(limit = 50) {
  const M = await getCloudModel();
  const all = (await M.find({}).select("-data").sort({ createdAt: -1 }).limit(5000)).map(plain);
  const now = Date.now();
  const active = all.filter((f) => !f.expiresAt || new Date(f.expiresAt).getTime() > now);
  return {
    totalFiles: all.length,
    activeFiles: active.length,
    expiredFiles: all.length - active.length,
    totalBytes: all.reduce((n, f) => n + (f.size || 0), 0),
    downloads: all.reduce((n, f) => n + (f.downloadCount || 0), 0),
    items: all.slice(0, limit),
  };
}

export function toPublicCloudShareRecord(r) {
  return {
    shareId: r.shareId,
    title: r.title || "",
    kind: fileKind(r.mimeType, r.originalName),
    expired: Boolean(r.expired),
    name: r.originalName,
    size: r.size,
    mimeType: r.mimeType,
    downloadCount: r.downloadCount || 0,
    expiresAt: r.expiresAt || null,
    createdAt: r.createdAt || null,
  };
}
