import { getRates, chargeTokens, refundTokens, tokensForBytes } from "../lib/billing.js";
import { isStaff } from "../lib/permissions.js";
import { CLOUDSHARE_MAX_BYTES, PREVIEW_KINDS, deleteCloudShareRecord, fileKind, isCloudShareAvailable, createCloudShareRecord, findCloudShareRecord, getCloudShareConfig, incrementCloudShareDownloadCount, listCloudShareByOwner, toPublicCloudShareRecord } from "../services/cloudShareService.js";

const MAX_FILE_SIZE = CLOUDSHARE_MAX_BYTES;

function makeError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function getCloudShareConfigHandler(_req, res) {
  const rates = await getRates();
  res.json({
    success: true,
    config: { ...getCloudShareConfig(), tokensPerMB: rates.cloudSharePerMB },
  });
}

// Page link (what people share) has no /download: the frontend page /share/:id shows the result page.
function urls(req, r) {
  const api = process.env.PUBLIC_URL || process.env.SERVER_URL || `${req.protocol}://${req.get("host")}`;
  const origin = req.get("origin");
  const site = process.env.PUBLIC_URL || (origin && /^https?:\/\//.test(origin) ? origin : "") || String(process.env.CLIENT_URL || "").split(",")[0].trim() || api;
  const base = `${api}/api/cloudshare/files/${r.shareId}`;
  const kind = fileKind(r.mimeType, r.originalName);
  return {
    shareUrl: `${site.replace(/\/+$/, "")}/share/${r.shareId}`,
    downloadUrl: `${base}/download`,
    previewUrl: PREVIEW_KINDS.has(kind) ? `${base}/preview` : null,
    infoUrl: base,
  };
}

const shape = (req, r) => ({ ...toPublicCloudShareRecord(r), ...urls(req, r) });

export async function uploadCloudShareFile(req, res) {
  if (!isCloudShareAvailable()) {
    return res.status(503).json({
      success: false,
      error: { code: "STORAGE_UNAVAILABLE", message: "CloudShare is not set up on this server (set CLOUD_MONGODB_URI, or CLOUD_DATABASE_PATH for local SQLite)." },
    });
  }
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { code: "NO_FILE", message: "Please attach a file in the file field." },
    });
  }

  if (req.file.size === 0) {
    return res.status(400).json({
      success: false,
      error: { code: "EMPTY_FILE", message: "The uploaded file is empty." },
    });
  }

  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(413).json({
      success: false,
      error: { code: "FILE_TOO_LARGE", message: `The file exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.` },
    });
  }

  // 2 tokens per MB, rounded UP to whole tokens (5 MB = 10 tokens). Refunded if storing fails.
  const cost = tokensForBytes(req.file.size, (await getRates()).cloudSharePerMB);
  let balance;
  try {
    balance = await chargeTokens(req.user._id, cost, "cloudshare");
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || "INTERNAL_ERROR", message: err.message },
    });
  }

  try {
    const record = await createCloudShareRecord({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      expiresIn: req.body?.expiresIn,
      title: req.body?.title,
      owner: req.user._id,
    });

    const file = shape(req, record);
    return res.status(201).json({
      success: true,
      file: { ...file, url: file.shareUrl },
      cost,
      tokens: balance,
    });
  } catch (error) {
    await refundTokens(req.user._id, cost, "cloudshare").catch(() => {});
    const code = ["INVALID_EXPIRATION", "STORAGE_UNAVAILABLE"].includes(error.code) ? error.code : "INTERNAL_ERROR";
    return res.status(code === "INVALID_EXPIRATION" ? 400 : code === "STORAGE_UNAVAILABLE" ? 503 : 500).json({
      success: false,
      error: {
        code,
        message: error.message || "Unable to store the uploaded file.",
      },
    });
  }
}

export async function getCloudShareFileInfo(req, res) {
  const { shareId } = req.params;

  try {
    const record = await findCloudShareRecord(shareId, { includeExpired: true });
    if (!record) {
      throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found or has expired.");
    }
    if (record.expired) throw makeError(410, "FILE_EXPIRED", "This link has expired.");

    return res.json({
      success: true,
      file: shape(req, record),
    });
  } catch (error) {
    return res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : error.status || 500).json({
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "Unable to fetch file info.",
      },
    });
  }
}

