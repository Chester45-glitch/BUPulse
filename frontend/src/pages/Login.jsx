import { useState, useEffect } from "react";

/* ── Role icon SVGs (clean b&w) ──────────────────────────────── */
const StudentIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const ProfessorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/>
    <line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);
const ParentIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

/* ── Feature icon list ──────────────────────────────────────── */
const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    text: "Targeted announcements"
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    text: "Deadline tracking"
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    text: "Parent monitoring"
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    text: "AI-powered PulsBot"
  },
];

const ROLES = [
  { id: "student",   Icon: StudentIcon,   label: "Student",   desc: "View classes, deadlines & announcements" },
  { id: "professor", Icon: ProfessorIcon, label: "Professor", desc: "Post announcements & manage classes" },
  { id: "parent",    Icon: ParentIcon,    label: "Parent",    desc: "Monitor your child's academic progress" },
];

/* ── Google "G" logo (original colors) ─────────────────────── */
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

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
    <div className="login-root">
      {/* ── Left panel ───────────────────────────────────────── */}
      <div className="login-left">
        <div className="login-left-inner">
          {/* Logo */}
          <div className="login-brand">
            <div className="login-brand-icon">📚</div>
            <span className="login-brand-name">BUPulse</span>
          </div>

          <h1 className="login-headline">
            Smart communication<br />for modern campuses.
          </h1>
          <p className="login-sub">
            Connect students, professors, and parents through one unified academic hub.
          </p>

          {/* Feature list */}
          <div className="login-features">
            {features.map((f, i) => (
              <div key={i} className="login-feature">
                <div className="login-feature-icon">{f.icon}</div>
                <span className="login-feature-text">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="login-left-footer">
          <span>Bulacan State University</span>
          <span className="login-dot">·</span>
          <span>Academic Platform</span>
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────── */}
      <div className="login-right">
        <div className="login-form-box">
          <h2 className="login-welcome">Welcome back</h2>
          <p className="login-welcome-sub">Sign in to your BUPulse account</p>

          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Role selector */}
          <p className="login-role-label">Sign in as</p>
          <div className="login-roles">
            {ROLES.map(({ id, Icon, label, desc }) => (
              <button
                key={id}
                onClick={() => setRole(id)}
                aria-pressed={role === id}
                className={`login-role-card ${role === id ? "login-role-active" : ""}`}
              >
                <div className={`login-role-icon-wrap ${role === id ? "login-role-icon-active" : ""}`}>
                  <Icon />
                </div>
                <div className="login-role-text">
                  <span className="login-role-name">{label}</span>
                  <span className="login-role-desc">{desc}</span>
                </div>
                <div className={`login-radio ${role === id ? "login-radio-active" : ""}`}>
                  {role === id && <div className="login-radio-dot" />}
                </div>
              </button>
            ))}
          </div>

          {/* Google button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="login-google-btn"
            aria-label={`Continue with Google as ${role}`}
          >
            {loading ? (
              <div className="login-spinner" />
            ) : (
              <GoogleLogo />
            )}
            <span>{loading ? "Redirecting…" : "Continue with Google"}</span>
          </button>

          {/* Secure note */}
          <div className="login-secure-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Use your official school email to access BUPulse. No password required.
          </div>
        </div>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: var(--font-body, system-ui, sans-serif);
          background: var(--bg-primary);
        }

        /* Left */
        .login-left {
          width: 44%;
          background: #0f1f0f;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 0;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 60% at 30% 40%, rgba(74,222,128,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        /* dot grid */
        .login-left::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }
        .login-left-inner {
          position: relative;
          z-index: 1;
          padding: 48px 52px 40px;
        }
        .login-brand {
          display: flex; align-items: center; gap: 10; margin-bottom: 56px;
        }
        .login-brand-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #d4820a, #f59e0b);
          display: flex; align-items: center; justify-content: center; font-size: 19px;
        }
        .login-brand-name {
          font-size: 20px; color: #fff; font-weight: 600;
          font-family: var(--font-display, serif);
        }
        .login-headline {
          font-size: clamp(26px, 3.5vw, 38px);
          font-weight: 700; color: #fff; line-height: 1.2;
          margin-bottom: 16px;
          font-family: var(--font-display, serif);
          letter-spacing: -0.5px;
        }
        .login-sub {
          color: rgba(255,255,255,0.5); font-size: 14.5px; line-height: 1.65;
          margin-bottom: 40px; max-width: 380px;
        }
        .login-features { display: flex; flex-direction: column; gap: 12; }
        .login-feature {
          display: flex; align-items: center; gap: 12;
          color: rgba(255,255,255,0.6); font-size: 14px;
        }
        .login-feature-icon {
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.09);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .login-feature-text { color: rgba(255,255,255,0.65); }
        .login-left-footer {
          position: relative; z-index: 1;
          padding: 18px 52px;
          border-top: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; gap: 8;
          color: rgba(255,255,255,0.28); font-size: 12px;
        }
        .login-dot { opacity: 0.4; }

        /* Right */
        .login-right {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 24px;
          background: var(--bg-primary);
        }
        .login-form-box { width: 100%; max-width: 400px; }
        .login-welcome {
          font-size: 28px; font-weight: 700; color: var(--text-primary);
          margin-bottom: 6px; font-family: var(--font-display, serif);
        }
        .login-welcome-sub { color: var(--text-muted); font-size: 14px; margin-bottom: 28px; }
        .login-error {
          display: flex; align-items: center; gap: 7;
          background: #fee2e2; border: 1px solid #fecaca;
          border-radius: 10px; padding: 10px 14px;
          color: #b91c1c; font-size: 13.5px; margin-bottom: 20px;
        }

        /* Role cards */
        .login-role-label { font-size: 12.5px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 10px; }
        .login-roles { display: flex; flex-direction: column; gap: 8; margin-bottom: 22px; }
        .login-role-card {
          display: flex; align-items: center; gap: 12;
          padding: 12px 14px; border-radius: 12px;
          border: 1.5px solid var(--border-color);
          background: var(--card-bg); cursor: pointer;
          transition: all 0.15s ease; text-align: left; width: 100%;
        }
        .login-role-card:hover { border-color: rgba(74,222,128,0.4); background: var(--bg-tertiary); }
        .login-role-active { border-color: #16a34a !important; background: rgba(22,163,74,0.06) !important; }
        .login-role-icon-wrap {
          width: 42px; height: 42px; border-radius: 11px;
          background: var(--bg-tertiary); border: 1.5px solid var(--border-color);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); flex-shrink: 0; transition: all 0.15s;
        }
        .login-role-icon-active { background: rgba(22,163,74,0.1) !important; border-color: rgba(22,163,74,0.35) !important; color: #16a34a !important; }
        .login-role-text { flex: 1; min-width: 0; }
        .login-role-name { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
        .login-role-desc { display: block; font-size: 11.5px; color: var(--text-muted); }
        .login-radio {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid var(--border-color);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: border-color 0.15s;
        }
        .login-radio-active { border-color: #16a34a; }
        .login-radio-dot { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; }

        /* Google button */
        .login-google-btn {
          width: 100%; display: flex; align-items: center; justify-content: center;
          gap: 10px; padding: 13px 20px; border-radius: 12px;
          border: 1.5px solid var(--border-color);
          background: var(--card-bg); color: var(--text-secondary);
          font-size: 14.5px; font-weight: 600; cursor: pointer;
          transition: all 0.18s; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          font-family: var(--font-body, system-ui);
          margin-bottom: 14px;
        }
        .login-google-btn:hover:not(:disabled) {
          border-color: #16a34a;
          background: rgba(22,163,74,0.04);
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }
        .login-google-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .login-spinner {
          width: 18px; height: 18px; border: 2px solid var(--border-color);
          border-top-color: #16a34a; border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Secure note */
        .login-secure-note {
          display: flex; align-items: flex-start; gap: 7;
          background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.2);
          border-radius: 10px; padding: 11px 14px;
          color: rgba(22,163,74,0.85); font-size: 12.5px; line-height: 1.55;
        }
        .login-secure-note svg { flex-shrink: 0; margin-top: 1px; }

        /* Mobile */
        @media (max-width: 768px) {
          .login-root { flex-direction: column; }
          .login-left { width: 100%; padding: 0; }
          .login-left-inner { padding: 32px 24px 28px; }
          .login-brand { margin-bottom: 28px; }
          .login-headline { font-size: 26px; }
          .login-features { display: none; }
          .login-left-footer { padding: 14px 24px; }
          .login-right { padding: 28px 20px; }
        }
      `}</style>
    </div>
  );
}
