import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const initials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
};

const InfoRow = ({ label, value, icon }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--border-color)" }}>
    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--green-50)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  </div>
);

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate("/", { replace: true }); };

  return (
    <div style={{ animation: "fadeIn 0.4s ease", maxWidth: 600 }}>

      {/* Cover + Avatar */}
      <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-xl)", border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--shadow-md)", marginBottom: 20 }}>
        <div style={{ height: 100, background: "linear-gradient(135deg, var(--green-900), #2d6a1b)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ marginTop: -40, marginBottom: 14 }}>
            {user?.picture
              ? <img src={user.picture} alt={user.name} style={{ width: 80, height: 80, borderRadius: "50%", border: "4px solid var(--card-bg)", boxShadow: "var(--shadow-md)" }} />
              : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, var(--green-600), var(--green-800))", border: "4px solid var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700 }}>{user ? initials(user.name) : "?"}</div>
            }
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{user?.name}</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Student · Bicol University</p>
        </div>
      </div>

      {/* Info Card */}
      <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-xl)", border: "1px solid var(--card-border)", padding: "20px 24px", boxShadow: "var(--shadow-sm)", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Personal Information</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>From your Google account</p>
        <InfoRow icon="👤" label="Full Name" value={user?.name} />
        <InfoRow icon="📧" label="Email Address" value={user?.email} />
        <InfoRow icon="🏫" label="Institution" value="Bicol University" />
        <InfoRow icon="🎓" label="Role" value="Student" />
        <div style={{ paddingTop: 14 }}>
          <InfoRow icon="🔐" label="Sign-in Method" value="Google OAuth 2.0" />
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-xl)", border: "1px solid var(--card-border)", padding: "20px 24px", boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: "📚", label: "View Enrolled Classes", sub: "See all your active courses", path: "/enrolled-classes" },
            { icon: "⏳", label: "Pending Activities", sub: "Check what needs to be submitted", path: "/pending-activities" },
            { icon: "📢", label: "Announcements", sub: "Stay up to date with your classes", path: "/announcements" },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)",
              background: "var(--bg-tertiary)", cursor: "pointer", transition: "all 0.2s", textAlign: "left",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--green-50)", e.currentTarget.style.borderColor = "var(--green-200)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-tertiary)", e.currentTarget.style.borderColor = "var(--border-color)")}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.sub}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 18 }}>›</span>
            </button>
          ))}

          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: "var(--radius-md)", border: "1px solid #fee2e2",
            background: "#fff5f5", cursor: "pointer", transition: "all 0.2s", textAlign: "left", marginTop: 4,
          }}>
            <span style={{ fontSize: 20 }}>🚪</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>Sign Out</div>
              <div style={{ fontSize: 12, color: "#f87171" }}>Log out of BUPulse</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
