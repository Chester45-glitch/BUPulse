/**
 * BulmsSync.jsx — BULMS Account Linking & Data Sync Page
 * Production version: uses manual MoodleSession cookie paste for linking.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api";

const S = {
  card: {
    background:   "var(--card-bg)",
    border:       "1px solid var(--card-border)",
    borderRadius: 16,
    padding:      "20px 24px",
    boxShadow:    "var(--shadow-sm)",
  },
  badge: (color, bg) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600,
    color, background: bg,
  }),
  btn: (variant = "primary") => {
    const variants = {
      primary: { background: "var(--green-600)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "opacity 0.15s" },
      ghost:   { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--card-border)", padding: "8px 16px", borderRadius: 10, fontWeight: 500, fontSize: 13, cursor: "pointer" },
      danger:  { background: "transparent", color: "#dc2626", border: "1px solid #fca5a5", padding: "8px 16px", borderRadius: 10, fontWeight: 500, fontSize: 13, cursor: "pointer" },
    };
    return variants[variant];
  },
};

const Icon = ({ d, size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Icons = {
  link:     "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  alert:    "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  unlink:   "M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.72",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff:   "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  copy:     "M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z",
  check:    "M20 6L9 17l-5-5",
  info:     "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M12 12v4",
  assign:   "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  quiz:     "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  book:     "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
};

const Spinner = ({ size = 20 }) => (
  <>
    <div style={{ width: size, height: size, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "currentColor", borderRadius: "50%", animation: "bspin 0.8s linear infinite", flexShrink: 0 }} />
    <style>{`@keyframes bspin{to{transform:rotate(360deg)}}`}</style>
  </>
);

function DueBadge({ dueDate }) {
  if (!dueDate) return <span style={S.badge("var(--text-faint)", "var(--bg-tertiary)")}>No due date</span>;
  const d = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (d < 0)   return <span style={S.badge("#dc2626", "#fee2e2")}>{Math.abs(d)}d overdue</span>;
  if (d === 0) return <span style={S.badge("#dc2626", "#fee2e2")}>Due today</span>;
  if (d === 1) return <span style={S.badge("#d97706", "#ffedd5")}>Due tomorrow</span>;
  if (d <= 3)  return <span style={S.badge("#d97706", "#ffedd5")}>{d}d left</span>;
  return             <span style={S.badge("#16a34a", "#dcfce7")}>{d}d left</span>;
}

function StatusBadge({ status }) {
  const m = { submitted: ["#16a34a","#dcfce7","Submitted"], graded: ["#0ea5e9","#e0f2fe","Graded"], notsubmitted: ["#dc2626","#fee2e2","Not submitted"] };
  const [c, bg, label] = m[status] || ["var(--text-muted)","var(--bg-tertiary)", status || "—"];
  return <span style={S.badge(c, bg)}>{label}</span>;
}

function ActivityCard({ activity }) {
  const [open, setOpen] = useState(false);
  const typeColor = { quiz: "#8b5cf6", forum: "#0ea5e9", assign: "#f59e0b" }[activity.activity_type] || "#6b7280";
  const typeIcon  = { quiz: Icons.quiz, forum: Icons.info }[activity.activity_type] || Icons.assign;
  return (
    <div onClick={() => setOpen(x => !x)} style={{ ...S.card, padding: "14px 18px", marginBottom: 10, cursor: "pointer", borderLeft: activity.is_overdue ? "3px solid #dc2626" : "3px solid transparent" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon d={typeIcon} size={16} color={typeColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{activity.activity_name}</p>
            <DueBadge dueDate={activity.due_date} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{activity.course_id}</span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <StatusBadge status={activity.submission_status} />
          </div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--card-border)" }}>
          {activity.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>{activity.description}</p>}
          {activity.due_date && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Due: {new Date(activity.due_date).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}</p>}
          {activity.activity_url && (
            <a href={activity.activity_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "var(--green-600)", textDecoration: "underline" }}>
              Open in BULMS →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manual Cookie Link Panel ───────────────────────────────────────────────────
function ManualLinkPanel({ onSuccess, isRelink = false }) {
  const [cookieVal, setCookieVal] = useState("");
  const [showVal,   setShowVal]   = useState(false);
  const [step,      setStep]      = useState(1); // 1=instructions, 2=paste
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [copied,    setCopied]    = useState(false);
  const BULMS_URL = "https://bulms.bicol-u.edu.ph";

  const copyUrl = () => {
    navigator.clipboard.writeText(BULMS_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!cookieVal.trim()) return setError("Please paste your MoodleSession cookie value.");
    setError(null);
    setLoading(true);
    try {
      await api.post("/bulms/link-manual", { moodle_session: cookieVal.trim() });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save session. Check the cookie value and try again.");
    } finally {
      setLoading(false);
    }
  };

  const stepStyle = (n) => ({
    display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 14px",
    borderRadius: 10, background: step === n ? "var(--bg-tertiary)" : "transparent",
    border: `1px solid ${step === n ? "var(--green-600)" : "transparent"}`,
    marginBottom: 8, cursor: n < step ? "default" : "pointer",
  });

  return (
    <div style={{ ...S.card, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={Icons.link} size={20} color="var(--green-600)" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {isRelink ? "Relink BULMS Account" : "Connect BULMS Account"}
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>3-step process · takes about 1 minute</p>
        </div>
      </div>

      {/* Step 1 */}
      <div style={stepStyle(1)} onClick={() => setStep(1)}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: step >= 1 ? "var(--green-600)" : "var(--bg-tertiary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Log in to BULMS in your browser</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Open BULMS in a new tab and sign in with your university Google account.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <a href={BULMS_URL} target="_blank" rel="noopener noreferrer"
              style={{ ...S.btn("primary"), fontSize: 12, padding: "7px 14px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
              Open BULMS ↗
            </a>
            <button style={{ ...S.btn("ghost"), fontSize: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 5 }} onClick={copyUrl}>
              <Icon d={copied ? Icons.check : Icons.copy} size={12} />
              {copied ? "Copied!" : "Copy URL"}
            </button>
          </div>
          {step === 1 && (
            <button style={{ ...S.btn("primary"), marginTop: 10, fontSize: 12, padding: "7px 14px" }} onClick={() => setStep(2)}>
              I'm logged in → Next
            </button>
          )}
        </div>
      </div>

      {/* Step 2 */}
      <div style={stepStyle(2)} onClick={() => step > 1 && setStep(2)}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: step >= 2 ? "var(--green-600)" : "var(--bg-tertiary)", color: step >= 2 ? "#fff" : "var(--text-faint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</div>
        <div style={{ flex: 1, opacity: step < 2 ? 0.4 : 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Copy your MoodleSession cookie</p>
          {step >= 2 && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                In the BULMS tab, open DevTools:
              </p>
              <div style={{ margin: "8px 0 4px", background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px" }}>
                {[
                  ["Windows / Linux", "Press F12 or Ctrl+Shift+I"],
                  ["Mac", "Press Cmd+Option+I"],
                ].map(([os, key]) => (
                  <p key={os} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                    <strong>{os}:</strong> {key}
                  </p>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 6 }}>
                Then go: <strong>Application</strong> tab → <strong>Cookies</strong> (left sidebar) →
                click <strong>bulms.bicol-u.edu.ph</strong> → find the row named <strong>MoodleSession</strong> →
                double-click its <strong>Value</strong> column → copy it (<kbd style={{ background: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>Ctrl+C</kbd>).
              </p>
              <button style={{ ...S.btn("primary"), marginTop: 10, fontSize: 12, padding: "7px 14px" }} onClick={() => setStep(3)}>
                I copied it → Next
              </button>
            </>
          )}
        </div>
      </div>

      {/* Step 3 */}
      <div style={stepStyle(3)}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: step >= 3 ? "var(--green-600)" : "var(--bg-tertiary)", color: step >= 3 ? "#fff" : "var(--text-faint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>3</div>
        <div style={{ flex: 1, opacity: step < 3 ? 0.4 : 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: step >= 3 ? 10 : 0 }}>Paste it here</p>
          {step >= 3 && (
            <>
              <div style={{ position: "relative" }}>
                <input
                  type={showVal ? "text" : "password"}
                  placeholder="Paste MoodleSession cookie value…"
                  value={cookieVal}
                  onChange={e => setCookieVal(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 40px 10px 12px", borderRadius: 10, fontSize: 13,
                    background: "var(--input-bg)", border: `1px solid ${error ? "#fca5a5" : "var(--input-border)"}`,
                    color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                />
                <button
                  onClick={() => setShowVal(x => !x)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                >
                  <Icon d={showVal ? Icons.eyeOff : Icons.eye} size={16} />
                </button>
              </div>
              {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{error}</p>}
              <div style={{ marginTop: 8, padding: "8px 12px", background: "#fefce8", borderRadius: 8, border: "1px solid #fde68a" }}>
                <p style={{ fontSize: 11.5, color: "#92400e", lineHeight: 1.5 }}>
                  🔒 Your session is encrypted with AES-256 before being stored. BUPulse never sees your Google password.
                </p>
              </div>
              <button
                style={{ ...S.btn("primary"), marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onClick={handleSubmit}
                disabled={loading || !cookieVal.trim()}
              >
                {loading ? <Spinner size={14} /> : <Icon d={Icons.link} size={14} />}
                {loading ? "Linking…" : "Link Account"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
export default function BulmsSync() {
  const [status,       setStatus]      = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [syncing,      setSyncing]     = useState(false);
  const [syncMsg,      setSyncMsg]     = useState(null);
  const [subjects,     setSubjects]    = useState([]);
  const [activities,   setActivities]  = useState([]);
  const [tab,          setTab]         = useState("activities");
  const [history,      setHistory]     = useState([]);
  const [actFilter,    setActFilter]   = useState("all");
  const [courseFilter, setCourseFilter]= useState("ALL");
  const [unlinking,    setUnlinking]   = useState(false);
  const [showConfirm,  setShowConfirm] = useState(false);
  const [showRelink,   setShowRelink]  = useState(false);

  const loadStatus = useCallback(async () => {
    try { const { data } = await api.get("/bulms/status"); setStatus(data); }
    catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadData = useCallback(async () => {
    try { const { data } = await api.get("/bulms/data"); setSubjects(data.subjects || []); setActivities(data.activities || []); }
    catch { /* ignore */ }
  }, []);

  const loadHistory = useCallback(async () => {
    try { const { data } = await api.get("/bulms/sync-history"); setHistory(data.history || []); }
    catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status?.connected) loadData(); }, [status?.connected, loadData]);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, loadHistory]);

  const handleLinkSuccess = async () => {
    setSyncMsg("✅ Account linked! Syncing your data — this may take up to 30 seconds…");
    setShowRelink(false);
    await loadStatus();
    // Poll until data appears (sync runs in background)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      await loadStatus();
      await loadData();
      if (attempts >= 8) {
        clearInterval(poll);
        setSyncMsg("✅ Linked! If no data shows yet, tap Sync Now.");
        setTimeout(() => setSyncMsg(null), 5000);
      }
    }, 4000);
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      await api.post("/bulms/sync");
      setSyncMsg("🔄 Sync started — updating in the background…");
      setTimeout(async () => { await loadStatus(); await loadData(); setSyncing(false); setSyncMsg("✅ Done!"); setTimeout(() => setSyncMsg(null), 3000); }, 8000);
    } catch (err) {
      setSyncMsg(`⚠️ ${err.response?.data?.message || "Sync failed."}`); setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try { await api.delete("/bulms/unlink"); setSubjects([]); setActivities([]); setStatus({ connected: false, status: "not_linked" }); setShowConfirm(false); }
    catch { setSyncMsg("⚠️ Failed to unlink."); }
    finally { setUnlinking(false); }
  };

  const now = new Date();
  const overdueCount = activities.filter(a => a.is_overdue).length;
  const filteredActivities = activities.filter(a => {
    const cOk = courseFilter === "ALL" || a.course_id === courseFilter;
    const fOk = actFilter === "all" ? true :
      actFilter === "overdue"   ? a.is_overdue :
      actFilter === "upcoming"  ? (!a.is_overdue && a.due_date && new Date(a.due_date) >= now) :
      actFilter === "submitted" ? (a.submission_status === "submitted" || a.submission_status === "graded") : true;
    return cOk && fOk;
  });
  const courseIds = [...new Set(activities.map(a => a.course_id))].sort();

  // ── Render loading skeleton ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 16, background: "var(--card-bg)", marginBottom: 12, animation: `bpulse 1.5s ease ${i*0.1}s infinite` }} />
      ))}
      <style>{`@keyframes bpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", animation: "bfade 0.4s ease" }}>
      <style>{`@keyframes bfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "clamp(20px,4vw,26px)", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          BULMS Sync
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Connect your university LMS to automatically import subjects, activities, and due dates.
        </p>
      </div>

      {/* Flash message */}
      {syncMsg && (
        <div style={{ ...S.card, padding: "12px 18px", marginBottom: 16, background: syncMsg.includes("⚠") ? "#fff7ed" : "#f0fdf4", borderColor: syncMsg.includes("⚠") ? "#fed7aa" : "#bbf7d0", color: syncMsg.includes("⚠") ? "#c2410c" : "#166534", fontSize: 13, fontWeight: 500 }}>
          {syncMsg}
        </div>
      )}

      {/* ── NOT LINKED / RELINK ─────────────────────────────────────────────── */}
      {(!status?.connected && !showRelink) && (
        <>
          {status?.status === "expired" && activities.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16, padding: "14px 18px", background: "#fff7ed", borderColor: "#fed7aa", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Icon d={Icons.alert} size={18} color="#c2410c" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#c2410c" }}>Session Expired</p>
                  <p style={{ fontSize: 12, color: "#92400e" }}>Your BULMS session expired. Showing cached data. Relink to sync fresh data.</p>
                </div>
              </div>
              <button style={S.btn("primary")} onClick={() => setShowRelink(true)}>Relink Account</button>
            </div>
          )}

          {(status?.status !== "expired" || activities.length === 0) && (
            <ManualLinkPanel onSuccess={handleLinkSuccess} isRelink={status?.status === "expired"} />
          )}
        </>
      )}

      {/* Relink panel (shown over existing data) */}
      {showRelink && (
        <div style={{ marginBottom: 20 }}>
          <button style={{ ...S.btn("ghost"), marginBottom: 12, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowRelink(false)}>
            ← Back to my data
          </button>
          <ManualLinkPanel onSuccess={handleLinkSuccess} isRelink />
        </div>
      )}

      {/* ── CONNECTED STATE ─────────────────────────────────────────────────── */}
      {status?.connected && !showRelink && (
        <>
          {/* Connection bar */}
          <div style={{ ...S.card, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px #dcfce7", animation: "bglow 2s ease infinite" }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  BULMS Connected
                  {status.moodle_username && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>· {status.moodle_username}</span>}
                </p>
                {status.last_sync && (
                  <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                    Last synced: {new Date(status.last_sync.started_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}
                    {status.last_sync.new_activities > 0 && <span style={{ color: "#16a34a", fontWeight: 600 }}> · {status.last_sync.new_activities} new</span>}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...S.btn("ghost"), display: "flex", alignItems: "center", gap: 6 }} onClick={handleSync} disabled={syncing}>
                {syncing ? <Spinner size={14} /> : <Icon d={Icons.refresh} size={14} />}
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
              <button style={{ ...S.btn("ghost"), display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowRelink(true)}>
                <Icon d={Icons.link} size={14} /> Relink
              </button>
              <button style={{ ...S.btn("danger"), display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowConfirm(true)}>
                Unlink
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Subjects",   value: subjects.length,                                              color: "#0ea5e9", bg: "#e0f2fe" },
              { label: "Activities", value: activities.length,                                            color: "#8b5cf6", bg: "#ede9fe" },
              { label: "Overdue",    value: overdueCount,                                                 color: "#dc2626", bg: "#fee2e2" },
              { label: "Upcoming",   value: activities.filter(a => !a.is_overdue && a.due_date).length,  color: "#16a34a", bg: "#dcfce7" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ ...S.card, padding: "14px 18px" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "var(--font-display)" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--card-bg)", padding: 4, borderRadius: 12, border: "1px solid var(--card-border)", width: "fit-content" }}>
            {[["activities","Activities"],["subjects","Subjects"],["history","Sync History"]].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: tab===k?600:400, background: tab===k?"var(--green-600)":"transparent", color: tab===k?"#fff":"var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
            ))}
          </div>

          {/* Activities tab */}
          {tab === "activities" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                {[["all","All"],["overdue",`Overdue (${overdueCount})`],["upcoming","Upcoming"],["submitted","Submitted"]].map(([k,l]) => (
                  <button key={k} onClick={() => setActFilter(k)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: actFilter===k?600:400, background: actFilter===k?"var(--green-600)":"var(--card-bg)", color: actFilter===k?"#fff":"var(--text-muted)", border: `1px solid ${actFilter===k?"var(--green-600)":"var(--card-border)"}`, cursor: "pointer" }}>{l}</button>
                ))}
                {courseIds.length > 0 && (
                  <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, background: "var(--card-bg)", color: "var(--text-muted)", border: "1px solid var(--card-border)", cursor: "pointer", outline: "none" }}>
                    <option value="ALL">All Courses</option>
                    {courseIds.map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                )}
              </div>
              {filteredActivities.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <p style={{ fontSize: 14 }}>No activities match this filter.</p>
                  {activities.length === 0 && <p style={{ fontSize: 12, marginTop: 6 }}>No activities synced yet. <button style={{ background: "none", border: "none", color: "var(--green-600)", cursor: "pointer", fontSize: 12, fontWeight: 600 }} onClick={handleSync}>Sync now</button></p>}
                </div>
              ) : filteredActivities.map(a => <ActivityCard key={a.id || a.activity_id} activity={a} />)}
            </>
          )}

          {/* Subjects tab */}
          {tab === "subjects" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
              {subjects.length === 0 ? (
                <div style={{ ...S.card, padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", gridColumn: "1/-1" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
                  <p>No subjects synced yet.</p>
                </div>
              ) : subjects.map(s => {
                const courseActs    = activities.filter(a => a.course_id === s.course_id);
                const courseOverdue = courseActs.filter(a => a.is_overdue).length;
                return (
                  <div key={s.id} style={{ ...S.card }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,var(--green-600),#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 18 }}>📖</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>{s.course_name}</p>
                    {s.short_name && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>{s.short_name}</p>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      <span style={S.badge("var(--text-muted)","var(--bg-tertiary)")}>{courseActs.length} activities</span>
                      {courseOverdue > 0 && <span style={S.badge("#dc2626","#fee2e2")}>{courseOverdue} overdue</span>}
                    </div>
                    {s.course_url && <a href={s.course_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--green-600)" }}>Open in BULMS →</a>}
                  </div>
                );
              })}
            </div>
          )}

          {/* History tab */}
          {tab === "history" && (
            <div>
              {history.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🕐</div><p>No sync history yet.</p>
                </div>
              ) : history.map(h => {
                const sc  = h.status === "success" ? "#16a34a" : h.status === "session_expired" ? "#d97706" : "#dc2626";
                const sbg = h.status === "success" ? "#dcfce7" : h.status === "session_expired" ? "#ffedd5" : "#fee2e2";
                return (
                  <div key={h.id} style={{ ...S.card, padding: "14px 18px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={S.badge(sc, sbg)}>{h.status}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{h.triggered_by === "manual" ? "Manual" : "Auto"} sync</span>
                      </div>
                      {h.status === "success" && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{h.subjects_count} subjects · {h.activities_count} activities{h.new_activities > 0 && <span style={{ color: "#16a34a", fontWeight: 600 }}> · {h.new_activities} new</span>}</p>}
                      {h.error_message && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>{h.error_message}</p>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{new Date(h.started_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}</p>
                      {h.duration_ms && <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{(h.duration_ms/1000).toFixed(1)}s</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Unlink confirm modal */}
      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ ...S.card, maxWidth: 360, width: "90%", padding: "28px 24px" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Unlink BULMS Account?</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>This will delete your stored session and all synced data. You can relink any time.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button style={{ ...S.btn("danger"), display: "flex", alignItems: "center", gap: 6 }} onClick={handleUnlink} disabled={unlinking}>
                {unlinking ? <Spinner size={14} /> : null} {unlinking ? "Unlinking…" : "Unlink"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes bglow{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(1.3)}}`}</style>
    </div>
  );
}
