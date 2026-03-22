import { useState, useRef, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

/* ── Icons ─────────────────────────────────────────────────── */
const Ico = ({ children }) => (
  <span style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}>
    {children}
  </span>
);

const Icons = {
  grid: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  bell: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  book: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  clock: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chat: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  user: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  logout: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  moon: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  sun: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  switch: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  calendar: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

const NAV_ITEMS = {
  student: [
    { to: "/dashboard",          Icon: Icons.grid,     label: "Dashboard" },
    { to: "/announcements",      Icon: Icons.bell,     label: "Announcements" },
    { to: "/enrolled-classes",   Icon: Icons.book,     label: "My Classes" },
    { to: "/pending-activities", Icon: Icons.clock,    label: "Pending" },
    { to: "/schedule",           Icon: Icons.calendar, label: "Schedule" },
    { to: "/attendance",         Icon: Icons.users,    label: "Attendance" },
    { to: "/ask-pulsbot",        Icon: Icons.chat,     label: "Ask PulsBot" },
    { to: "/profile",            Icon: Icons.user,     label: "Profile" },
  ],
  professor: [
    { to: "/professor",                    Icon: Icons.grid,     label: "Dashboard" },
    { to: "/professor/announcements",      Icon: Icons.bell,     label: "Announcements" },
    { to: "/professor/classes",            Icon: Icons.book,     label: "My Classes" },
    { to: "/professor/schedule",           Icon: Icons.calendar, label: "Schedule" },
    { to: "/professor/attendance",         Icon: Icons.users,    label: "Attendance" },
    { to: "/professor/ask-pulsbot",        Icon: Icons.chat,     label: "PulsBot" },
    { to: "/professor/profile",            Icon: Icons.user,     label: "Profile" },
  ],
  parent: [
    { to: "/parent",             Icon: Icons.grid,  label: "Dashboard" },
    { to: "/parent/ask-pulsbot", Icon: Icons.chat,  label: "PulsBot" },
    { to: "/parent/profile",     Icon: Icons.user,  label: "Profile" },
  ],
};

const ROLE_ACCENT = { student: "#4ade80", professor: "#60a5fa", parent: "#c084fc" };

const initials = (n = "") => {
  const p = n.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

const Avatar = ({ user, size = 36, accent }) => (
  user?.picture
    ? <img src={user.picture} alt={user.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid rgba(255,255,255,0.12)` }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: `${accent}25`, border: `2px solid ${accent}40`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, flexShrink: 0 }}>
        {user ? initials(user.name) : "?"}
      </div>
);

/* ── Account Switcher Panel ──────────────────────────────────── */
function AccountSwitcher({ user, accent, onClose }) {
  // Saved accounts from localStorage
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("bp_accounts") || "[]"); } catch { return []; }
  })();

  const handleSwitchAccount = () => {
    // Redirect to login to add another account
    window.location.href = "/";
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: "calc(100% + 8px)",
      background: "var(--dropdown-bg, #1e2e1e)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16, boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
      width: 260, overflow: "hidden", zIndex: 200,
      animation: "scaleIn 0.18s ease",
    }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Logged In</p>
        {/* Current account */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 6 }}>
          <Avatar user={user} size={38} accent={accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</p>
          </div>
          <span style={{ color: accent, flexShrink: 0 }}><Icons.check /></span>
        </div>
      </div>

      <div style={{ padding: "8px" }}>
        <button
          onClick={handleSwitchAccount}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10, background: "transparent",
            color: "rgba(255,255,255,0.6)", border: "none", cursor: "pointer",
            fontSize: 13.5, transition: "background 0.12s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed rgba(255,255,255,0.2)", flexShrink: 0 }}>
            <Icons.plus />
          </div>
          <span>Add another account</span>
        </button>
      </div>
    </div>
  );
}

/* ── NavItem ──────────────────────────────────────────────────── */
function NavItem({ to, Icon, label, end, expanded, accent, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} style={{ display: "block", textDecoration: "none" }}>
      {({ isActive }) => (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "4px 8px", borderRadius: 14, cursor: "pointer",
            color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
            background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
            borderLeft: `3px solid ${isActive ? accent : "transparent"}`,
            transition: "all 0.15s ease", marginBottom: 2, overflow: "hidden",
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
        >
          {/* Icon bubble — Facebook-style filled bg on hover/active */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isActive ? `${accent}22` : "rgba(255,255,255,0.04)",
            color: isActive ? accent : "rgba(255,255,255,0.65)",
            transition: "all 0.15s",
          }}>
            <Icon />
          </div>

          <span style={{
            fontSize: 14, fontWeight: isActive ? 600 : 400,
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.18s ease",
            whiteSpace: "nowrap",
          }}>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────── */
export default function Sidebar({ isOpen, onClose, user, role = "student" }) {
  const { dark, toggle: toggleDark } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const timer = useRef(null);
  const switcherRef = useRef(null);

  const onEnter = useCallback(() => { clearTimeout(timer.current); setExpanded(true); }, []);
  const onLeave = useCallback(() => { timer.current = setTimeout(() => { setExpanded(false); setSwitcherOpen(false); }, 300); }, []);

  // On mobile, when the sidebar is opened via hamburger, force expanded so labels show
  const isExpanded = expanded || isOpen;

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
        aria-label="Main navigation"
        style={{ "--accent": accent }}
      >
        {/* ── Logo + account switcher ───────────────────── */}
        <div style={{ padding: "12px 8px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, overflow: "hidden", position: "relative" }}>
          {/* Logo icon — bigger, centered when collapsed */}
          <div style={{ width: 52, height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/Logo.png" alt="BUPulse" style={{ width: 52, height: 52, objectFit: "contain" }} />
          </div>

          {/* Brand + role */}
          <div style={{ opacity: isExpanded ? 1 : 0, transform: isExpanded ? "translateX(0)" : "translateX(-8px)", transition: "all 0.18s ease", flex: 1, minWidth: 0, overflow: "hidden" }}>
            <span className="bupulse-brand-text" style={{ fontSize: 17, fontFamily: "var(--font-display, serif)", fontWeight: 700, display: "block", lineHeight: 1.2 }}>BUPulse</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: accent }}>{role}</span>
          </div>

          {/* Account switcher button */}
          <div ref={switcherRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              aria-label="Switch account"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: switcherOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.5)", transition: "all 0.14s",
                opacity: isExpanded ? 1 : 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
              onMouseLeave={e => { if (!switcherOpen) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              <Icons.switch />
            </button>

            {switcherOpen && isExpanded && (
              <AccountSwitcher user={user} accent={accent} onClose={() => setSwitcherOpen(false)} />
            )}
          </div>
        </div>

        {/* ── Nav items ─────────────────────────────────── */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto", overflowX: "hidden" }} aria-label="Primary">
          {navItems.map(item => (
            <NavItem
              key={item.to}
              {...item}
              end={item.to === "/professor" || item.to === "/parent"}
              expanded={isExpanded}
              accent={accent}
              onClick={onClose}
            />
          ))}
        </nav>

        {/* ── Bottom utilities ──────────────────────────── */}
        <div style={{ padding: "8px 8px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>

          {/* Logout */}
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "4px 8px", borderRadius: 14, background: "transparent",
              border: "none", cursor: "pointer", color: "rgba(248,113,113,0.65)",
              transition: "all 0.14s", width: "100%", overflow: "hidden",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.08)", e.currentTarget.style.color = "#f87171")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(248,113,113,0.65)")}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(220,38,38,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icons.logout />
            </div>
            <span style={{ fontSize: 14, whiteSpace: "nowrap", opacity: isExpanded ? 1 : 0, transition: "opacity 0.18s" }}>Sign out</span>
          </button>

          {/* User chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4, overflow: "hidden" }}>
            <Avatar user={user} size={36} accent={accent} />
            <div style={{ opacity: isExpanded ? 1 : 0, transition: "opacity 0.18s", minWidth: 0 }}>
              <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "User"}</p>
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <style>{`
        .sb-root {
          width: 72px;
          min-height: 100vh; height: 100%;
          position: fixed; left: 0; top: 0; bottom: 0;
          display: flex; flex-direction: column;
          background: #111a11;
          border-right: 1px solid rgba(255,255,255,0.06);
          z-index: 50;
          transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        .sb-root:hover { width: 240px; }
        .sb-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
          z-index: 40; display: none;
        }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.92) translateY(-4px); } to { opacity:1; transform:scale(1) translateY(0); } }

        /* BUPulse gradient text fade animation */
        @keyframes brandGradient {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .bupulse-brand-text {
          background: linear-gradient(90deg, #4ade80, #22d3ee, #3b82f6, #06b6d4, #4ade80);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: brandGradient 4s ease infinite;
        }

        @media (max-width: 768px) {
          .sb-root { width: 240px !important; transform: translateX(-100%); transition: transform 0.28s ease; }
          .sb-root.sb-open { transform: translateX(0); }
          .sb-overlay { display: block; }
        }
      `}</style>
    </>
  );
}
