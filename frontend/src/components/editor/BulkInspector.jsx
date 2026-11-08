import { useState } from "react";
import { Range } from "./Inspector";

// Several clips selected: change one property on all of them at once, lock them, copy, duplicate or delete them.
export default function BulkInspector({ clips, onPatch, onLock, onCopy, onDuplicate, onDelete, onClear, t }) {
  const [v, setV] = useState({ opacity: 1, volume: 1, scale: 1, rotation: 0, start: 0, dur: 3 });
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const has = (f) => clips.some(f);
  const visual = has((c) => c.type === "video" || c.type === "image");
  const audio = has((c) => c.type === "video" || c.type === "audio");
  const textual = has((c) => c.type === "text" || c.type === "caption");
  const locked = clips.filter((c) => c.locked).length;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const row = (key, node) => (
    <div className="ve-bulk-row" key={key}>
      {node}
      <button type="button" className="tk-btn ghost small" onClick={() => onPatch({ [key]: v[key] })}><i className="ri-check-line" />{t("veBulkApply")}</button>
    </div>
  );
  return (
    <div className="ve-insp ve-bulk">
      <div className="ve-insp-title"><i className="ri-checkbox-multiple-line" /> {t("veSelected").replace("{n}", clips.length)}</div>
      <div className="ve-bulk-actions">
        <button type="button" className="tk-btn ghost small" onClick={onCopy}><i className="ri-file-copy-line" />{t("veCopy")}</button>
        <button type="button" className="tk-btn ghost small" onClick={onDuplicate}><i className="ri-stack-line" />{t("veDuplicate")}</button>
        <button type="button" className="tk-btn ghost small" onClick={() => onLock(locked < clips.length)}>
          <i className={locked < clips.length ? "ri-lock-2-line" : "ri-lock-unlock-line"} />{locked < clips.length ? t("veLock") : t("veUnlock")}
        </button>
        <button type="button" className="tk-btn ghost small danger" onClick={onDelete}><i className="ri-delete-bin-line" />{t("veDelete")}</button>
        <button type="button" className="tk-btn ghost small" onClick={onClear}><i className="ri-close-line" />{t("veClearSel")}</button>
      </div>
      <section className="ve-sec">
        <h4>{t("veBulkTitle")}</h4>
        <div className="ve-sec-body">
          {row("opacity", <Range label={t("veOpacity")} value={v.opacity} min={0} max={1} step={0.05} onChange={(x) => set("opacity", x)} fmt={pct} p />)}
          {audio && row("volume", <Range label={t("veVolume")} value={v.volume} min={0} max={2} step={0.05} onChange={(x) => set("volume", x)} fmt={pct} p />)}
          {(visual || textual) && row("rotation", <Range label={t("veRotation")} value={v.rotation} min={-180} max={180} step={1} onChange={(x) => set("rotation", x)} fmt={(x) => `${x}°`} />)}
          {visual && row("scale", <Range label={t("veScale")} value={v.scale} min={0.1} max={3} step={0.05} onChange={(x) => set("scale", x)} fmt={pct} p />)}
          {row("dur", <Range label={t("veDuration")} value={v.dur} min={0.1} max={60} step={0.1} onChange={(x) => set("dur", x)} fmt={(x) => `${x}s`} />)}
        </div>
      </section>
    </div>
  );
}
