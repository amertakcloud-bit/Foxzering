// Shared helpers for the Cloud Share pages (upload, share result page, dashboard, admin overview).
export const KIND_META = {
  image: { icon: "ri-image-2-line", color: "#0ea5e9" },
  svg: { icon: "ri-shapes-line", color: "#8b5cf6" },
  video: { icon: "ri-movie-2-line", color: "#ec4899" },
  audio: { icon: "ri-music-2-line", color: "#10b981" },
  pdf: { icon: "ri-file-pdf-2-line", color: "#ef4444" },
  archive: { icon: "ri-file-zip-line", color: "#f59e0b" },
  doc: { icon: "ri-file-word-2-line", color: "#2563eb" },
  sheet: { icon: "ri-file-excel-2-line", color: "#16a34a" },
  slides: { icon: "ri-file-ppt-2-line", color: "#ea580c" },
  code: { icon: "ri-file-code-line", color: "#64748b" },
  text: { icon: "ri-file-text-line", color: "#64748b" },
  other: { icon: "ri-file-3-line", color: "#64748b" },
};
export const kindMeta = (k) => KIND_META[k] || KIND_META.other;

// Same detection as the server (backend/services/cloudShareService.js fileKind) — used for the local file before upload.
export function kindOf(mime = "", name = "") {
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

export const fmtSize = (b) => {
  const n = Number(b) || 0;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};

export const fmtDateTime = (d, lang = "en") =>
  d ? new Date(d).toLocaleString(lang === "km" ? "km-KH" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

// "2h 5m" style remaining time (null when already past).
export function timeLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const el = document.createElement("textarea");
    el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
    document.body.appendChild(el); el.select();
    const ok = document.execCommand("copy"); el.remove(); return ok;
  } catch { return false; }
}

// Page link people share (no /download): <this site>/share/<id>
export const sharePageUrl = (shareId) => `${window.location.origin}/share/${shareId}`;
