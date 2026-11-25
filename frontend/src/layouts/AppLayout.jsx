import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ScanLine,
  Utensils,
  History,
  ChartNoAxesCombined,
  Target,
  Droplets,
  Sparkles,
  ChefHat,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
  ShieldCheck,
  Leaf,
  Sun,
  Moon,
} from "lucide-react";
import Brand from "../components/Brand";
import { useAuth } from "../contexts/AuthContext";
import { useRealtime } from "../hooks/useRealtime";
import { Button } from "../components/ui";

const mainNav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/scan", label: "Scan a meal", icon: ScanLine, tag: "AI" },
  { to: "/tracker", label: "Daily tracker", icon: Utensils },
  { to: "/history", label: "Food journal", icon: History },
  { to: "/analytics", label: "Insights", icon: ChartNoAxesCombined },
];
const wellnessNav = [
  { to: "/goals", label: "My goals", icon: Target },
  { to: "/water", label: "Hydration", icon: Droplets },
  { to: "/recipes", label: "Recipe inspiration", icon: ChefHat },
  { to: "/assistant", label: "Nutrition assistant", icon: Sparkles },
];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [locale, setLocale] = useState(
    () => localStorage.getItem("nutrivision-language") || "en",
  );
  const [dark, setDark] = useState(
    localStorage.getItem("nutrivision-theme") === "dark",
  );
  const location = useLocation();
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useRealtime(user);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const sync = () => {
      const theme = localStorage.getItem("nutrivision-theme") || "light";
      document.body.dataset.theme = theme;
      setDark(theme === "dark");
      const language =
        localStorage.getItem("nutrivision-language") ||
        user?.profile?.locale ||
        "en";
      setLocale(language);
      document.documentElement.lang = language;
    };
    sync();
    window.addEventListener("preferences-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("preferences-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function toggleTheme() {
    localStorage.setItem("nutrivision-theme", dark ? "light" : "dark");
    window.dispatchEvent(new Event("preferences-change"));
  }
  const name = user?.full_name || "My account";
  const hi = locale === "hi";
  const labels = {
    Overview: "आज का सारांश",
    "Scan a meal": "भोजन स्कैन करें",
    "Daily tracker": "दैनिक पोषण",
    "Food journal": "भोजन डायरी",
    Insights: "पोषण विश्लेषण",
    "My goals": "मेरे लक्ष्य",
    Hydration: "पानी का सेवन",
    "Recipe inspiration": "व्यंजन सुझाव",
    "Nutrition assistant": "पोषण सहायक",
    Administration: "प्रशासन",
    Settings: "सेटिंग्स",
  };
  const renderLink = ({ to, label, icon: Icon, tag }) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      <Icon size={19} strokeWidth={1.75} />
      <span>{hi ? labels[label] || label : label}</span>
      {tag && <span className="nav-tag">{tag}</span>}
    </NavLink>
  );
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        inert={mobile && !open ? true : undefined}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={22} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-dot" /> My wellness space{" "}
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-caption">YOUR NUTRITION</p>
          {mainNav.map(renderLink)}
          <p className="nav-caption wellness-caption">FEEL YOUR BEST</p>
          {wellnessNav.map(renderLink)}
          {user?.is_staff &&
            renderLink({
              to: "/admin",
              label: "Administration",
              icon: ShieldCheck,
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Leaf size={18} />
            </span>
            <p>
              Small habits.
              <br />
              <strong>Healthier you.</strong>
            </p>
            <Link to="/goals" aria-label="Set your nutrition goals">
              <ArrowUpRight size={21} />
            </Link>
          </div>
          {renderLink({ to: "/settings", label: "Settings", icon: Settings })}
          <div className="sidebar-user">
            <Link
              to="/profile"
              className="user-avatar"
              aria-label="Your profile"
            >
              {name[0]?.toUpperCase()}
            </Link>
            <Link to="/profile" className="user-details">
              <strong>{name}</strong>
              <span>Your personal space</span>
            </Link>
            <button
              className="icon-button"
              aria-label="Log out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={23} />
            </button>
            <Leaf size={16} />
            <span>A little better, every day</span>
          </div>
          <div className="topbar-actions">
            <span className="private-badge">
              <ShieldCheck size={14} /> Your health, your space
            </span>
            <button
              className="icon-button theme-button"
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              className="topbar-avatar"
              to="/profile"
              aria-label="Open profile"
            >
              {name[0]?.toUpperCase()}
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Made for a healthier everyday.</span>
          <span>
            NutriVision AI <span className="footer-dot">•</span> Nutrition with
            a little more clarity
          </span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[mainNav[0], mainNav[1], mainNav[3], wellnessNav[0]].map(
          ({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={hi ? labels[label] || label : label}
            >
              <Icon size={21} />
              <span>
                {hi
                  ? {
                      Overview: "आज",
                      "Scan a meal": "स्कैन",
                      "Food journal": "डायरी",
                      "My goals": "लक्ष्य",
                    }[label]
                  : label === "Overview"
                    ? "Home"
                    : label === "Scan a meal"
                      ? "Scan"
                      : label === "Food journal"
                        ? "Journal"
                        : "Goals"}
              </span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}
