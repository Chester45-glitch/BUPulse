import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

/* ── Clean monochrome icons ──────────────────────────────────── */
const Ico = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IcoUser     = () => <Ico><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ico>;
const IcoMail     = () => <Ico><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></Ico>;
const IcoShield   = () => <Ico><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Ico>;
const IcoBadge    = () => <Ico><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></Ico>;
const IcoBell     = () => <Ico><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Ico>;
const IcoTrash    = () => <Ico><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Ico>;
const IcoChevron  = () => <Ico size={16}><polyline points="9 18 15 12 9 6"/></Ico>;
const IcoCheck    = () => <Ico size={14}><polyline points="20 6 9 17 4 12"/></Ico>;
const IcoAlert    = () => <Ico size={16}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Ico>;

const ROLE_CFG = {
  student:   { color: "#16a34a", bg: "rgba(22,163,74,0.1)",   border: "rgba(22,163,74,0.3)",   label: "Student"   },
  professor: { color: "#2563eb", bg: "rgba(37,99,235,0.1)",   border: "rgba(37,99,235,0.3)",   label: "Professor" },
  parent:    { color: "#9333ea", bg: "rgba(147,51,234,0.1)",  border: "rgba(147,51,234,0.3)",  label: "Parent"    },
};

const initials = (n = "") => {
  const p = n.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

/* ── NotificationToggle ──────────────────────────────────────── */
function NotificationToggle({ enabled, onChange, loading }) {
  return (
    <button
      onClick={() => !loading && onChange(!enabled)}
      aria-label={enabled ? "Disable notifications" : "Enable notifications"}
      aria-pressed={enabled}
      style={{
        width: 46, height: 26, borderRadius: 13, position: "relative",
        background: enabled ? "#16a34a" : "var(--border-color, #d1d5db)",
        border: "none", cursor: loading ? "not-allowed" : "pointer",
        transition: "background 0.22s ease", flexShrink: 0,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: enabled ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        transition: "left 0.22s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {loading && <div style={{ width: 10, height: 10, border: "1.5px solid #d1d5db", borderTopColor: "#16a34a", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
      </div>
    </button>
  );
}

/* ── DeleteModal ─────────────────────────────────────────────── */
function DeleteModal({ onConfirm, onCancel, loading }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const CONFIRM_PHRASE = "delete my account";
  const valid = input.toLowerCase().trim() === CONFIRM_PHRASE;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) { setError(`Type "${CONFIRM_PHRASE}" exactly to confirm.`); return; }
    onConfirm();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(3px)" }}>
      <div style={{
        background: "var(--card-bg, #fff)", borderRadius: 18, padding: "28px 28px 24px",
        width: "100%", maxWidth: 420,
        boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
        animation: "scaleIn 0.18s ease",
      }}>
        {/* Warning icon */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: "#dc2626" }}>
          <IcoTrash />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Delete account?</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
          This action is <strong style={{ color: "var(--text-primary)" }}>permanent</strong>. Your profile, preferences, and linked data will be removed. You will no longer be able to log in.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 7, letterSpacing: "0.3px" }}>
            Type <span style={{ color: "#dc2626", fontFamily: "monospace" }}>delete my account</span> to confirm
          </label>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setError(""); }}
            placeholder="delete my account"
            autoFocus
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${error ? "#dc2626" : "var(--input-border, #d1d5db)"}`,
              background: "var(--input-bg, #fff)", color: "var(--text-primary)",
              fontSize: 14, outline: "none", marginBottom: error ? 6 : 16,
              fontFamily: "var(--font-body)",
            }}
          />
          {error && <p style={{ fontSize: 12.5, color: "#dc2626", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}><IcoAlert /> {error}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} disabled={loading} style={{
              flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid var(--border-color)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
              cursor: "pointer", fontFamily: "var(--font-body)",
            }}>Cancel</button>
            <button type="submit" disabled={loading || !valid} style={{
              flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
              background: loading || !valid ? "#fca5a5" : "#dc2626",
              color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: loading || !valid ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "var(--font-body)", transition: "background 0.15s",
            }}>
              {loading ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <><IcoTrash /> Delete</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── InfoRow ─────────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, border = true }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 0",
      borderBottom: border ? "1px solid var(--border-color, #e9ecef)" : "none",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: "var(--bg-tertiary, #f0f4f1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)",
      }}><Icon /></div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint, #9ca3af)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value || "—"}</div>
      </div>
    </div>
  );
}

/* ── Profile page ────────────────────────────────────────────── */
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaved, setNotifSaved]   = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const rc = ROLE_CFG[user?.role] || ROLE_CFG.student;

  /* Fetch notification preference on mount */
  useEffect(() => {
    api.get("/auth/me")
      .then(r => setNotifEnabled(r.data.user?.notifications_enabled ?? false))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  /* Save notification preference */
  const handleNotifChange = async (val) => {
    setNotifLoading(true);
    try {
      await api.patch("/notifications/settings", { notifications_enabled: val });
      setNotifEnabled(val);
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2000);
    } catch {
      setPageError("Failed to save notification preference. Try again.");
    } finally {
      setNotifLoading(false);
    }
  };

  /* Delete account */
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete("/auth/account");
      await logout();
      navigate("/", { replace: true });
    } catch {
      setDeleteLoading(false);
      setShowDelete(false);
      setPageError("Failed to delete account. Please try again.");
    }
  };

  return (
    <div style={{ animation: "fadeIn 0.35s ease", maxWidth: 580 }}>
      {pageError && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#b91c1c", fontSize: 13.5, marginBottom: 16 }}>
          <IcoAlert /> {pageError}
          <button onClick={() => setPageError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* ── Cover card ── */}
      <div style={{ background: "var(--card-bg, #fff)", borderRadius: 18, border: "1px solid var(--card-border, #e9ecef)", overflow: "hidden", boxShadow: "var(--shadow-md)", marginBottom: 16 }}>
        {/* Banner */}
        <div style={{ height: 96, background: "linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </div>

        <div style={{ padding: "0 24px 24px", position: "relative" }}>
          {/* ── Avatar — FIXED: uses relative positioning offset from banner ── */}
          <div style={{
            position: "relative",    /* no absolute — avoids z-index stacking bug */
            marginTop: -44,          /* pull up over the banner */
            marginBottom: 14,
            width: 80,
            zIndex: 1,               /* sit above banner but below dropdown */
            display: "inline-block",
          }}>
            {user?.picture
              ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  style={{
                    width: 80, height: 80, borderRadius: "50%", display: "block",
                    border: "4px solid var(--card-bg, #fff)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                    objectFit: "cover",
                  }}
                />
              )
              : (
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(135deg, ${rc.color}cc, ${rc.color})`,
                  border: "4px solid var(--card-bg, #fff)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                  color: "#fff", fontSize: 26, fontWeight: 700,
                }}>
                  {user ? initials(user.name) : "?"}
                </div>
              )
            }
          </div>

          {/* Role badge — top-right of card body */}
          <div style={{ position: "absolute", top: -44 + 96 + 14, right: 24 }}>
            <span style={{
              background: rc.bg, color: rc.color,
              border: `1px solid ${rc.border}`,
              fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              letterSpacing: "0.3px",
            }}>{rc.label}</span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{user?.name}</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{user?.email}</p>
        </div>
      </div>

      {/* ── Account info ── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", padding: "18px 22px", boxShadow: "var(--shadow-sm)", marginBottom: 14 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Account</h3>
        <InfoRow icon={IcoUser}   label="Full Name"      value={user?.name} />
        <InfoRow icon={IcoMail}   label="Email"          value={user?.email} />
        <InfoRow icon={IcoBadge}  label="Role"           value={rc.label} />
        <InfoRow icon={IcoShield} label="Sign-in Method" value="Google OAuth 2.0" border={false} />
      </div>

      {/* ── Notification preference ── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", padding: "18px 22px", boxShadow: "var(--shadow-sm)", marginBottom: 14 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 16 }}>Notifications</h3>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}><IcoBell /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Email notifications</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Receive deadline reminders and announcements by email</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <NotificationToggle enabled={notifEnabled} onChange={handleNotifChange} loading={notifLoading} />
            {notifSaved && (
              <span style={{ fontSize: 11, color: "#16a34a", display: "flex", alignItems: "center", gap: 3, animation: "fadeIn 0.2s ease" }}>
                <IcoCheck /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid #fecaca", padding: "18px 22px", boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 16 }}>Danger Zone</h3>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Delete account</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Permanently remove your account and all associated data</div>
          </div>
          <button
            onClick={() => setShowDelete(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10,
              background: "#fee2e2", border: "1px solid #fecaca",
              color: "#dc2626", fontSize: 13.5, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#dc2626"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
          >
            <IcoTrash /> Delete Account
          </button>
        </div>
      </div>

      {/* Delete modal */}
      {showDelete && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleteLoading}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
