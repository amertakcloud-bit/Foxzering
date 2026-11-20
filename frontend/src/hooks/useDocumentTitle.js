import { useEffect } from "react";

const BRAND = "Foxzering";

// Sets <title> to "Page — Foxzering" (or just the brand on the home page).
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title && title !== BRAND ? `${title} — ${BRAND}` : BRAND;
  }, [title]);
}
