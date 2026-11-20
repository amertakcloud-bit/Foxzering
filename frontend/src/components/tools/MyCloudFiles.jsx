import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useFeedback } from "../ui/Feedback";
import { SkeletonRows } from "../ui/Skeleton";
import { cloudApi } from "../../data/tools/cloudShare/app";
import { copyText, fmtDateTime, fmtSize, kindMeta, sharePageUrl } from "../../data/tools/cloudShare/common";

// Dashboard card: the files the user uploaded with Cloud Share (open page, copy link, delete).
export default function MyCloudFiles() {
  const { t, language } = useLanguage();
  const { toast, confirm } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => cloudApi.mine().then((d) => { setData(d); setError(""); }).catch((e) => { setError(e.message || "Error"); setData((v) => v || { available: false, items: [] }); }), []);
  useEffect(() => { load(); }, [load]);

  const copy = async (f) => { toast[(await copyText(sharePageUrl(f.shareId))) ? "success" : "error"](t("copied")); };
  const del = async (f) => {
    if (!(await confirm({ title: t("mfDeleteTitle"), message: t("mfDeleteMsg"), confirmText: t("mfDelete"), danger: true }))) return;
    try { await cloudApi.remove(f.shareId); toast.success(t("mfDeleted")); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <section className="tk-card ud-card">
      <header className="ud-head">
        <h3>{t("mfTitle")}</h3>
        <Link to="/tools/cloud" className="tk-btn ghost small"><i className="ri-upload-cloud-2-line" /> {t("mfUpload")}</Link>
      </header>
      {!data && <SkeletonRows rows={3} cols={2} />}
      {data && !data.available && <p className="ud-empty">{error || t("mfUnavailable")}</p>}
      {data?.available && (
        <>
          <div className="mf-stats">
            <span>{t("mfFiles")}: <b>{data.items.length}</b></span>
            <span>{t("mfStorage")}: <b>{fmtSize(data.totalBytes)}</b></span>
            <span>{t("mfDownloads")}: <b>{data.downloads}</b></span>
          </div>
          {data.items.length === 0 && <p className="ud-empty">{t("mfEmpty")}</p>}
          <ul className="mf-list">
            {data.items.map((f) => {
              const m = kindMeta(f.kind);
              const page = `/share/${f.shareId}`;
              return (
                <li key={f.shareId} className="mf-item">
                  <span className="mf-ico" style={{ "--kc": m.color }}>
                    {f.kind === "image" && f.previewUrl && !f.expired ? <img src={f.previewUrl} alt="" loading="lazy" /> : <i className={m.icon} aria-hidden="true" />}
                  </span>
                  <span className="mf-main">
                    <b title={f.name}>{f.title || f.name}</b>
                    <small>{fmtSize(f.size)} · {fmtDateTime(f.createdAt, language)}</small>
                    <small className={f.expired ? "mf-off" : ""}>{f.expired ? t("shExpired") : f.expiresAt ? `${t("shExpires")}: ${fmtDateTime(f.expiresAt, language)}` : t("shNever")} · <i className="ri-download-2-line" /> {f.downloadCount}</small>
                  </span>
                  <span className="mf-btns">
                    <Link to={page} aria-label={t("mfOpen")} title={t("mfOpen")}><i className="ri-external-link-line" /></Link>
                    <button type="button" onClick={() => copy(f)} aria-label={t("mfCopy")} title={t("mfCopy")}><i className="ri-link" /></button>
                    <button type="button" className="danger" onClick={() => del(f)} aria-label={t("mfDelete")} title={t("mfDelete")}><i className="ri-delete-bin-line" /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
