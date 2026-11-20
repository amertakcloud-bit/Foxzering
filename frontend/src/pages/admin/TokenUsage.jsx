import "../../styles/user-dashboard.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import adminService from "../../services/adminService";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../../components/ui/Feedback";
import { SkeletonRows } from "../../components/ui/Skeleton";

const UNIT_KEY = { perMB: "tuPerMB", perUse: "tuPerUse", charsPerToken: "tuCharsPerToken" };

// Admin → Token usage: set how many tokens every tool costs, and see what users actually spent.
export default function TokenUsage() {
  const { t } = useLanguage();
  const { toast, confirm } = useFeedback();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    return adminService.getTokenUsage(days)
      .then((r) => { setData(r.data); setDraft((d) => (Object.keys(d).length ? d : Object.fromEntries(Object.entries(r.data.rates).map(([k, v]) => [k, String(v)])))); })
      .catch((e) => setError(e.message || "Error"));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => data && data.defs.some((d) => String(data.rates[d.key]) !== String(draft[d.key] ?? "")), [data, draft]);
  const invalid = useMemo(() => data && data.defs.some((d) => {
    const v = draft[d.key];
    return v === "" || !/^\d+$/.test(String(v)) || Number(v) < d.min || Number(v) > d.max;
  }), [data, draft]);

  const save = async () => {
    if (invalid) return toast.error(t("tuInvalid"));
    setSaving(true);
    try {
      const rates = Object.fromEntries(data.defs.map((d) => [d.key, Number(draft[d.key])]));
      const r = await adminService.saveTokenRates(rates);
      setData((v) => ({ ...v, rates: r.data.rates }));
      setDraft(Object.fromEntries(Object.entries(r.data.rates).map(([k, x]) => [k, String(x)])));
      toast.success(t("tuSaved"));
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const reset = async () => {
    if (!(await confirm({ title: t("tuResetTitle"), message: t("tuResetMsg"), confirmText: t("tuReset"), danger: true }))) return;
    try {
      const r = await adminService.resetTokenRates();
      setData((v) => ({ ...v, rates: r.data.rates }));
      setDraft(Object.fromEntries(Object.entries(r.data.rates).map(([k, x]) => [k, String(x)])));
      toast.success(t("tuSaved"));
    } catch (e) { toast.error(e.message); }
  };

  const maxTokens = Math.max(1, ...(data?.usage || []).map((u) => u.tokens));

  return (
    <div className="tu-page">
      <p className="page-subtitle" style={{ marginTop: 0 }}>{t("tuSub")}</p>
      {error && <div className="tk-alert err" role="alert">{error}</div>}

      <section className="tk-card ud-card">
        <header className="ud-head">
          <h3><i className="ri-price-tag-3-line" /> {t("tuTools")}</h3>
          {dirty && <span className="tu-dirty">{t("tuUnsaved")}</span>}
        </header>
        {!data && <SkeletonRows rows={5} cols={3} />}
        {data && (
          <div className="tu-grid">
            {data.defs.map((d) => {
              const v = draft[d.key] ?? "";
              const bad = v === "" || !/^\d+$/.test(String(v)) || Number(v) < d.min || Number(v) > d.max;
              return (
                <label key={d.key} className={"tu-row" + (bad ? " bad" : "")}>
                  <span className="tu-name"><b>{t(`tuTool_${d.tool}`)}</b><small>{t(UNIT_KEY[d.unit])}{d.unit === "perUse" && d.def === 0 ? ` · ${t("tuNeedLogin")}` : ""}</small></span>
                  <span className="tu-input">
                    <input type="number" inputMode="numeric" min={d.min} max={d.max} step="1" value={v} onChange={(e) => setDraft((x) => ({ ...x, [d.key]: e.target.value }))} aria-label={t(`tuTool_${d.tool}`)} />
                    {d.unit !== "charsPerToken" && Number(v) === 0 && v !== "" && <em>{t("tuFree")}</em>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <div className="tu-actions">
          <button type="button" className="tk-btn small" onClick={save} disabled={!data || !dirty || invalid || saving}><i className={saving ? "ri-loader-4-line spin" : "ri-save-3-line"} /> {t("tuSave")}</button>
          <button type="button" className="tk-btn ghost small" onClick={reset} disabled={!data}><i className="ri-restart-line" /> {t("tuReset")}</button>
        </div>
      </section>

      <section className="tk-card ud-card">
        <header className="ud-head">
          <h3><i className="ri-bar-chart-2-line" /> {t("tuUsage")}</h3>
          <div className="tk-seg">
            {[7, 30, 90].map((n) => <button key={n} type="button" className={days === n ? "active" : ""} onClick={() => setDays(n)}>{t("tuDays").replace("{n}", n)}</button>)}
          </div>
        </header>
        {!data && <SkeletonRows rows={4} cols={2} />}
        {data && (
          <>
            <div className="mf-stats"><span>{t("tuSpent")}: <b>{data.totals.tokens}</b></span><span>{t("tuUses")}: <b>{data.totals.uses}</b></span></div>
            {data.usage.length === 0 && <p className="ud-empty">{t("tuNoUsage")}</p>}
            <ul className="ud-tools">
              {data.usage.map((u) => (
                <li key={u.tool}>
                  <div className="ud-tool-top"><span>{t(`tuTool_${u.tool}`) === `tuTool_${u.tool}` ? u.tool : t(`tuTool_${u.tool}`)}</span><b>{u.tokens}</b></div>
                  <div className="ud-meter"><i style={{ width: `${(u.tokens / maxTokens) * 100}%` }} /></div>
                  <small>{u.count} {t("tuUses")}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
