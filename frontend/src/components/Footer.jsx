import { NavLink } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import Logo from "./Logo";

const LINKS = [
  { to: "/", key: "home" },
  { to: "/getstart", key: "getStart" },
  { to: "/tools", key: "tools" },
  { to: "/plants", key: "plantTitle" },
  { to: "/#TermOfServices", key: "termsOfService" },
];
const SOCIAL = [
  { href: "https://t.me/Foxzering_Dev", icon: "ri-telegram-2-line", label: "@Foxzering" },
  { href: "https://t.me/Foxzering", icon: "ri-telegram-line", label: "Foxzering" },
  { href: "https://www.tiktok.com/@foxzering_dev", icon: "ri-tiktok-line", label: "@amertak.dev" },
];

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="sf-grid">
        <div className="sf-col sf-about">
          <div className="sf-brand">
            <Logo />
            <span>Foxzering</span>
          </div>
          <p>{t("footerAbout")}</p>
          <p><i className="ri-mail-line"></i> {t('contactGmail')}</p>
        </div>
      
        <nav className="sf-col" aria-label={t("fastLink")}>
          <h4>{t("fastLink")}</h4>
          {LINKS.map((l) => (
            <NavLink key={l.key} to={l.to}>{t(l.key)}</NavLink>
          ))}
        </nav>

        <div className="sf-col">
          <h4>{t("contactUs")}</h4>
          <div className="sf-social">
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}>
                <i className={s.icon} aria-hidden="true"></i>
                <span>{s.label}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="sf-bottom">© 2026 Foxzering Tools. {t("footerRights")}</div>
    </footer>
  );
}

export default Footer;
