import { useState, useRef, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

/* ── Monochrome icon set ─────────────────────────────────────────── */
const Icon = ({ d, d2 }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

const Icons = {
  grid:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  bell:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  book:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  clock:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chat:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  user:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  logout:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  moon:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
};

const NAV_ITEMS = {
  student:   [
    { to: "/dashboard",          Icon: Icons.grid,  label: "Dashboard" },
    { to: "/announcements",      Icon: Icons.bell,  label: "Announcements" },
    { to: "/enrolled-classes",   Icon: Icons.book,  label: "My Classes" },
    { to: "/pending-activities", Icon: Icons.clock, label: "Pending" },
    { to: "/ask-pulsbot",        Icon: Icons.chat,  label: "Ask PulsBot" },
  ],
  professor: [
    { to: "/professor",              Icon: Icons.grid, label: "Dashboard" },
    { to: "/professor/announcements",Icon: Icons.bell, label: "Announcements" },
  ],
  parent:    [
    { to: "/parent", Icon: Icons.grid, label: "Dashboard" },
  ],
};

const ROLE_ACCENT = { student: "#4ade80", professor: "#60a5fa", parent: "#c084fc" };

const initials = (n = "") => {
  const p = n.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

/* ── NavItem ─────────────────────────────────────────────────────── */
function NavItem({ to, Icon: I, label, end, expanded, accent, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} style={{ display: "block", textDecoration: "none", marginBottom: 2 }}>
      {({ isActive }) => (
        <div
          className="sb-item"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 10,
            color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
            background: isActive ? "rgba(255,255,255,0.09)" : "transparent",
            borderLeft: `3px solid ${isActive ? accent : "transparent"}`,
            transition: "all 0.15s ease",
            whiteSpace: "nowrap", overflow: "hidden",
            position: "relative",
          }}
        >
          <span style={{ flexShrink: 0, width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><I /></span>
          <span style={{ fontSize: 13.5, fontWeight: isActive ? 600 : 400, opacity: expanded ? 1 : 0, transition: "opacity 0.18s" }}>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
export default function Sidebar({ isOpen, onClose, user, role = "student" }) {
  const { dark, toggle: toggleDark } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const timer = useRef(null);

  const onEnter = useCallback(() => { clearTimeout(timer.current); setExpanded(true); }, []);
  const onLeave = useCallback(() => { timer.current = setTimeout(() => setExpanded(false), 280); }, []);

  const navItems = NAV_ITEMS[role] || NAV_ITEMS.student;
  const accent   = ROLE_ACCENT[role] || ROLE_ACCENT.student;

  const handleLogout = async () => { await logout(); navigate("/", { replace: true }); };

  return (
    <>
      {isOpen && <div className="sb-overlay" onClick={onClose} />}

      <aside
        className={`sb-root ${isOpen ? "sb-open" : ""}`}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        aria-label="Sidebar navigation"
        style={{ "--accent": accent }}
      >
        {/* Logo row */}
        <div className="sb-logo">
          <div className="sb-logo-icon">📚</div>
          <div className={`sb-fade ${expanded ? "sb-visible" : ""}`}>
            <span className="sb-logo-text">BUPulse</span>
            <span className="sb-role-badge">{role}</span>
          </div>
          <button className="sb-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Nav */}
        <nav className="sb-nav" aria-label="Primary">
          {navItems.map(item => (
            <NavItem key={item.to} {...item} end={item.to === "/professor" || item.to === "/parent"} expanded={expanded} accent={accent} onClick={onClose} />
          ))}

          <div className="sb-divider" />

          <NavItem to="/profile" Icon={Icons.user} label="Profile" expanded={expanded} accent={accent} onClick={onClose} />
        </nav>

        {/* Bottom utilities */}
        <div className="sb-bottom">
          <button className="sb-util-btn" onClick={toggleDark} aria-label="Toggle theme">
            <span className="sb-util-icon">{dark ? <Icons.sun /> : <Icons.moon />}</span>
            <span className={`sb-fade sb-util-label ${expanded ? "sb-visible" : ""}`}>{dark ? "Light mode" : "Dark mode"}</span>
          </button>

          <button className="sb-util-btn sb-logout-btn" onClick={handleLogout} aria-label="Sign out">
            <span className="sb-util-icon"><Icons.logout /></span>
            <span className={`sb-fade sb-util-label ${expanded ? "sb-visible" : ""}`}>Sign out</span>
          </button>

          {/* User chip */}
          <div className="sb-user-chip">
            {user?.picture
              ? <img src={user.picture} alt={user.name} className="sb-avatar" />
              : <div className="sb-avatar sb-avatar-initials" style={{ background: `${accent}25`, color: accent, borderColor: `${accent}40` }}>{user ? initials(user.name) : "?"}</div>
            }
            <div className={`sb-fade sb-user-info ${expanded ? "sb-visible" : ""}`}>
              <span className="sb-user-name">{user?.name || "User"}</span>
              <span className="sb-user-email">{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>

      <style>{`
        .sb-root {
          width: 64px;
          min-height: 100vh;
          height: 100%;
          position: fixed; left: 0; top: 0; bottom: 0;
          display: flex; flex-direction: column;
          background: #111a11;
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 50;
          transition: width 0.24s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        .sb-root:hover, .sb-root.sb-open { width: 220px; }

        .sb-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(2px);
          z-index: 40;
          display: none;
        }

        /* Logo */
        .sb-logo {
          height: 62px; flex-shrink: 0;
          display: flex; align-items: center;
          padding: 0 16px; gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .sb-logo-icon {
          width: 32px; height: 32px; flex-shrink: 0;
          border-radius: 9px;
          background: linear-gradient(135deg, #d4820a, #f59e0b);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }
        .sb-logo-text { color: #fff; font-size: 17px; font-family: var(--font-display, serif); display: block; line-height: 1.1; }
        .sb-role-badge {
          font-size: 9px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: var(--accent); line-height: 1;
        }
        .sb-close-btn {
          display: none; margin-left: auto;
          width: 24px; height: 24px; border-radius: 6px;
          background: rgba(255,255,255,0.08); border: none;
          color: rgba(255,255,255,0.6); cursor: pointer; font-size: 13px;
        }

        /* Nav */
        .sb-nav {
          flex: 1; padding: 12px 8px;
          overflow-y: auto; overflow-x: hidden;
        }
        .sb-nav::-webkit-scrollbar { width: 0; }
        .sb-item:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.8) !important; }
        .sb-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 4px; }

        /* Fade utility */
        .sb-fade { opacity: 0; transform: translateX(-6px); transition: opacity 0.18s ease, transform 0.18s ease; white-space: nowrap; overflow: hidden; pointer-events: none; }
        .sb-fade.sb-visible { opacity: 1; transform: translateX(0); pointer-events: auto; }

        /* Bottom */
        .sb-bottom {
          flex-shrink: 0; padding: 8px 8px 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column; gap: 2px;
        }
        .sb-util-btn {
          display: flex; align-items: center; gap: 12;
          padding: 10px 12px; border-radius: 10px;
          background: transparent; border: none; cursor: pointer;
          color: rgba(255,255,255,0.5);
          transition: all 0.15s; width: 100%;
          white-space: nowrap; overflow: hidden;
        }
        .sb-util-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
        .sb-util-icon { flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
        .sb-util-label { font-size: 13.5px; }
        .sb-logout-btn { color: rgba(248, 113, 113, 0.65); }
        .sb-logout-btn:hover { background: rgba(220,38,38,0.1) !important; color: #f87171 !important; }

        /* User chip */
        .sb-user-chip {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 8px 4px; margin-top: 4px;
          border-top: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .sb-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.12); object-fit: cover; }
        .sb-avatar-initials { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
        .sb-user-info { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
        .sb-user-name { color: #fff; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-user-email { color: rgba(255,255,255,0.38); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Mobile */
        @media (max-width: 768px) {
          .sb-root { width: 220px !important; transform: translateX(-100%); transition: transform 0.28s ease; }
          .sb-root.sb-open { transform: translateX(0); }
          .sb-overlay { display: block; }
          .sb-close-btn { display: flex !important; align-items: center; justify-content: center; }
          .sb-fade { opacity: 1 !important; transform: translateX(0) !important; }
        }
      `}</style>
    </>
  );
}