export async function downloadCloudShareFile(req, res) {
  const { shareId } = req.params;

  try {
    const record = await findCloudShareRecord(shareId, { withData: true });
    if (!record) {
      throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found or has expired.");
    }
    await incrementCloudShareDownloadCount(shareId);

    const d = record.data;
    const buf = Buffer.isBuffer(d) ? d : Buffer.isBuffer(d?.buffer) ? d.buffer : Buffer.from(d);
    const safe = record.originalName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(record.originalName)}`);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.end(buf);
  } catch (error) {
    return res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : error.status || 500).json({
      success: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "Unable to download the file.",
      },
    });
  }
}

const bufferOf = (d) => (Buffer.isBuffer(d) ? d : Buffer.isBuffer(d?.buffer) ? d.buffer : Buffer.from(d));

// GET /files/:shareId/preview — inline bytes for <img>/<video>/<audio> (images, svg, video, audio only; supports Range for video seeking).
export async function previewCloudShareFile(req, res) {
  try {
    const record = await findCloudShareRecord(req.params.shareId, { withData: true });
    if (!record) throw makeError(404, "FILE_NOT_FOUND", "The requested file was not found or has expired.");
    const kind = fileKind(record.mimeType, record.originalName);
    if (!PREVIEW_KINDS.has(kind)) throw makeError(415, "NO_PREVIEW", "This file type has no preview.");
    const buf = bufferOf(record.data);
    const type = kind === "svg" ? "image/svg+xml" : record.mimeType;
    res.setHeader("Content-Type", type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // An SVG opened directly must never run scripts.
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src 'self'; sandbox");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=300");
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : Math.max(0, buf.length - parseInt(m[2], 10));
      let end = m[1] && m[2] ? parseInt(m[2], 10) : buf.length - 1;
      end = Math.min(end, buf.length - 1);
      if (start > end || start >= buf.length) {
        res.status(416).setHeader("Content-Range", `bytes */${buf.length}`);
        return res.end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${buf.length}`);
      res.setHeader("Content-Length", String(end - start + 1));
      return res.end(buf.subarray(start, end + 1));
    }
    res.setHeader("Content-Length", String(buf.length));
    return res.end(buf);
  } catch (error) {
    return res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : error.status || 500).json({ success: false, error: { code: error.code || "INTERNAL_ERROR", message: error.message || "Unable to load the preview." } });
  }
}

// GET /mine — the logged-in user's uploads (dashboard).
export async function listMyCloudShareFiles(req, res) {
  try {
    if (!isCloudShareAvailable()) return res.json({ success: true, data: { available: false, items: [], totalBytes: 0 } });
    const rows = await listCloudShareByOwner(req.user._id, 100);
    const now = Date.now();
    const items = rows.map((r) => ({ ...shape(req, { ...r, expired: Boolean(r.expiresAt && new Date(r.expiresAt).getTime() <= now) }) }));
    res.json({ success: true, data: { available: true, items, totalBytes: items.reduce((n, f) => n + (f.size || 0), 0), downloads: items.reduce((n, f) => n + (f.downloadCount || 0), 0) } });
  } catch (error) {
    res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : 500).json({ success: false, error: { code: error.code || "INTERNAL_ERROR", message: error.message || "Unable to list files." } });
  }
}

// DELETE /files/:shareId — owner only (staff may delete any).
export async function deleteCloudShareFile(req, res) {
  try {
    const ok = await deleteCloudShareRecord(req.params.shareId, isStaff(req.user?.role) ? null : req.user._id);
    if (!ok) throw makeError(404, "FILE_NOT_FOUND", "File not found.");
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === "STORAGE_UNAVAILABLE" ? 503 : error.status || 500).json({ success: false, error: { code: error.code || "INTERNAL_ERROR", message: error.message || "Unable to delete." } });
  }
}
