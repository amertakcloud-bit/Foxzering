import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../context/LanguageContext";
import { CTX_EVENT, isContextMenuEnabled, isEditorPath } from "../../lib/contextMenuPref";
import "../../styles/context-menu.css";

// A themed menu opened at a pointer position. items: [{ icon, label, onClick, disabled, danger, hint }] — { sep: true } is a divider.
export function MenuView({ menu, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });
  const [active, setActive] = useState(-1);
  const real = menu.items.filter((i) => !i.sep);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect(), m = 8;
    setPos({
      left: Math.max(m, Math.min(menu.x, window.innerWidth - r.width - m)),
      top: Math.max(m, Math.min(menu.y, window.innerHeight - r.height - m)),
    });
  }, [menu]);

  useEffect(() => {
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const key = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + real.length) % real.length);
      } else if (e.key === "Enter" && active >= 0) { e.preventDefault(); run(real[active]); }
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, menu]);

  function run(item) {
    if (!item || item.disabled) return;
    onClose();
    try { item.onClick?.(); } catch (e) { console.error(e); }
  }

  return createPortal(
    <div ref={ref} className="ctx-menu" role="menu" style={pos} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) =>
        it.sep ? <hr key={i} className="ctx-sep" /> : (
          <button key={i} type="button" role="menuitem" disabled={it.disabled}
            className={"ctx-item" + (it.danger ? " danger" : "") + (real[active] === it ? " active" : "")}
            onMouseEnter={() => setActive(real.indexOf(it))} onClick={() => run(it)}>
            <i className={it.icon || "ri-checkbox-blank-circle-line"} aria-hidden="true" style={it.icon ? undefined : { visibility: "hidden" }} />
            <span>{it.label}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </button>
        ))}
    </div>,
    document.body,
  );
}

const editable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(button|checkbox|radio|range|color|file|submit)$/i.test(el.type || ""));

// Replaces the browser's right-click menu everywhere (back / forward / reload / links / images / text editing).
// Elements with data-native-menu keep the browser menu; a component that opens its own menu calls preventDefault + stopPropagation.
export default function GlobalContextMenu() {
  const { t } = useLanguage();
  const [menu, setMenu] = useState(null);
  const close = () => setMenu(null);

  useEffect(() => {
    const onMenu = (e) => {
      if (e.defaultPrevented || e.target.closest?.("[data-native-menu]")) return;
      // Turned off in Settings → the browser's own menu (except in the video editor).
      if (!isContextMenuEnabled() && !isEditorPath()) return;
      const target = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      if (!target) return;
      e.preventDefault();
      const link = target.closest("a[href]");
      const img = target.closest("img[src]");
      const field = editable(target) ? target : null;
      const selected = String(window.getSelection?.() || (field ? field.value.slice(field.selectionStart, field.selectionEnd) : "")).trim();
      const writeClip = (text) => navigator.clipboard?.writeText(text).catch(() => {});
      const items = [];
      if (field) {
        const ro = field.readOnly || field.disabled;
        items.push(
          { icon: "ri-scissors-cut-line", label: t("cmCut"), hint: "Ctrl+X", disabled: ro || !selected, onClick: () => { field.focus(); document.execCommand("cut"); } },
          { icon: "ri-file-copy-line", label: t("cmCopy"), hint: "Ctrl+C", disabled: !selected, onClick: () => { field.focus(); document.execCommand("copy"); } },
          { icon: "ri-clipboard-line", label: t("cmPaste"), hint: "Ctrl+V", disabled: ro, onClick: async () => {
            try { const txt = await navigator.clipboard.readText(); field.focus(); document.execCommand("insertText", false, txt); } catch { /* clipboard permission denied */ } } },
          { icon: "ri-checkbox-multiple-blank-line", label: t("cmSelectAll"), hint: "Ctrl+A", onClick: () => { field.focus(); field.select?.(); document.execCommand("selectAll"); } },
        );
      } else {
        if (selected) items.push({ icon: "ri-file-copy-line", label: t("cmCopy"), hint: "Ctrl+C", onClick: () => writeClip(selected) }, { sep: true });
        items.push(
          { icon: "ri-arrow-left-line", label: t("cmBack"), hint: "Alt+←", disabled: window.history.length < 2, onClick: () => window.history.back() },
          { icon: "ri-arrow-right-line", label: t("cmForward"), hint: "Alt+→", onClick: () => window.history.forward() },
          { icon: "ri-refresh-line", label: t("cmReload"), hint: "Ctrl+R", onClick: () => window.location.reload() },
        );
        if (link) items.push({ sep: true },
          { icon: "ri-external-link-line", label: t("cmOpenLink"), onClick: () => window.open(link.href, "_blank", "noopener") },
          { icon: "ri-link", label: t("cmCopyLink"), onClick: () => writeClip(link.href) });
        if (img) items.push({ sep: true },
          { icon: "ri-image-line", label: t("cmOpenImage"), onClick: () => window.open(img.currentSrc || img.src, "_blank", "noopener") },
          { icon: "ri-link-m", label: t("cmCopyImage"), onClick: () => writeClip(img.currentSrc || img.src) },
          { icon: "ri-download-2-line", label: t("cmSaveImage"), onClick: () => { const a = document.createElement("a"); a.href = img.currentSrc || img.src; a.download = ""; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); } });
        items.push({ sep: true },
          { icon: "ri-file-copy-line", label: t("cmCopyPage"), onClick: () => writeClip(window.location.href) },
          { icon: "ri-arrow-up-line", label: t("cmTop"), onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) });
      }
      setMenu({ x: e.clientX, y: e.clientY, items });
    };
    const onPref = (e) => { if (e.detail === false) setMenu(null); };
    document.addEventListener("contextmenu", onMenu);
    window.addEventListener(CTX_EVENT, onPref);
    return () => { document.removeEventListener("contextmenu", onMenu); window.removeEventListener(CTX_EVENT, onPref); };
  }, [t]);

  return menu ? <MenuView menu={menu} onClose={close} /> : null;
}
