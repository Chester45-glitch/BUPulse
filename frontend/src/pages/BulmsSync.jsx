/**
 * BulmsSync.jsx — BULMS Account Linking via Official API Token
 */

import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const S = {
  card: { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "var(--shadow-sm)" },
  badge: (color, bg) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, color, background: bg }),
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const Icons = {
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  assign: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  quiz: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M12 12v4",
};

const Spinner = ({ size = 20 }) => (
  <><div style={{ width: size, height: size, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "currentColor", borderRadius: "50%", animation: "bspin 0.8s linear infinite", flexShrink: 0 }} /><style>{`@keyframes bspin{to{transform:rotate(360deg)}}`}</style></>
);

function DueBadge({ dueDate }) {
  if (!dueDate) return <span style={S.badge("var(--text-faint)", "var(--bg-tertiary)")}>No due date</span>;
  const d = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (d < 0) return <span style={S.badge("#dc2626", "#fee2e2")}>{Math.abs(d)}d overdue</span>;
  if (d === 0) return <span style={S.badge("#dc2626", "#fee2e2")}>Due today</span>;
  if (d <= 3) return <span style={S.badge("#d97706", "#ffedd5")}>{d}d left</span>;
  return <span style={S.badge("#16a34a", "#dcfce7")}>{d}d left</span>;
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
          {activity.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }} dangerouslySetInnerHTML={{__html: activity.description}}></p>}
          {activity.due_date && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Due: {new Date(activity.due_date).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}</p>}
          {activity.activity_url && (
            <a href={activity.activity_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "var(--green-600)", textDecoration: "underline" }}>
              Open in BULMS →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manual Token Link Panel ───────────────────────────────────────────────────
function ManualLinkPanel({ onSuccess, isRelink = false }) {
  const [tokenVal, setTokenVal] = useState("");
  const [showVal, setShowVal]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const handleSubmit = async () => {
    if (!tokenVal.trim()) return setError("Please paste your Moodle Token.");
    setError(null);
    setLoading(true);
    try {
      // We still use the manual endpoint, but we pass the token instead of a cookie
      await api.post("/bulms/link-manual", { moodle_session: tokenVal.trim() });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save token. Ensure you copied the exact string.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...S.card, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon d={Icons.link} size={20} color="var(--green-600)" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{isRelink ? "Relink BULMS Account" : "Connect BULMS via API"}</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Bypass the firewall using an official security key.</p>
        </div>
      </div>

      <div style={{ background: "var(--bg-tertiary)", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>How to get your token:</p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <li>Log into <strong>BULMS</strong> in your browser.</li>
          <li>Click your <strong>Profile Picture</strong> (top right) → <strong>Preferences</strong>.</li>
          <li>Click <strong>Security keys</strong>.</li>
          <li>Copy the key next to <strong>Moodle mobile web service</strong>.</li>
        </ol>
      </div>

      <div style={{ position: "relative" }}>
        <input
          type={showVal ? "text" : "password"}
          placeholder="Paste your 32-character token here..."
          value={tokenVal}
          onChange={e => setTokenVal(e.target.value)}
          style={{ width: "100%", padding: "12px 40px 12px 14px", borderRadius: 10, fontSize: 14, background: "var(--input-bg)", border: `1px solid ${error ? "#fca5a5" : "var(--input-border)"}`, color: "var(--text-primary)", outline: "none", fontFamily: "monospace" }}
        />
        <button onClick={() => setShowVal(x => !x)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
          <Icon d={showVal ? Icons.eyeOff : Icons.eye} size={16} />
        </button>
      </div>
      
      {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</p>}
      
      <button style={{ ...S.btn("primary"), marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={handleSubmit} disabled={loading || !tokenVal.trim()}>
        {loading ? <Spinner size={14} /> : <Icon d={Icons.link} size={14} />}
        {loading ? "Verifying Token…" : "Connect Account"}
      </button>
    </div>
  );
}

// MAIN COMPONENT
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
    try { const { data } = await api.get("/bulms/status"); setStatus(data); } catch { } finally { setLoading(false); }
  }, []);

  const loadData = useCallback(async () => {
    try { const { data } = await api.get("/bulms/data"); setSubjects(data.subjects || []); setActivities(data.activities || []); } catch { }
  }, []);

  const loadHistory = useCallback(async () => {
    try { const { data } = await api.get("/bulms/sync-history"); setHistory(data.history || []); } catch { }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status?.connected) loadData(); }, [status?.connected, loadData]);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, loadHistory]);

  const handleLinkSuccess = async () => {
    setSyncMsg("✅ Token accepted! Syncing data instantly…");
    setShowRelink(false);
    await loadStatus();
    await loadData();
    setSyncMsg(null);
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      await api.post("/bulms/sync");
      setSyncMsg("🔄 Syncing via API…");
      await loadStatus(); await loadData();
      setSyncing(false); setSyncMsg("✅ Sync complete!");
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (err) {
      setSyncMsg(`⚠️ ${err.response?.data?.error || "Sync failed."}`); setSyncing(false);
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

  if (loading) return <div style={{ maxWidth: 860, margin: "0 auto" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", animation: "bfade 0.4s ease" }}>
      <style>{`@keyframes bfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "clamp(20px,4vw,26px)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>BULMS Sync</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Connect via Moodle API to automatically import subjects and activities.</p>
      </div>

      {syncMsg && <div style={{ ...S.card, padding: "12px 18px", marginBottom: 16, background: syncMsg.includes("⚠") ? "#fff7ed" : "#f0fdf4", borderColor: syncMsg.includes("⚠") ? "#fed7aa" : "#bbf7d0", color: syncMsg.includes("⚠") ? "#c2410c" : "#166534", fontSize: 13, fontWeight: 500 }}>{syncMsg}</div>}

      {(!status?.connected && !showRelink) && (
        <ManualLinkPanel onSuccess={handleLinkSuccess} isRelink={status?.status === "expired"} />
      )}

      {showRelink && (
        <div style={{ marginBottom: 20 }}>
          <button style={{ ...S.btn("ghost"), marginBottom: 12, fontSize: 12 }} onClick={() => setShowRelink(false)}>← Cancel</button>
          <ManualLinkPanel onSuccess={handleLinkSuccess} isRelink />
        </div>
      )}

      {status?.connected && !showRelink && (
        <>
          <div style={{ ...S.card, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px #dcfce7" }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>API Connected {status.moodle_username && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>· {status.moodle_username}</span>}</p>
                {status.last_sync && <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>Last synced: {new Date(status.last_sync.started_at).toLocaleString("en-PH")}</p>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("ghost"), display: "flex", alignItems: "center", gap: 6 }} onClick={handleSync} disabled={syncing}>{syncing ? <Spinner size={14} /> : <Icon d={Icons.refresh} size={14} />} Sync Now</button>
              <button style={{ ...S.btn("danger"), display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowConfirm(true)}>Unlink</button>
            </div>
          </div>

          {/* Tabs & Stats */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--card-bg)", padding: 4, borderRadius: 12, border: "1px solid var(--card-border)", width: "fit-content" }}>
            {[["activities","Activities"],["subjects","Subjects"],["history","Sync History"]].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: tab===k?600:400, background: tab===k?"var(--green-600)":"transparent", color: tab===k?"#fff":"var(--text-muted)", border: "none", cursor: "pointer" }}>{l}</button>
            ))}
          </div>

          {tab === "activities" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {[["all","All"],["overdue",`Overdue (${overdueCount})`],["upcoming","Upcoming"],["submitted","Submitted"]].map(([k,l]) => (
                  <button key={k} onClick={() => setActFilter(k)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: actFilter===k?600:400, background: actFilter===k?"var(--green-600)":"var(--card-bg)", color: actFilter===k?"#fff":"var(--text-muted)", border: `1px solid ${actFilter===k?"var(--green-600)":"var(--card-border)"}`, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
              {filteredActivities.length === 0 ? <p style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No activities found.</p> : filteredActivities.map(a => <ActivityCard key={a.activity_id} activity={a} />)}
            </>
          )}

          {tab === "subjects" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
              {subjects.length === 0 ? <p style={{ textAlign: "center", gridColumn: "1/-1", padding: 40 }}>No subjects found.</p> : subjects.map(s => (
                <div key={s.id} style={S.card}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{s.course_name}</p>
                  {s.category && <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{s.category}</p>}
                </div>
              ))}
            </div>
          )}

          {tab === "history" && (
            <div>
              {history.length === 0 ? <p style={{ textAlign: "center", padding: 40 }}>No history.</p> : history.map(h => (
                <div key={h.id} style={{ ...S.card, padding: "14px 18px", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  <div><span style={S.badge(h.status === "success" ? "#16a34a" : "#dc2626", h.status === "success" ? "#dcfce7" : "#fee2e2")}>{h.status}</span></div>
                  <p style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{new Date(h.started_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ ...S.card, maxWidth: 360, width: "90%", padding: "28px 24px" }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Unlink Account?</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>This will delete your token and data.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button style={S.btn("danger")} onClick={handleUnlink}>Unlink</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
