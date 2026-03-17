import { useState, useEffect } from "react";
import api from "../utils/api";

const ROLES = [
  { id: "student", icon: "🎓", label: "Student", desc: "View classes, deadlines & announcements" },
  { id: "professor", icon: "👨‍🏫", label: "Professor", desc: "Manage classes & post announcements" },
  { id: "parent", icon: "👨‍👩‍👧", label: "Parent", desc: "Monitor your child's progress" },
];

export default function Login() {
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setError("Login failed. Please try again.");
  }, []);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google?role=${role}`;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "var(--font-body)" }}>

      {/* Left panel */}
      <div style={{
        width: "45%", background: "linear-gradient(160deg, #0f2010 0%, #1a3a1a 60%, #1e4d1e 100%)",
        display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px",
        position: "relative", overflow: "hidden",
      }} className="login-left">
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, #fff 1.5px, transparent 1.5px)", backgroundSize: "32px 32px" }} />
        <div style={{ position: "relative" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 56 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #d4820a, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📚</div>
            <span style={{ fontFamily: "var(--font-display)", color: "#fff", fontSize: 22 }}>BUPulse</span>
          </div>

          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,4vw,44px)", color: "#fff", lineHeight: 1.15, marginBottom: 24 }}>
            The right message,<br />
            to the <span style={{ color: "#f59e0b" }}>right person,</span><br />
            at the right time.
          </h1>
          <p style={{ color: "#a8c5a0", fontSize: 15, lineHeight: 1.7, marginBottom: 40, maxWidth: 400 }}>
            A smart school communication platform. Students see their deadlines. Parents get updates. Nothing important gets missed.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["🎯 Targeted Announcements", "👨‍👩‍👧 Parent Alerts", "📅 Student Deadlines", "⚡ Priority Messaging"].map(f => (
              <span key={f} style={{ background: "rgba(255,255,255,0.08)", color: "#d4e8cc", fontSize: 13, padding: "7px 14px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.1)" }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: "#f8faf8", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }} className="login-right">
        <div style={{ width: "100%", maxWidth: 420 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "#111827", marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>Sign in to your BUPulse account</p>

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>⚠️ {error}</div>
          )}

          {/* Role selector */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>I am a...</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ROLES.map(r => (
                <div key={r.id} onClick={() => setRole(r.id)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 12, cursor: "pointer", transition: "all 0.15s",
                  border: `2px solid ${role === r.id ? "#2d5a1b" : "#e5e7eb"}`,
                  background: role === r.id ? "#f0f7ee" : "#fff",
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: role === r.id ? "#2d5a1b" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, transition: "all 0.15s" }}>{r.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: role === r.id ? "#1a2e1a" : "#374151" }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{r.desc}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${role === r.id ? "#2d5a1b" : "#d1d5db"}`, background: role === r.id ? "#2d5a1b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {role === r.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Google login button */}
          <button onClick={handleLogin} disabled={loading} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12, padding: "14px 20px", borderRadius: 12,
            border: "1.5px solid #e5e7eb", background: loading ? "#f9fafb" : "#fff",
            fontSize: 15, fontWeight: 600, color: "#374151", cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 16,
          }}
            onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = "#2d5a1b", e.currentTarget.style.background = "#f9fffa")}
            onMouseLeave={e => !loading && (e.currentTarget.style.borderColor = "#e5e7eb", e.currentTarget.style.background = "#fff")}
          >
            {loading ? (
              <div style={{ width: 20, height: 20, border: "2px solid #d1d5db", borderTopColor: "#2d5a1b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            )}
            {loading ? "Redirecting..." : `Continue with Google (BU Email)`}
          </button>

          <div style={{ background: "#f0f7ee", border: "1px solid #d4e8cc", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2d5a1b", marginBottom: 4 }}>🔒 Secure Sign-In</div>
            <p style={{ fontSize: 12, color: "#4a8a2a", lineHeight: 1.5 }}>
              Use your official school email (@bulsu.edu.ph) to access BUPulse. No password needed.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right { padding: 24px 20px !important; }
        }
      `}</style>
    </div>
  );
}
