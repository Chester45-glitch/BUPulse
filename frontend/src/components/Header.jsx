import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const TITLES = {
  "/dashboard": "Dashboard", "/announcements": "Announcements",
  "/ask-pulsbot": "PulsBot", "/profile": "My Profile",
  "/enrolled-classes": "Enrolled Classes", "/pending-activities": "Pending Activities",
  "/schedule": "My Schedule", "/attendance": "Attendance",
  "/professor": "Dashboard", "/professor/announcements": "Announcements",
  "/professor/classes": "My Classes", "/professor/ask-pulsbot": "PulsBot",
  "/professor/profile": "My Profile", "/professor/schedule": "My Schedule",
  "/professor/attendance": "Attendance",
  "/parent": "Dashboard", "/parent/ask-pulsbot": "PulsBot", "/parent/profile": "My Profile",
};

const initials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length-1][0]}`.toUpperCase() : name.slice(0,2).toUpperCase();
};

// Clean B&W SVG icons for dropdown
const IcoProfile  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoClasses  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const IcoChat     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoClock    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoLogout   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoMoon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IcoSun      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;

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

  const menuItems = role === "professor"
    ? [
        { Icon: IcoProfile, label: "Profile",    path: "/professor/profile" },
        { Icon: IcoClasses, label: "My Classes", path: "/professor/classes" },
        { Icon: IcoChat,    label: "PulsBot",    path: "/professor/ask-pulsbot" },
      ]
    : role === "parent"
    ? [
        { Icon: IcoProfile, label: "Profile", path: "/parent/profile" },
        { Icon: IcoChat,    label: "PulsBot", path: "/parent/ask-pulsbot" },
      ]
    : [
        { Icon: IcoProfile, label: "Profile",            path: "/profile" },
        { Icon: IcoClasses, label: "Enrolled Classes",   path: "/enrolled-classes" },
        { Icon: IcoClock,   label: "Pending Activities", path: "/pending-activities" },
      ];

  return (
    <header style={{
      height: "var(--header-height)", background: "var(--header-bg)",
      borderBottom: "1px solid var(--header-border)",
      display: "flex", alignItems: "center", padding: "0 20px",
      justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30,
    }}>
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Hamburger (mobile) */}
        <button onClick={onMenuClick} className="hamburger" style={{ display: "none", flexDirection: "column", gap: 5, padding: 6, borderRadius: 6, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />
        </button>

        {/* Mobile logo */}
        <div className="mobile-logo" style={{ display: "none", alignItems: "center", gap: 8 }}>
          <img src="/Logo.png" alt="BUPulse" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>BUPulse</span>
        </div>

        <h1 className="page-title" style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
          {TITLES[pathname] || "BUPulse"}
        </h1>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Dark mode toggle */}
        <button onClick={toggle} style={{
          width: 34, height: 34, borderRadius: 8,
          border: "1px solid var(--border-color)",
          background: "var(--bg-tertiary)", color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}>
          {dark ? <IcoSun /> : <IcoMoon />}
        </button>

        {/* User dropdown */}
        <div ref={dropRef} style={{ position: "relative" }}>
          <button onClick={() => setDropOpen(p => !p)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 10px 4px 4px", borderRadius: 99,
            border: "1px solid var(--border-color)",
            background: "var(--card-bg)",
            cursor: "pointer",
          }}>
            {user?.picture
              ? <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
              : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--card-bg)", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{user ? initials(user.name) : "?"}</div>
            }
            <span className="user-name" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.name?.split(" ")[0] || "User"}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {dropOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)",
              background: "var(--card-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: 12, boxShadow: "var(--shadow-xl)",
              minWidth: 200, overflow: "hidden",
              animation: "dropIn 0.15s ease",
              zIndex: 100,
            }}>
              {/* User info header */}
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user?.picture
                    ? <img src={user.picture} alt={user.name} style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
                    : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--card-bg)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{user ? initials(user.name) : "?"}</div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: "4px" }}>
                {menuItems.map(item => (
                  <button key={item.path} onClick={() => { navigate(item.path); setDropOpen(false); }} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8,
                    color: "var(--text-secondary)", fontSize: 13.5,
                    cursor: "pointer", background: "none",
                    border: "none", textAlign: "left",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-tertiary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <span style={{ color: "var(--text-muted)", display: "flex" }}><item.Icon /></span>
                    {item.label}
                  </button>
                ))}

                <div style={{ height: 1, background: "var(--border-color)", margin: "4px 0" }} />

                <button onClick={handleLogout} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8,
                  color: "#dc2626", fontSize: 13.5,
                  cursor: "pointer", background: "none",
                  border: "none", textAlign: "left",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fff5f5"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <span style={{ display: "flex" }}><IcoLogout /></span>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
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
