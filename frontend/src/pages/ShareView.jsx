import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useFeedback } from "../components/ui/Feedback";
import { cloudApi } from "../data/tools/cloudShare/app";
import { downloadShared } from "../data/tools/cloudShare/download";
import { copyText, fmtDateTime, fmtSize, kindMeta, sharePageUrl, timeLeft } from "../data/tools/cloudShare/common";
import LogoLoader from "../components/LogoLoader";
import "../styles/tools/cloudShare.css";

// Public result page of a shared file: /share/:shareId (no /download in the link).
function Preview({ file, t }) {
  const [failed, setFailed] = useState(false);
  const m = kindMeta(file.kind);
  const ext = (file.name.split(".").pop() || "").slice(0, 5).toUpperCase();
  const icon = (
    <div className="sh-icon" style={{ "--kc": m.color }}>
      <i className={m.icon} aria-hidden="true" />
      <b>{ext}</b>
    </div>
  );
  if (!file.previewUrl || failed) return <div className="sh-preview sh-preview-icon">{icon}{failed && <p className="cs-muted">{t("shPreviewFail")}</p>}</div>;
  if (file.kind === "image" || file.kind === "svg")
    return <div className="sh-preview"><img src={file.previewUrl} alt={file.title || file.name} onError={() => setFailed(true)} /></div>;
  if (file.kind === "video")
    return <div className="sh-preview"><video src={file.previewUrl} controls playsInline preload="metadata" onError={() => setFailed(true)} /></div>;
  if (file.kind === "audio")
    return <div className="sh-preview sh-preview-icon">{icon}<audio src={file.previewUrl} controls preload="metadata" onError={() => setFailed(true)} /></div>;
  return <div className="sh-preview sh-preview-icon">{icon}</div>;
}

export default function ShareView() {
  const { shareId } = useParams();
  const { t, language } = useLanguage();
  const { toast } = useFeedback();
  const [state, setState] = useState({ status: "loading", file: null, error: null });
  const [now, setNow] = useState(Date.now());
  const [pct, setPct] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", file: null, error: null });
    cloudApi.info(shareId)
      .then((file) => alive && setState({ status: "ok", file, error: null }))
      .catch((e) => alive && setState({ status: e.status === 410 ? "expired" : e.status === 404 ? "missing" : "error", file: null, error: e }));
    return () => { alive = false; };
  }, [shareId]);

  // live countdown; flips to the "expired" view when the time runs out
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const file = state.file;
  const expiredNow = Boolean(file?.expiresAt && new Date(file.expiresAt).getTime() <= now);

  const download = useCallback(async () => {
    setPct(0);
    try {
      await downloadShared(file, setPct);
    } catch {
      toast.error(t("shDownloadFail"));
    } finally {
      setPct(null);
    }
  }, [file, t, toast]);

  const copy = async (text) => {
    if (await copyText(text)) toast.success(t("copied"));
    else toast.error(t("copyFailed"));
  };

  if (state.status === "loading") return <div className="page cs-page"><LogoLoader label={t("shLoading")} inline /></div>;

  if (state.status !== "ok" || expiredNow) {
    const expired = state.status === "expired" || expiredNow;
    return (
      <div className="page cs-page">
        <section className="cs-card sh-empty" role="alert">
          <i className={expired ? "ri-time-line" : "ri-file-forbid-line"} aria-hidden="true" />
          <h1 className="cs-title" style={{ justifyContent: "center" }}>{expired ? t("shExpiredTitle") : state.status === "missing" ? t("shNotFound") : t("csFailed")}</h1>
          <p className="cs-muted">{expired ? t("shExpiredMsg") : state.status === "missing" ? t("shNotFoundMsg") : state.error?.message}</p>
          <Link className="tk-btn small" to="/tools/cloud"><i className="ri-cloud-line" /> {t("shBackTools")}</Link>
        </section>
      </div>
    );
  }

  const left = timeLeft(file.expiresAt, now);
  const link = sharePageUrl(file.shareId);
  const curl = `curl -L -o "${file.name.replace(/"/g, "")}" "${file.downloadUrl}"`;
  const m = kindMeta(file.kind);

  return (
    <div className="page cs-page">
      <article className="sh-card">
        <Preview file={file} t={t} />

        <div className="sh-body">
          <header className="sh-head">
            <span className="sh-kind" style={{ "--kc": m.color }}><i className={m.icon} aria-hidden="true" /></span>
            <div className="sh-titles">
              <h1 className="sh-title">{file.title || file.name || t("shUntitled")}</h1>
              {file.title && <p className="cs-muted sh-fname">{file.name}</p>}
            </div>
          </header>

          <dl className="sh-meta">
            <div><dt><i className="ri-hard-drive-2-line" /> {t("shSize")}</dt><dd>{fmtSize(file.size)}</dd></div>
            <div><dt><i className="ri-calendar-line" /> {t("shCreated")}</dt><dd>{fmtDateTime(file.createdAt, language)}</dd></div>
            <div>
              <dt><i className="ri-timer-line" /> {t("shExpires")}</dt>
              <dd>{file.expiresAt ? <>{fmtDateTime(file.expiresAt, language)}<small>{t("shLeft").replace("{t}", left || "0m")}</small></> : t("shNever")}</dd>
            </div>
            <div><dt><i className="ri-download-2-line" /> {t("shDownloads")}</dt><dd>{file.downloadCount}</dd></div>
          </dl>

          <div className="sh-actions">
            <button type="button" className="cs-btn primary-btn sh-dl" onClick={download} disabled={pct !== null}>
              <i className={pct !== null ? "ri-loader-4-line spin" : "ri-download-2-line"} />
              {pct !== null ? `${t("shDownloading")} ${pct ? pct + "%" : ""}` : t("shDownload")}
            </button>
            <button type="button" className="cs-btn cs-btn-ghost" onClick={() => copy(link)}>
              <i className="ri-file-copy-line" /> {t("shCopyLink")}
            </button>
          </div>
          {pct !== null && pct > 0 && <div className="cs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}><div style={{ width: `${pct}%` }} /></div>}

          <details className="sh-api">
            <summary><i className="ri-code-s-slash-line" /> {t("shApi")}</summary>
            <p className="cs-muted">{t("shApiHint")}</p>
            <label className="cs-muted">{t("shApiInfo")}</label>
            <div className="sh-copyrow"><input className="cs-input" readOnly value={file.infoUrl} onFocus={(e) => e.target.select()} /><button type="button" className="cs-btn cs-btn-ghost" onClick={() => copy(file.infoUrl)} aria-label={t("copy")}><i className="ri-file-copy-line" /></button></div>
            <label className="cs-muted">{t("shApiDownload")}</label>
            <div className="sh-copyrow"><input className="cs-input" readOnly value={file.downloadUrl} onFocus={(e) => e.target.select()} /><button type="button" className="cs-btn cs-btn-ghost" onClick={() => copy(file.downloadUrl)} aria-label={t("copy")}><i className="ri-file-copy-line" /></button></div>
            <button type="button" className="cs-link-btn" onClick={() => copy(curl)}><i className="ri-terminal-box-line" /> {t("shCopyCurl")}</button>
          </details>
        </div>
      </article>
    </div>
  );
}
