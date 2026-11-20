import "../../styles/user-dashboard.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import adminService from "../../services/adminService";
import { useLanguage } from "../../context/LanguageContext";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { fmtDateTime, fmtSize, kindMeta } from "../../data/tools/cloudShare/common";
import { kindOf } from "../../data/tools/cloudShare/common";

// Admin → Overview: Cloud Share totals and the newest uploaded files.
export default function AdminCloud() {
  const { t, language } = useLanguage();
  const [d, setD] = useState(null);
  useEffect(() => {
    let off = false;
    adminService.getCloudShare().then((r) => !off && setD(r.data)).catch(() => !off && setD({ available: false, items: [] }));
    return () => { off = true; };
  }, []);

  const stats = d?.available ? [
    ["ri-cloud-line", d.totalFiles, t("ovTotalFiles")],
    ["ri-checkbox-circle-line", d.activeFiles, t("ovActive")],
    ["ri-time-line", d.expiredFiles, t("ovExpired")],
    ["ri-hard-drive-2-line", fmtSize(d.totalBytes), t("ovStorage")],
    ["ri-download-2-line", d.downloads, t("ovDownloads")],
  ] : [];

  return (
    <section className="tk-card ud-card" style={{ marginBottom: 16 }}>
      <header className="ud-head"><h3><i className="ri-cloud-line" /> {t("ovCloud")}</h3></header>
      {!d && <SkeletonRows rows={3} cols={3} />}
      {d && !d.available && <p className="ud-empty">{t("mfUnavailable")}</p>}
      {d?.available && (
        <>
          <div className="adm-stats">
            {stats.map(([i, v, l]) => (
              <div key={l} className="adm-stat"><i className={i} /><div><b>{v}</b><span>{l}</span></div></div>
            ))}
          </div>
          {d.items.length === 0 ? <p className="ud-empty">{t("ovNoFiles")}</p> : (
            <div className="mf-scroll">
              <table className="mf-table">
                <thead><tr><th>{t("ovFile")}</th><th>{t("ovOwner")}</th><th>{t("shSize")}</th><th>{t("shCreated")}</th><th>{t("shExpires")}</th><th>{t("shDownloads")}</th></tr></thead>
                <tbody>
                  {d.items.map((f) => {
                    const m = kindMeta(kindOf(f.mimeType, f.name));
                    return (
                      <tr key={f.shareId}>
                        <td><i className={m.icon} style={{ color: m.color }} /> <Link to={`/share/${f.shareId}`}>{f.title || f.name}</Link></td>
                        <td>{f.owner ? `${f.owner.name || ""} ${f.owner.email ? `(${f.owner.email})` : ""}` : "—"}</td>
                        <td>{fmtSize(f.size)}</td>
                        <td>{fmtDateTime(f.createdAt, language)}</td>
                        <td>{f.expired ? t("shExpired") : f.expiresAt ? fmtDateTime(f.expiresAt, language) : t("shNever")}</td>
                        <td>{f.downloadCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
