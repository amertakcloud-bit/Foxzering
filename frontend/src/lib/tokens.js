import { useEffect, useState } from "react";
import { API_URL } from "../services/api";

// Token prices. The values below are the defaults; the real (admin-set) prices are loaded from GET /api/tools
// by useRates() and written into this object, so every page that reads RATES shows the live price.
export const RATES = { captionPerMB: 5, cloudSharePerMB: 2, voiceCharsPerToken: 200, aiEditPerUse: 1 };

const listeners = new Set();
let loaded = false;
export function applyRates(r) {
  if (!r || typeof r !== "object") return;
  let changed = false;
  for (const k of Object.keys(r)) if (Number.isFinite(Number(r[k])) && RATES[k] !== Number(r[k])) { RATES[k] = Number(r[k]); changed = true; }
  if (changed) listeners.forEach((f) => f());
}

// Call once in a page that shows prices: it loads the live prices (one request per page load) and re-renders when they arrive.
export function useRates() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    if (!loaded) {
      loaded = true;
      fetch(`${API_URL}/tools`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => applyRates(d?.data?.rates))
        .catch(() => { loaded = false; });
    }
    return () => listeners.delete(f);
  }, []);
  return RATES;
}

// ceil(bytes × perMB / 1 MiB), at least 1 (0 when the tool is free). e.g. 2.12 MB × 5 = 10.6 → 11.
export function tokensForBytes(bytes, perMB) {
  if (!(Number(perMB) > 0)) return 0;
  const b = Math.max(0, Math.floor(Number(bytes) || 0));
  return Math.max(1, Math.ceil((b * perMB) / 1048576));
}
