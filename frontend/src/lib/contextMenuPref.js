// Setting: custom right-click menu on/off (Settings page). Default = on. The video editor always keeps its own menu.
const KEY = "contextMenu";
export const CTX_EVENT = "foxzering:ctxmenu";

export function isContextMenuEnabled() {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function setContextMenuEnabled(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(CTX_EVENT, { detail: on }));
}
export const isEditorPath = (p = window.location.pathname) => p.startsWith("/tools/video-editor");
export const CTX_KEY = KEY;
