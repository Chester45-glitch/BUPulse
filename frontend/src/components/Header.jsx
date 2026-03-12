import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TITLES = {
  "/dashboard": "Dashboard",
  "/announcements": "Announcements",
  "/ask-pulsbot": "Ask PulsBot",
};

const initials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <header style={{
      height: "var(--header-height)",
      background: "var(--white)",
      borderBottom: "1px solid var(--gray-200)",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 10,
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Hamburger - mobile only */}
        <button
          onClick={onMenuClick}
          className="hamburger"
          style={{
            display: "none",
            flexDirection: "column",
            gap: 5,
            padding: 6,
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div style={{ width: 20, height: 2, background: "var(--gray-700)", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "var(--gray-700)", borderRadius: 2 }} />
          <div style={{ width: 20, height: 2, background: "var(--gray-700)", borderRadius: 2 }} />
        </button>

        {/* Logo - mobile only */}
        <div className="mobile-logo" style={{ display: "none", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, var(--accent-gold), var(--accent-amber))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📚</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>BUPulse</span>
        </div>

        <h1 className="page-title" style={{ fontSize: 17, fontWeight: 600 }}>{TITLES[pathname] || "BUPulse"}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {user?.picture
          ? <img src={user.picture} alt={user.name} style={{ width: 32, height: 32, borderRadius: "50%" }} />
          : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--green-700)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--white)", fontSize: 12, fontWeight: 700 }}>{user ? initials(user.name) : "?"}</div>
        }
        <span className="user-name" style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)" }}>{user?.name?.split(" ")[0] || "User"}</span>
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
