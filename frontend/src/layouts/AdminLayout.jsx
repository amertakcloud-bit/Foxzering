import { useState, useEffect, lazy, Suspense } from "react";
import { isStaff } from "../lib/permissions";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import LogoLoader from "../components/LogoLoader";
const Footer = lazy(() => import("../components/Footer"));

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    if (!authLoading && (!user || !isStaff(user))) {
      navigate("/admin/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  if (authLoading) {
    return (
      <div className="auth-loader" role="status" aria-label="Loading">
        <i className="ri-loader-4-line auth-loader-icon" aria-hidden="true"></i>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user || !isStaff(user)) {
    return null;
  }

  const title = location.pathname.startsWith("/admin/promo-codes")
    ? t("promoCodes")
    : location.pathname.startsWith("/admin/token-usage")
    ? t("adminTokenUsage")
    : t("adminDashboard");

  return (
    <div className={"app-shell" + (isSidebarCollapsed ? " sidebar-collapsed" : "")}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      <div className="app-main">
        <Header
          title={title}
          onMenuClick={() => setIsSidebarOpen(true)}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          theme={theme}
          onThemeToggle={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        />

        <div className="admin-page-actions">
          <button type="button" className="admin-back-btn" onClick={() => navigate("/")}>
            <i className="ri-arrow-left-line" aria-hidden="true"></i>
            Back
          </button>
        </div>

        <Suspense fallback={<div className="page-content app-loading"><LogoLoader label={t("loadingPage")} /></div>}>
          <main className="page-content">
            <Outlet />
          </main>
          <Footer />
        </Suspense>
      </div>
    </div>
  );
}

export default AdminLayout;
