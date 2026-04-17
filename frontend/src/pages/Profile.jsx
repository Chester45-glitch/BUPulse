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
const IcoTrash    = () => <Ico><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Ico>;
const IcoUnlink   = () => <Ico><path d="M18.36 6.64a9 9 0 0 1-2.05 2.1L15 7.4A7 7 0 0 0 16.6 5.8a5 5 0 0 0-7.07-7.07l-3 3a5 5 0 0 0 7.07 7.07l.59-.6M5.64 17.36a9 9 0 0 1 2.05-2.1l1.31 1.34A7 7 0 0 0 7.4 18.2a5 5 0 0 0 7.07 7.07l3-3a5 5 0 0 0-7.07-7.07l-.59.6"/></Ico>;

/* ── Toggle Switch ─────────────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: checked ? "#16a34a" : "var(--border-color)",
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        border: "none", transition: "background 0.2s",
        opacity: disabled ? 0.6 : 1, flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3, left: checked ? 23 : 3,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
      }} />
    </button>
  );
}

/* ── Danger Modal ──────────────────────────────────────────────── */
function DeleteModal({ onConfirm, onCancel, loading }) {
  const [confirmText, setConfirmText] = useState("");
  const isValid = confirmText === "DELETE";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: "fadeIn 0.2s ease"
    }}>
      <div style={{
        background: "var(--card-bg)", borderRadius: 16, width: "100%", maxWidth: 400,
        padding: 24, boxShadow: "var(--shadow-xl)", border: "1px solid var(--card-border)"
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: "#fee2e2", color: "#dc2626",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16
        }}>
          <IcoTrash size={24} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Delete Account</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 20 }}>
          This action cannot be undone. All your data, classes, and settings will be permanently erased.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Type <strong style={{ color: "var(--text-primary)" }}>DELETE</strong> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1.5px solid var(--input-border)", background: "var(--input-bg)",
              color: "var(--text-primary)", fontSize: 14, outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px", borderRadius: 10, background: "var(--bg-tertiary)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!isValid || loading}
            style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none",
              background: isValid ? "#dc2626" : "var(--border-color)",
              color: isValid ? "#fff" : "var(--text-muted)",
              fontSize: 14, fontWeight: 600, cursor: isValid ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6
            }}
          >
            {loading && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState({ email: false, system: true });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // NEW: BULMS Linked State
  const [bulmsConnected, setBulmsConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    // Fetch Notification Prefs
    api.get("/user/notifications")
      .then(r => setPrefs(r.data))
      .catch(console.error);
      
    // Fetch BULMS connection status
    if (user?.id) {
        api.get(`/bulms/status?userId=${user.id}`)
           .then(r => setBulmsConnected(r.data?.status === 'connected'))
           .catch(() => setBulmsConnected(false));
    }
  }, [user]);

  const togglePref = async (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      await api.patch("/user/notifications", next);
    } catch (e) {
      setPrefs(prefs); // revert
      alert("Failed to save preference.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete("/user/account");
      logout();
      navigate("/login");
    } catch (e) {
      alert("Failed to delete account. Please try again.");
      setDeleteLoading(false);
      setShowDelete(false);
    }
  };
  
  const handleDisconnectBulms = async () => {
      if (!window.confirm("Are you sure you want to disconnect your Bicol University account? This will clear all synced subjects and activities.")) return;
      
      setDisconnecting(true);
      try {
          await api.delete("/user/account/bulms");
          setBulmsConnected(false);
      } catch (e) {
          alert("Failed to disconnect. Please try again.");
      } finally {
          setDisconnecting(false);
      }
  };

  if (!user) return null;

  const roleLabels = { student: "Student Account", professor: "Professor Account", parent: "Parent Account" };

  return (
    <div style={{ animation: "fadeIn 0.35s ease", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 20 }}>Account Settings</h2>

      {/* ── 1. Profile Header ── */}
      <div style={{
        background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)",
        padding: 24, display: "flex", alignItems: "center", gap: 20, marginBottom: 24,
        boxShadow: "var(--shadow-sm)"
      }}>
        <img
          src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
          alt="Avatar"
          style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid var(--border-color)", objectFit: "cover" }}
        />
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{user.name}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
            <IcoMail size={14} /> {user.email}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--green-700)", fontSize: 13, fontWeight: 600 }}>
            <IcoShield size={14} /> {roleLabels[user.role] || "User Account"}
          </div>
        </div>
      </div>

      {/* ── 2. Notifications ── */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <IcoBell size={15} /> Notifications
        </h4>
        <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", overflow: "hidden" }}>
          
          {/* Email toggle */}
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Email Alerts</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Receive daily summaries and urgent deadline reminders via email.</div>
            </div>
            <Toggle checked={prefs.email} onChange={(v) => togglePref("email", v)} disabled={savingPrefs} />
          </div>

          {/* System toggle */}
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>In-App Notifications</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Show badge counts and banner alerts inside BUPulse.</div>
            </div>
            <Toggle checked={prefs.system} onChange={(v) => togglePref("system", v)} disabled={savingPrefs} />
          </div>
        </div>
      </div>
      
      {/* ── 3. Linked Integrations (NEW) ── */}
      {bulmsConnected && (
          <div style={{ marginBottom: 32 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <IcoUnlink size={15} /> Linked Integrations
            </h4>
            <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Bicol University LMS</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Connected and syncing your classes and deadlines.</div>
                </div>
                <button
                  onClick={handleDisconnectBulms}
                  disabled={disconnecting}
                  style={{
                    padding: "8px 14px", borderRadius: 8,
                    background: "transparent", border: "1px solid #fecaca",
                    color: "#dc2626", fontSize: 13, fontWeight: 600,
                    cursor: disconnecting ? "not-allowed" : "pointer", transition: "all 0.15s",
                    opacity: disconnecting ? 0.6 : 1
                  }}
                  onMouseEnter={e => { if(!disconnecting) e.currentTarget.style.background = "#fee2e2"; }}
                  onMouseLeave={e => { if(!disconnecting) e.currentTarget.style.background = "transparent"; }}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            </div>
          </div>
      )}

      {/* ── 4. Danger Zone ── */}
      <div>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <IcoTrash size={15} /> Danger Zone
        </h4>
        <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid #fecaca", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Delete Account</div>
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
      `}</style>
    </div>
  );
}