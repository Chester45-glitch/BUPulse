import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const TITLES = {
  // Student
  "/dashboard":          "Dashboard",
  "/announcements":      "Announcements",
  "/ask-pulsbot":        "PulsBot",
  "/profile":            "My Profile",
  "/enrolled-classes":   "Enrolled Classes",
  "/pending-activities": "Pending Activities",
  "/schedule":           "My Schedule",
  "/attendance":         "Attendance",
  // Professor
  "/professor":                    "Dashboard",
  "/professor/announcements":      "Announcements",
  "/professor/classes":            "My Classes",
  "/professor/ask-pulsbot":        "PulsBot",
  "/professor/profile":            "My Profile",
  "/professor/schedule":           "My Schedule",
  "/professor/attendance":         "Attendance",
  // Parent
  "/parent":             "Dashboard",
  "/parent/ask-pulsbot": "PulsBot",
  "/parent/profile":     "My Profile",
};

const initials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export default function Header({ onMenuClick, role = "student" }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => { setDropOpen(false); await logout(); navigate("/", { replace: true }); };

  // Role-aware dropdown items — professors and parents get their own scoped paths
  const menuItems = role === "professor"
    ? [
        { icon: "👤", label: "Profile",     path: "/professor/profile" },
        { icon: "📚", label: "My Classes",  path: "/professor/classes" },
        { icon: "💬", label: "PulsBot",     path: "/professor/ask-pulsbot" },
      ]
    : role === "parent"
    ? [
        { icon: "👤", label: "Profile",     path: "/parent/profile" },
        { icon: "💬", label: "PulsBot",     path: "/parent/ask-pulsbot" },
      ]
    : [
        { icon: "👤", label: "Profile",             path: "/profile" },
        { icon: "📚", label: "Enrolled Classes",    path: "/enrolled-classes" },
        { icon: "⏳", label: "Pending Activities",  path: "/pending-activities" },
      ];

  return (
    <header style={{
      height: "var(--header-height)", background: "var(--header-bg)",
      borderBottom: "1px solid var(--header-border)",
      display: "flex", alignItems: "center", padding: "0 20px",
      justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30,
      transition: "background 0.3s ease, border-color 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Hamburger */}
        <button onClick={onMenuClick} className="hamburger" style={{ display: "none", flexDirection: "column", gap: 5, padding: 6, borderRadius: "var(--radius-sm)" }}>
          <div style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />
        </button>

        {/* Mobile logo */}
        <div className="mobile-logo" style={{ display: "none", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, var(--accent-gold), var(--accent-amber))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📚</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text-primary)" }}>BUPulse</span>
        </div>

        <h1 className="page-title" style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{TITLES[pathname] || "BUPulse"}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Dark mode toggle */}
        <button onClick={toggle} style={{
          width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border-color)",
          background: "var(--bg-tertiary)", color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.2s",
        }}>
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* User dropdown */}
        <div ref={dropRef} style={{ position: "relative" }}>
          <button onClick={() => setDropOpen(p => !p)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 10px 5px 5px", borderRadius: 99,
            border: `1px solid ${dropOpen ? "var(--green-600)" : "var(--border-color)"}`,
            background: dropOpen ? "var(--green-50)" : "var(--card-bg)",
            cursor: "pointer", transition: "all 0.2s",
          }}>
            {user?.picture
              ? <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
              : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--green-700)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{user ? initials(user.name) : "?"}</div>
            }
            <span className="user-name" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name?.split(" ")[0] || "User"}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)",
              background: "var(--dropdown-bg)", border: "1px solid var(--dropdown-border)",
              borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xl)",
              minWidth: 220, overflow: "hidden", animation: "fadeInScale 0.15s ease",
              zIndex: 100,
            }}>
              {/* User info */}
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-tertiary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user?.picture
                    ? <img src={user.picture} alt={user.name} style={{ width: 38, height: 38, borderRadius: "50%" }} />
                    : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--green-700)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>{user ? initials(user.name) : "?"}</div>
                  }
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user?.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user?.email}</div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: "6px" }}>
                {menuItems.map(item => (
                  <button key={item.path} onClick={() => { navigate(item.path); setDropOpen(false); }} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: "var(--radius-md)",
                    color: "var(--text-secondary)", fontSize: 14, cursor: "pointer",
                    background: "none", transition: "background 0.15s", textAlign: "left",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--hover-bg)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}

                <div style={{ height: 1, background: "var(--border-color)", margin: "6px 0" }} />

                <button onClick={handleLogout} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: "var(--radius-md)",
                  color: "#dc2626", fontSize: 14, cursor: "pointer",
                  background: "none", transition: "background 0.15s", textAlign: "left",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontSize: 16 }}>🚪</span>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hamburger { display: flex !important; }
          .mobile-logo { display: flex !important; }
          .page-title { display: none !important; }
          .user-name { display: none !important; }
        }
      `}</style>
    </header>
  );
}
