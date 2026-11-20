import api, { API_URL, getToken } from "../../../services/api";

// API calls for the Cloud Share pages.
export const cloudApi = {
  // Public: details for the share page (404 not found, 410 expired).
  async info(shareId) {
    const res = await fetch(`${API_URL}/cloudshare/files/${encodeURIComponent(shareId)}`, { credentials: "include" });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      const e = new Error(data?.error?.message || `Request failed (${res.status})`);
      e.status = res.status; e.code = data?.error?.code || "ERROR";
      throw e;
    }
    return data.file;
  },
  mine: () => api.get("/cloudshare/mine").then((r) => r.data),
  remove: (shareId) => api.delete(`/cloudshare/files/${encodeURIComponent(shareId)}`),
  adminOverview: () => api.get("/admin/cloudshare").then((r) => r.data),
  authHeader: () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
};
