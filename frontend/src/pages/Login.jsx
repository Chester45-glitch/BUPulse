import { useState, useEffect } from "react";

const StudentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const ProfessorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);
const ParentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const ROLES = [
  { id: "student",   Icon: StudentIcon,   label: "Student",   desc: "View classes, deadlines & announcements" },
  { id: "professor", Icon: ProfessorIcon, label: "Professor", desc: "Post announcements & manage classes" },
  { id: "parent",    Icon: ParentIcon,    label: "Parent",    desc: "Monitor your child's academic progress" },
];

const FEATURES = [
  { path: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0", label: "Targeted announcements" },
  { path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2", label: "Deadline tracking" },
  { path: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", label: "Parent monitoring" },
  { path: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", label: "AI-powered PulsBot" },
];

export default function Login() {
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("error")) setError("Login failed. Please try again.");
  }, []);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google?role=${role}`;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "var(--font-body, system-ui, sans-serif)" }}>
      {/* ── Left panel ── */}
      <div style={{
        width: "44%", background: "#0f1f0f",
        display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
      }} className="login-left">
        {/* Dot grid overlay */}
        <div style={{ position: "absolute", inset: 0, opacity: 1, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />
        {/* Glow */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 55% at 30% 40%, rgba(74,222,128,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", flex: 1, padding: "48px 52px 40px", display: "flex", flexDirection: "column" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 56 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#d4820a,#f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📚</div>
            <span style={{ color: "#fff", fontSize: 19, fontFamily: "var(--font-display, serif)", fontWeight: 600 }}>BUPulse</span>
          </div>

          <h1 style={{ color: "#fff", fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 700, lineHeight: 1.2, marginBottom: 14, fontFamily: "var(--font-display, serif)", letterSpacing: "-0.4px" }}>
            Smart communication<br />for modern campuses.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 14.5, lineHeight: 1.7, marginBottom: 40, maxWidth: 360 }}>
            Connect students, professors, and parents through one unified academic hub.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 33, height: 33, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {f.path.split("M").filter(Boolean).map((d, j) => <path key={j} d={"M" + d} />)}
                  </svg>
                </div>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — FIXED: Bicol University Polangui */}
        <div style={{ position: "relative", padding: "16px 52px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.27)", fontSize: 12 }}>Bicol University Polangui</span>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>·</span>
          <span style={{ color: "rgba(255,255,255,0.27)", fontSize: 12 }}>Academic Platform</span>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "var(--bg-primary, #f5f7f5)" }} className="login-right">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary, #111827)", marginBottom: 6, fontFamily: "var(--font-display, serif)" }}>Welcome back</h2>
          <p style={{ color: "var(--text-muted, #6b7280)", fontSize: 14, marginBottom: 28 }}>Sign in to your BUPulse account</p>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#b91c1c", fontSize: 13.5, marginBottom: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Role selector */}
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10 }}>Sign in as</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {ROLES.map(({ id, Icon, label, desc }) => {
              const active = role === id;
              return (
                <button
                  key={id}
                  onClick={() => setRole(id)}
                  aria-pressed={active}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12, width: "100%",
                    border: `1.5px solid ${active ? "#16a34a" : "var(--border-color, #e5e7eb)"}`,
                    background: active ? "rgba(22,163,74,0.06)" : "var(--card-bg, #fff)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.14s",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: active ? "rgba(22,163,74,0.1)" : "var(--bg-tertiary, #f0f4f1)",
                    border: `1.5px solid ${active ? "rgba(22,163,74,0.35)" : "var(--border-color, #e5e7eb)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: active ? "#16a34a" : "var(--text-muted)", transition: "all 0.14s",
                  }}><Icon /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${active ? "#16a34a" : "var(--border-color)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "border-color 0.14s",
                  }}>
                    {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Google button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "13px 20px", borderRadius: 12,
              border: "1.5px solid var(--border-color, #e5e7eb)",
              background: "var(--card-bg, #fff)", color: "var(--text-secondary, #374151)",
              fontSize: 14.5, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.17s", fontFamily: "var(--font-body)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 14,
              opacity: loading ? 0.65 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "#16a34a"; e.currentTarget.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-color, #e5e7eb)"; e.currentTarget.style.transform = "none"; }}
          >
            {loading
              ? <div style={{ width: 18, height: 18, border: "2px solid #e5e7eb", borderTopColor: "#16a34a", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
              : <GoogleLogo />
            }
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Security note */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 10, padding: "11px 14px", color: "rgba(22,163,74,0.85)", fontSize: 12.5, lineHeight: 1.55 }}>
            <svg style={{ flexShrink: 0, marginTop: 1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Use your official Bicol University Polangui email to access BUPulse. No password required.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right { padding: 28px 20px !important; }
        }
      `}</style>
    </div>
  );
}
