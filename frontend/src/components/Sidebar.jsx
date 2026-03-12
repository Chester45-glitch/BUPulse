import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", icon: "⊞", label: "Dashboard" },
  { to: "/announcements", icon: "📢", label: "Announcements" },
  { to: "/ask-pulsbot", icon: "💬", label: "Ask PulsBot" },
];

const initials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function Sidebar({ isOpen, onClose, user }) {
  return (
    <>
      <aside style={{
        width: "var(--sidebar-width)", height: "100vh",
        position: "fixed", left: 0, top: 0,
        background: "var(--sidebar-bg, #1a2e1a)",
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        zIndex: 50, transition: "transform 0.3s ease",
      }} className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>

        {/* Logo */}
        <div style={{ padding: "18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, var(--accent-gold), var(--accent-amber))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📚</div>
            <span style={{ fontFamily: "var(--font-display)", color: "#fff", fontSize: 19 }}>BUPulse</span>
          </div>
          <button onClick={onClose} className="sidebar-close" style={{ color: "var(--green-200)", fontSize: 18, padding: 4, display: "none" }}>✕</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "14px 10px", overflowY: "auto" }}>
          <p style={{ color: "rgba(168,197,160,0.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", padding: "0 10px", marginBottom: 8 }}>Menu</p>

          {navItems.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose} style={{ display: "block", marginBottom: 2 }}>
              {({ isActive }) => (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                  borderRadius: "var(--radius-md)",
                  background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                  color: isActive ? "#fff" : "var(--green-200)",
                  fontSize: 14, fontWeight: isActive ? 600 : 400, transition: "all 0.15s",
                  borderLeft: isActive ? "3px solid var(--accent-gold)" : "3px solid transparent",
                }}>
                  <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{icon}</span>
                  {label}
                </div>
              )}
            </NavLink>
          ))}

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "14px 0" }} />
          <p style={{ color: "rgba(168,197,160,0.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", padding: "0 10px", marginBottom: 8 }}>My Account</p>

          {[
            { to: "/profile", icon: "👤", label: "Profile" },
            { to: "/enrolled-classes", icon: "📚", label: "Enrolled Classes" },
            { to: "/pending-activities", icon: "⏳", label: "Pending Activities" },
          ].map(({ to, icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose} style={{ display: "block", marginBottom: 2 }}>
              {({ isActive }) => (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                  borderRadius: "var(--radius-md)",
                  background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                  color: isActive ? "#fff" : "var(--green-200)",
                  fontSize: 14, fontWeight: isActive ? 600 : 400, transition: "all 0.15s",
                  borderLeft: isActive ? "3px solid var(--accent-gold)" : "3px solid transparent",
                }}>
                  <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{icon}</span>
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          {user?.picture
            ? <img src={user.picture} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--green-700)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{user ? initials(user.name) : "?"}</div>
          }
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "User"}</div>
            <div style={{ color: "var(--green-200)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email || "Student"}</div>
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar-open { transform: translateX(0) !important; }
          .sidebar-close { display: block !important; }
        }
      `}</style>
    </>
  );
}
