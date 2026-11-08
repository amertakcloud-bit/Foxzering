import { CAPTION_PRESETS, HL_TEMPLATES } from "../../lib/editor/model";
import { ColorStrips, IconSeg } from "./Strips";
import Select from "../ui/Select";

// A tiny CSS preview of how a highlight template looks on its "active" word.
function Preview({ look }) {
  const mode = look.hlMode || "color";
  const base = { color: look.color || "#fff" };
  const hot = mode === "box" ? { background: look.hlBg || look.hl, color: look.hlText || "#111" }
    : mode === "underline" ? { color: base.color, boxShadow: `inset 0 -3px 0 ${look.hl}` }
    : mode === "pop" ? { color: look.hl, transform: "scale(1.22)", display: "inline-block" }
    : mode === "glow" ? { color: look.hl, textShadow: `0 0 8px ${look.hl}, 0 0 14px ${look.hl}` }
    : { color: look.hl };
  const first = mode === "fill" ? { color: look.hl } : base;
  if (look.hlGrad?.length) { // gradient-filled word
    const gr = `linear-gradient(180deg, ${look.hlGrad.join(", ")})`;
    Object.assign(hot, { backgroundImage: gr, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" });
    if (mode === "fill") Object.assign(first, { backgroundImage: gr, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" });
  }
  if (look.single) return <span className="ve-tpl-prev"><span className="w" style={hot}>Hi</span></span>;
  return <span className="ve-tpl-prev"><span style={first}>Aa</span><span className="w" style={hot}>Hi</span>{!look.reveal && <span style={base}>ខ្ញុំ</span>}</span>;
}

// Caption looks + spoken-word highlight templates (lives in the "Text" tab). Templates apply to EVERY caption.
export default function CaptionStyle({ t, busy, highlight, onHighlight, onTemplate, activeTemplate, onCaptionPreset, display = {}, onDisplay }) {
  const mode = display.single ? "single" : display.reveal ? "reveal" : "all";
  return (
    <>
    <section className="ve-sec">
      <h4>{t("veHighlightTitle")}</h4>
      <label className="ve-checks"><input type="checkbox" checked={highlight.on} onChange={(e) => onHighlight(e.target.checked, highlight.color)} /> {t("veHighlight")}</label>
      <div className="ve-tpl-grid" role="listbox" aria-label={t("veHlTemplates")}>
        {HL_TEMPLATES.map((tp) => (
          <button key={tp.id} type="button" role="option" aria-selected={activeTemplate === tp.id} className={"ve-tpl" + (activeTemplate === tp.id ? " on" : "")} onClick={() => onTemplate(tp)} disabled={busy}>
            <Preview look={tp.look} /><em>{t(tp.key)}</em>
          </button>
        ))}
      </div>
      <p className="tk-hint">{t("veHlAllHint")}</p>
      <ColorStrips value={highlight.color} onChange={(c) => onHighlight(true, c)} />
    </section>

    <section className="ve-sec">
      <h4>{t("veShowTitle")}</h4>
      <IconSeg label={t("veShowTitle")} value={mode} onChange={(k) => onDisplay({ single: k === "single", reveal: k === "reveal" })}
        items={[["all", "ri-text-wrap", t("veShowAll")], ["single", "ri-font-size-2", t("veShowSingle")], ["reveal", "ri-keyboard-line", t("veShowReveal")]]} />
      <label className="ve-field"><span>{t("veMaxChars")} · {display.maxChars > 0 ? display.maxChars : t("veMaxCharsOff")}</span>
        <input className="tk-range" type="range" min="0" max="80" step="2" value={display.maxChars || 0} disabled={busy || mode === "single"} onChange={(e) => onDisplay({ maxChars: Number(e.target.value) })} />
      </label>
      <label className="ve-field"><span>{t("veAnim")}</span>
        <Select value={display.anim || "none"} onChange={(e) => onDisplay({ anim: e.target.value })}>
          {["none", "fade", "pop", "slide", "bounce", "zoom"].map((k) => <option key={k} value={k}>{t(`veAnim_${k}`)}</option>)}
        </Select>
      </label>
    </section>

    <section className="ve-sec">
      <h4>{t("veCaptionLooks")}</h4>
      <div className="ve-looks">
        {CAPTION_PRESETS.map((p) => (
          <button key={p.id} type="button" className="ve-look" onClick={() => onCaptionPreset(p)} disabled={busy}>
            <span style={{ color: p.style.color, background: p.style.bg, fontWeight: p.style.bold ? 700 : 400, textShadow: p.style.outline ? "0 0 2px #000, 0 0 2px #000" : "none" }}>Aa</span>
            <em>{t(p.key)}</em>
          </button>
        ))}
      </div>
    </section>
    </>
  );
}
