import { saveBlob } from "../../../lib/download";

// Download through the API (fetch → blob → save) so we can show progress/errors on the page instead of leaving it.
export async function downloadShared(file, onProgress) {
  const res = await fetch(file.downloadUrl, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || file.size || 0;
  if (!res.body || !onProgress || !total) {
    saveBlob(await res.blob(), file.name);
    return;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(100, Math.round((got / total) * 100)));
  }
  saveBlob(new Blob(chunks, { type: file.mimeType || "application/octet-stream" }), file.name);
}
