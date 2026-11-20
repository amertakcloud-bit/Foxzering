import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Skeleton } from "../components/ui/Skeleton";
import "../styles/notifications.css";

const ICONS = {
  broadcast: "ri-megaphone-line",
  tokens_added: "ri-add-circle-line",
  tokens_removed: "ri-subtract-line",
  payment: "ri-bank-card-line",
  low_balance: "ri-error-warning-line",
  refund: "ri-refund-2-line",
  promo: "ri-coupon-3-line",
};

// Page: /notifications — the full list behind the header bell.
export default function Notifications() {
  const { user, refreshUser } = useAuth();
  const { t, language } = useLanguage();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const r = await api.get("/users/notifications");
      setItems(r.data?.items || []);
      setError("");
    } catch (e) {
      setError(e.message || t("ntLoadFail"));
      setItems((v) => v || []);
    }
  }, [t]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const readAll = async () => {
    setItems((l) => l.map((n) => ({ ...n, read: true })));
    try { await api.post("/users/notifications/read-all"); } catch { /* next load fixes it */ }
  };
  const readOne = async (n) => {
    if (n.read) return;
    setItems((l) => l.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    try { await api.post(`/users/notifications/${n._id}/read`); refreshUser?.(); } catch { /* ignore */ }
  };

  if (!user) return <div className="page"><p className="st-muted">{t("ntLogin")} <Link to="/login">{t("login")}</Link></p></div>;

  const unread = (items || []).filter((n) => !n.read).length;
  const shown = (items || []).filter((n) => filter === "all" || !n.read);
  const when = (d) => new Date(d).toLocaleString(language === "km" ? "km-KH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="page nt-page">
      <h2 className="page-heading">{t("ntTitle")}</h2>
      <p className="page-subtitle">{t("ntSub")}</p>

      <div className="nt-bar">
        <div className="tk-seg">
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t("ntAll")}</button>
          <button type="button" className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>{t("ntUnread")}{unread ? ` (${unread})` : ""}</button>
        </div>
        <button type="button" className="tk-btn ghost small" onClick={readAll} disabled={!unread}><i className="ri-check-double-line" /> {t("markAllRead")}</button>
      </div>

      {error && <div className="tk-alert err" role="alert">{error}</div>}
      {!items && <div className="nt-list">{[0, 1, 2].map((i) => <Skeleton key={i} h={64} w="100%" />)}</div>}
      {items && shown.length === 0 && !error && <p className="st-muted nt-empty"><i className="ri-notification-off-line" /> {t("ntEmpty")}</p>}
      <ul className="nt-list">
        {shown.map((n) => (
          <li key={n._id}>
            <button type="button" className={"nt-item" + (n.read ? "" : " unread")} onClick={() => readOne(n)}>
              <span className="nt-ico"><i className={ICONS[n.type] || "ri-notification-3-line"} aria-hidden="true" /></span>
              <span className="nt-main"><b>{n.title}</b>{n.body && <span>{n.body}</span>}<small>{when(n.createdAt)}</small></span>
              {!n.read && <i className="nt-dot" aria-label="unread" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
