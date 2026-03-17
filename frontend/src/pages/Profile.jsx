import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

/* ── Helpers ─────────────────────────────────────────────────── */
const initials = (n = "") => {
  const p = n.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : n.slice(0, 2).toUpperCase();
};

const ROLE_META = {
  student:   { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", label: "Student",   desc: "Bulacan State University" },
  professor: { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", label: "Professor", desc: "Faculty Member" },
  parent:    { color: "#a855f7", bg: "#faf5ff", border: "#e9d5ff", label: "Parent",    desc: "Parent / Guardian" },
};

/* ── Toggle switch ───────────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      aria-checked={checked}
      role="switch"
      disabled={disabled}
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#16a34a" : "var(--border-color)",
        position: "relative", transition: "background 0.22s ease", flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "left 0.22s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

/* ── SettingRow ──────────────────────────────────────────────── */
function SettingRow({ icon, label, desc, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--border-color)" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/* ── DeleteConfirmModal ──────────────────────────────────────── */
function DeleteModal({ onConfirm, onCancel, loading }) {
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim().toUpperCase() === "DELETE";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)", animation: "fadeIn 0.18s ease" }}>
      <div style={{ background: "var(--card-bg)", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 400, width: "100%", border: "1px solid var(--card-border)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", animation: "scaleIn 0.2s ease" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🗑️</div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Delete Account?</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: 18 }}>
          This will permanently delete your account, all data, and linked information. <strong>This action cannot be undone.</strong>
        </p>

        <div style={{ background: "var(--bg-tertiary)", borderRadius: 10, padding: "12px 14px", marginBottom: 18, border: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>Type <strong>DELETE</strong> to confirm</p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="DELETE"
            autoFocus
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1.5px solid ${confirmed ? "#16a34a" : "var(--input-border)"}`,
              background: "var(--input-bg)", color: "var(--text-primary)",
              fontSize: 14, outline: "none", transition: "border-color 0.15s",
              letterSpacing: "0.5px", fontWeight: 600,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "11px", borderRadius: 10, background: "var(--bg-tertiary)", border: "1.5px solid var(--border-color)", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || loading}
            style={{
              flex: 1, padding: "11px", borderRadius: 10,
              background: confirmed ? "#dc2626" : "var(--bg-tertiary)",
              border: `1.5px solid ${confirmed ? "#dc2626" : "var(--border-color)"}`,
              color: confirmed ? "#fff" : "var(--text-muted)",
              fontSize: 14, fontWeight: 600, cursor: confirmed ? "pointer" : "not-allowed",
              transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading
              ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} /> Deleting…</>
              : "Delete Account"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Profile Page ────────────────────────────────────────────── */
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const meta = ROLE_META[user?.role] || ROLE_META.student;

  const [notifyEmail, setNotifyEmail]   = useState(false);
  const [notifySystem, setNotifySystem] = useState(true);
  const [savingNotif, setSavingNotif]   = useState(false);
  const [notifSaved, setNotifSaved]     = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // Load notification preferences
  useEffect(() => {
    api.get("/api/user/notifications")
      .then(r => {
        setNotifyEmail(r.data.email ?? false);
        setNotifySystem(r.data.system ?? true);
      })
      .catch(() => {}); // Fail silently, use defaults
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    try {
      await api.patch("/api/user/notifications", { email: notifyEmail, system: notifySystem });
      setNotifSaved(true);
      showToast("Notification preferences saved!");
      setTimeout(() => setNotifSaved(false), 2500);
    } catch {
      showToast("Failed to save preferences.", "error");
    } finally {
      setSavingNotif(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete("/api/user/account");
      await logout();
      navigate("/", { replace: true });
    } catch {
      showToast("Failed to delete account. Try again.", "error");
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate("/", { replace: true }); };

  const ROLE_ACTIONS = {
    student: [
      { icon: "📚", label: "Enrolled Classes", sub: "View active courses", path: "/enrolled-classes" },
      { icon: "⏳", label: "Pending Activities", sub: "Unsubmitted work", path: "/pending-activities" },
      { icon: "📢", label: "Announcements", sub: "Class announcements", path: "/announcements" },
    ],
    professor: [
      { icon: "📢", label: "Post Announcement", sub: "Notify your students", path: "/professor" },
      { icon: "📚", label: "My Classes", sub: "Courses you teach", path: "/professor" },
    ],
    parent: [
      { icon: "👨‍👩‍👧", label: "Student Monitor", sub: "Track your child", path: "/parent" },
    ],
  };
  const quickActions = ROLE_ACTIONS[user?.role] || ROLE_ACTIONS.student;

  return (
    <div style={{ maxWidth: 600, animation: "fadeIn 0.35s ease" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: toast.type === "error" ? "#dc2626" : "#16a34a",
          color: "#fff", borderRadius: 12, padding: "12px 18px",
          fontSize: 14, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          animation: "fadeUp 0.2s ease", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>{toast.type === "error" ? "⚠️" : "✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Hero card ─────────────────────────────────────── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 18, border: "1px solid var(--card-border)", overflow: "hidden", marginBottom: 16, boxShadow: "var(--shadow-md)" }}>
        <div style={{ height: 96, background: "linear-gradient(135deg,#0f2010,#1e4d1e)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(circle,#fff 1.5px,transparent 1.5px)", backgroundSize: "26px 26px" }} />
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ marginTop: -42, marginBottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            {user?.picture
              ? <img src={user.picture} alt={user.name} style={{ width: 78, height: 78, borderRadius: "50%", border: "4px solid var(--card-bg)", boxShadow: "0 4px 14px rgba(0,0,0,0.15)", objectFit: "cover" }} />
              : <div style={{ width: 78, height: 78, borderRadius: "50%", background: `linear-gradient(135deg,${meta.color},#166534)`, border: "4px solid var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, fontWeight: 700 }}>
                  {user ? initials(user.name) : "?"}
                </div>
            }
            <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 99, marginBottom: 4 }}>
              {meta.label}
            </span>
          </div>
          <h2 style={{ fontSize: 21, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{user?.name}</h2>
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{user?.email} · {meta.desc}</p>
        </div>
      </div>

      {/* ── Account Info ──────────────────────────────────── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", padding: "18px 22px", marginBottom: 14, boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", marginBottom: 4 }}>Account</h3>
        <SettingRow icon="👤" label="Full Name" desc={user?.name} />
        <SettingRow icon="📧" label="Email Address" desc={user?.email} />
        <SettingRow icon="🎭" label="Role" desc={meta.label} />
        <div style={{ paddingTop: 0 }}>
          <SettingRow icon="🔐" label="Sign-in Method" desc="Google OAuth 2.0" />
        </div>
      </div>

      {/* ── Notifications ─────────────────────────────────── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", padding: "18px 22px", marginBottom: 14, boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", marginBottom: 4 }}>Notifications</h3>

        <SettingRow
          icon="📬"
          label="Email Notifications"
          desc="Receive deadline reminders and announcements via email"
        >
          <Toggle checked={notifyEmail} onChange={setNotifyEmail} />
        </SettingRow>

        <SettingRow
          icon="🔔"
          label="In-App Notifications"
          desc="Show notification badges in the dashboard"
        >
          <Toggle checked={notifySystem} onChange={setNotifySystem} />
        </SettingRow>

        <div style={{ paddingTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleSaveNotifications}
            disabled={savingNotif}
            style={{
              padding: "9px 20px", borderRadius: 10,
              background: notifSaved ? "#16a34a" : "var(--green-700)",
              color: "#fff", fontSize: 13.5, fontWeight: 600, border: "none",
              cursor: savingNotif ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 7, transition: "all 0.18s",
            }}
          >
            {savingNotif
              ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} /> Saving…</>
              : notifSaved ? "✓ Saved" : "Save Preferences"
            }
          </button>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", padding: "18px 22px", marginBottom: 14, boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", marginBottom: 12 }}>Quick Actions</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {quickActions.map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "1px solid var(--border-color)",
                background: "var(--bg-tertiary)", cursor: "pointer", textAlign: "left",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--green-50)", e.currentTarget.style.borderColor = "var(--green-200)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-tertiary)", e.currentTarget.style.borderColor = "var(--border-color)")}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.sub}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Danger Zone ───────────────────────────────────── */}
      <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid #fecaca", padding: "18px 22px", marginBottom: 14, boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#dc2626", marginBottom: 14 }}>Danger Zone</h3>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 12,
            border: "1px solid var(--border-color)", background: "var(--bg-tertiary)",
            cursor: "pointer", marginBottom: 8, textAlign: "left", transition: "all 0.14s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--hover-bg)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--bg-tertiary)"}
        >
          <span style={{ fontSize: 18 }}>🚪</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>Sign Out</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Log out of your BUPulse account</div>
          </div>
        </button>

        {/* Delete account */}
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 12,
            border: "1.5px solid #fecaca", background: "#fff5f5",
            cursor: "pointer", textAlign: "left", transition: "all 0.14s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2", e.currentTarget.style.borderColor = "#f87171")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff5f5", e.currentTarget.style.borderColor = "#fecaca")}
        >
          <span style={{ fontSize: 18 }}>🗑️</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dc2626" }}>Delete Account</div>
            <div style={{ fontSize: 12, color: "#f87171" }}>Permanently remove your account and all data</div>
          </div>
        </button>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteModal(false)}
          loading={deletingAccount}
        />
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}
