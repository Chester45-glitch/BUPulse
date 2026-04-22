import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: "var(--card-bg)", border: "1px solid var(--card-border)",
    borderRadius: 16, padding: "20px 24px", boxShadow: "var(--shadow-sm)",
    marginBottom: 14, position: "relative", overflow: "hidden",
  },
  btn: (v = "primary", extra = {}) => ({
    ...(v === "primary"  && { background: "var(--green-600)", color: "#fff", border: "none" }),
    ...(v === "ghost"    && { background: "transparent", color: "var(--text-muted)", border: "1px solid var(--card-border)" }),
    ...(v === "danger"   && { background: "transparent", color: "#dc2626", border: "1px solid #fca5a5" }),
    ...(v === "amber"    && { background: "#f59e0b", color: "#fff", border: "none" }),
    padding: "9px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13,
    cursor: "pointer", transition: "all 0.15s", display: "inline-flex",
    alignItems: "center", gap: 6, ...extra,
  }),
  badge: (color, bg) => ({
    display: "inline-flex", padding: "2px 9px", borderRadius: 20,
    fontSize: 11, fontWeight: 700, color, background: bg, whiteSpace: "nowrap",
  }),
  pre: {
    background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 12,
    fontSize: 11, overflowX: "auto", fontFamily: "monospace", marginTop: 10,
    lineHeight: 1.6, border: "1px solid #1e293b", maxHeight: 320,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const daysLeft = (d) => {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
};
const DueBadge = ({ date }) => {
  const d = daysLeft(date);
  if (d === null) return <span style={S.badge("var(--text-faint)", "var(--bg-tertiary)")}>No due date</span>;
  if (d < 0)    return <span style={S.badge("#dc2626", "#fee2e2")}>{Math.abs(d)}d overdue</span>;
  if (d === 0)  return <span style={S.badge("#dc2626", "#fee2e2")}>Due today</span>;
  if (d === 1)  return <span style={S.badge("#d97706", "#ffedd5")}>Tomorrow</span>;
  if (d <= 3)   return <span style={S.badge("#d97706", "#ffedd5")}>{d}d left</span>;
  return              <span style={S.badge("#16a34a", "#dcfce7")}>{d}d left</span>;
};
const SourceBadge = ({ source }) =>
  source === "google"
    ? <span style={S.badge("#1a73e8", "#e8f0fe")}>Google</span>
    : <span style={S.badge("#16a34a", "#dcfce7")}>BULMS</span>;

const Spinner = ({ s = 18 }) => (
  <div style={{ width: s, height: s, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "currentColor", borderRadius: "50%", animation: "bs 0.8s linear infinite", flexShrink: 0 }} />
);

// Locate this variable inside your BulmsSync.jsx and replace the logic
const MAGIC_SCRIPT = `(async () => {
  console.clear();
  console.log("%c🚀 BUPulse Pro-Scraper Active...", "color:#22c55e;font-weight:bold;font-size:14px");

  const courseMap = new Map();
  document.querySelectorAll('a[href*="course/view.php?id="]').forEach(a => {
    const id = new URL(a.href).searchParams.get("id");
    if (!id || courseMap.has(id)) return;

    // Advanced Text Walker: specifically filters out Moodle's hidden screen-reader labels
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, null, false);
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim();
      // Skip starred labels, image alt texts, and generic menu items
      if (t && !/^(Course image|Star course|Course is starred|Starred|Dismiss|Remove)$/i.test(t)) {
        parts.push(t);
      }
    }
    
    // Clean up the resulting name
    let name = parts.join(" ").replace(/\\s+/g, " ").trim();

    if (name && name.length > 2) {
      courseMap.set(id, { course_id: id, course_name: name, course_url: a.href });
    }
  });

  // ... (rest of the activities scraping logic remains the same as your current code)
})();`.trim();
  const courses = [...courseMap.values()].filter(c => c.course_name && c.course_name.length > 2);
  console.log(\`✅ Found \${courses.length} courses\`);

  // ── STEP 2: Scrape activities + due dates from each course page ─
  const activities = [];
  const seen = new Set();

  for (const course of courses.slice(0, 15)) {
    console.log(\`  📘 \${course.course_name}\`);
    try {
      const r = await fetch(course.course_url); const h = await r.text();
      const doc = new DOMParser().parseFromString(h, "text/html");

      doc.querySelectorAll(".activity, li.activity").forEach(el => {
        // Determine type
        const cls = el.className || "";
        let type = null;
        if (cls.includes("modtype_assign"))  type = "assign";
        else if (cls.includes("modtype_quiz")) type = "quiz";
        else if (cls.includes("modtype_forum")) type = "forum";
        if (!type) return;

        const a = el.querySelector("a[href]");
        if (!a) return;
        const actId = new URL(a.href).searchParams.get("id");
        if (!actId) return;
        const uid = course.course_id + "_" + actId;
        if (seen.has(uid)) return;
        seen.add(uid);

        // Activity name — text nodes only
        const nameWalker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, null, false);
        const nameParts = [];
        let nd;
        while ((nd = nameWalker.nextNode())) {
          const t = nd.textContent.trim();
          if (t && !/^(Mark as done|Done|Completed|Undo)$/i.test(t)) nameParts.push(t);
        }
        const name = nameParts.join(" ").replace(/\\s+/g," ").trim();
        if (!name || name.length < 2) return;

        // Due date — several possible locations in Moodle DOM
        let dueDate = null;

        // Method 1: .activity-basis date spans
        const basisEls = el.querySelectorAll(".activity-basis span, .activityiconcontainer ~ * span, .activity-date span");
        basisEls.forEach(s => {
          if (dueDate) return;
          const txt = s.innerText || s.textContent || "";
          const cleaned = txt.replace(/^(Due|Due date|Closes|Deadline)[:\\s]*/i,"").trim();
          if (cleaned) { const p = Date.parse(cleaned); if (!isNaN(p)) dueDate = new Date(p).toISOString(); }
        });

        // Method 2: time[datetime] inside the activity
        if (!dueDate) {
          const timeEl = el.querySelector("time[datetime]");
          if (timeEl) { const p = Date.parse(timeEl.getAttribute("datetime")); if (!isNaN(p)) dueDate = new Date(p).toISOString(); }
        }

        // Method 3: any text matching date-like patterns (e.g. "15 January 2025, 11:59 PM")
        if (!dueDate) {
          const txt = el.innerText || "";
          const m = txt.match(/\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{4}[^\\n]*/i);
          if (m) { const p = Date.parse(m[0].trim()); if (!isNaN(p)) dueDate = new Date(p).toISOString(); }
        }

        activities.push({
          course_id:     course.course_id,
          course_name:   course.course_name,
          activity_id:   uid,
          activity_name: name,
          activity_type: type,
          activity_url:  a.href,
          due_date:      dueDate,
        });
      });
    } catch(e) { console.warn("  ⚠ Error on", course.course_name, e.message); }
  }

  console.log(\`✅ Found \${activities.length} activities\`);
  const result = JSON.stringify({ subjects: courses, activities });

  // ── Show result in a page overlay (no length limit unlike prompt()) ─
  // Remove any existing overlay first
  document.getElementById('__bupulse_overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '__bupulse_overlay';
  overlay.style.cssText = [
    'position:fixed','top:0','left:0','right:0','bottom:0',
    'background:rgba(0,0,0,0.85)','z-index:2147483647',
    'display:flex','align-items:center','justify-content:center',
    'font-family:system-ui,sans-serif',
  ].join(';');

  overlay.innerHTML = \`
    <div style="background:#1e293b;border-radius:16px;padding:24px;max-width:640px;width:92%;box-shadow:0 25px 60px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:22px">✅</span>
        <p style="color:#f8fafc;font-weight:700;font-size:16px;margin:0;">BUPulse sync data ready!</p>
      </div>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 14px;">
        Found <strong style="color:#22c55e">\${courses.length} subjects</strong> and
        <strong style="color:#22c55e">\${activities.length} activities</strong>.
        Click <strong>Copy</strong> then paste into BUPulse.
      </p>
      <textarea id="__bupulse_ta" readonly style="
        width:100%;height:130px;background:#0f172a;color:#22c55e;
        border:1px solid #334155;border-radius:10px;padding:12px;
        font-family:monospace;font-size:11px;resize:none;box-sizing:border-box;
        outline:none;
      "></textarea>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button id="__bupulse_copy" style="
          background:#22c55e;color:#fff;border:none;padding:10px 22px;
          border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;flex:1;
        ">📋 Copy to Clipboard</button>
        <button id="__bupulse_close" style="
          background:#475569;color:#fff;border:none;padding:10px 18px;
          border-radius:8px;cursor:pointer;font-size:14px;
        ">✕ Close</button>
      </div>
    </div>
  \`;

  document.body.appendChild(overlay);

  // Fill textarea after mount (avoids innerHTML XSS issues with raw data)
  const ta = document.getElementById('__bupulse_ta');
  ta.value = result;

  document.getElementById('__bupulse_copy').onclick = () => {
    navigator.clipboard.writeText(result).then(() => {
      const btn = document.getElementById('__bupulse_copy');
      if (btn) { btn.textContent = '✅ Copied!'; btn.style.background = '#16a34a'; }
    }).catch(() => {
      // Fallback: select textarea so user can Ctrl+C manually
      ta.select(); ta.setSelectionRange(0, 999999);
      alert('Press Ctrl+C (or Cmd+C) to copy.');
    });
  };
  document.getElementById('__bupulse_close').onclick = () => overlay.remove();

  console.log(\`%c✅ Done! \${courses.length} subjects, \${activities.length} activities scraped.\`, 'color:#22c55e;font-weight:bold;font-size:13px');
})();`.trim();

// ── Activity card (shared for both Google + BULMS) ────────────────────────────
function ActivityCard({ item }) {
  const [open, setOpen] = useState(false);
  const typeColor = { quiz: "#8b5cf6", forum: "#0ea5e9", assign: "#f59e0b",
    ASSIGNMENT: "#f59e0b", SHORT_ANSWER_QUESTION: "#8b5cf6", MULTIPLE_CHOICE_QUESTION: "#8b5cf6" }[item.type] || "#6b7280";

  return (
    <div onClick={() => setOpen(x => !x)} style={{
      ...S.card, cursor: "pointer",
      borderLeft: `3px solid ${item.dueDate && daysLeft(item.dueDate) < 0 ? "#dc2626" : daysLeft(item.dueDate) !== null && daysLeft(item.dueDate) <= 1 ? "#f59e0b" : "transparent"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
            <SourceBadge source={item.source} />
            <span style={S.badge(typeColor, "var(--bg-tertiary)")}>{item.type?.replace(/_/g," ")}</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 4 }}>{item.name}</p>
          {item.courseName && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              📚 {item.courseName}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <DueBadge date={item.dueDate} />
          {item.dueDate && (
            <p style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {new Date(item.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })}
            </p>
          )}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--card-border)" }}>
          {item.dueDate && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              🗓 Due: {new Date(item.dueDate).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" })}
            </p>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: "var(--green-600)", textDecoration: "underline" }}>
              Open in {item.source === "google" ? "Google Classroom" : "BULMS"} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════════
export default function BulmsSync() {
  const [subjects,     setSubjects]     = useState([]);
  const [activities,   setActivities]   = useState([]);
  const [googleItems,  setGoogleItems]  = useState([]);
  const [status,       setStatus]       = useState(null);
  const [tab,          setTab]          = useState("all");
  const [syncFilter,   setSyncFilter]   = useState("all");
  const [pastedData,   setPastedData]   = useState("");
  const [syncMsg,      setSyncMsg]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [pageLoading,  setPageLoading]  = useState(true);
  const [showUnlink,   setShowUnlink]   = useState(false);
  const [unlinking,    setUnlinking]    = useState(false);
  const [copied,       setCopied]       = useState(false);

  // ── Load all data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [bulmsStatus, bulmsData, gcData] = await Promise.allSettled([
        api.get("/bulms/status"),
        api.get("/bulms/data"),
        api.get("/classroom/deadlines"),
      ]);
      if (bulmsStatus.status === "fulfilled") setStatus(bulmsStatus.value.data);
      if (bulmsData.status === "fulfilled") {
        setSubjects(bulmsData.value.data.subjects || []);
        setActivities(bulmsData.value.data.activities || []);
      }
      if (gcData.status === "fulfilled") {
        setGoogleItems(gcData.value.data.deadlines || []);
      }
    } catch(e) { console.error(e); }
    finally { setPageLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Merge + normalize Google + BULMS into unified list ──────────────────────
  const allItems = [
    ...googleItems.map(g => ({
      id:         g.id || g.courseWorkId,
      name:       g.title,
      courseName: g.courseName,
      dueDate:    g.dueDate || null,
      type:       g.workType || "ASSIGNMENT",
      source:     "google",
      url:        g.link || g.alternateLink,
      status:     g.submissionStatus,
    })),
    ...activities.map(b => ({
      id:         b.activity_id,
      name:       b.activity_name,
      courseName: b.course_name || subjects.find(s => s.course_id === b.course_id)?.course_name || `Course ${b.course_id}`,
      dueDate:    b.due_date || null,
      type:       b.activity_type,
      source:     "bulms",
      url:        b.activity_url,
      status:     b.submission_status,
    })),
  ].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const now = new Date();
  const filteredItems = allItems.filter(item => {
    if (syncFilter === "all")      return true;
    if (syncFilter === "overdue")  return item.dueDate && new Date(item.dueDate) < now;
    if (syncFilter === "upcoming") return !item.dueDate || new Date(item.dueDate) >= now;
    if (syncFilter === "google")   return item.source === "google";
    if (syncFilter === "bulms")    return item.source === "bulms";
    return true;
  });

  const overdueCount = allItems.filter(i => i.dueDate && new Date(i.dueDate) < now).length;

  // ── Manual sync handler ─────────────────────────────────────────────────────
  const handleManualSync = async () => {
    if (!pastedData.trim().startsWith("{")) {
      return setSyncMsg("❌ Invalid format. Paste the full JSON from the script prompt.");
    }
    try {
      setLoading(true);
      setSyncMsg(null);
      const data = JSON.parse(pastedData);
      if (!data.subjects || !data.activities) throw new Error("Missing subjects or activities keys.");
      await api.post("/bulms/sync-manual-data", data);
      setSyncMsg(`✅ Synced ${data.subjects.length} subjects and ${data.activities.length} activities!`);
      setPastedData("");
      await loadAll();
      setTab("all");
    } catch(e) {
      setSyncMsg("❌ " + (e.message || "Error parsing JSON. Copy the full prompt result."));
    } finally {
      setLoading(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  // ── Unlink ──────────────────────────────────────────────────────────────────
  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await api.delete("/bulms/unlink");
      setSubjects([]); setActivities([]);
      setStatus({ connected: false, status: "not_linked" });
      setShowUnlink(false);
      setSyncMsg("✅ BULMS account unlinked successfully.");
    } catch { setSyncMsg("❌ Failed to unlink. Try again."); }
    finally { setUnlinking(false); }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(MAGIC_SCRIPT);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (pageLoading) return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 72, borderRadius: 16, background: "var(--card-bg)", marginBottom: 12, animation: `bsp 1.5s ease ${i*0.1}s infinite` }} />
      ))}
      <style>{`@keyframes bsp{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "4px 0" }}>
      <style>{`
        @keyframes bfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes bs{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "clamp(20px,4vw,26px)", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            BULMS Integration
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Your Bicol University academic data, unified with Google Classroom.
          </p>
        </div>
        {(subjects.length > 0 || activities.length > 0) && (
          <button style={S.btn("danger")} onClick={() => setShowUnlink(true)}>
            🔗 Unlink BULMS
          </button>
        )}
      </div>

      {/* ── Flash message ──────────────────────────────────────────────────── */}
      {syncMsg && (
        <div style={{ padding: "12px 18px", borderRadius: 12, marginBottom: 16, fontWeight: 500, fontSize: 13, textAlign: "center",
          background: syncMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
          border:     `1px solid ${syncMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
          color:      syncMsg.startsWith("✅") ? "#166534" : "#991b1b",
        }}>
          {syncMsg}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "BULMS Subjects",  value: subjects.length,       color: "#16a34a", bg: "#dcfce7" },
          { label: "BULMS Tasks",     value: activities.length,     color: "#8b5cf6", bg: "#ede9fe" },
          { label: "Google Tasks",    value: googleItems.length,    color: "#1a73e8", bg: "#e8f0fe" },
          { label: "Overdue",         value: overdueCount,          color: "#dc2626", bg: "#fee2e2" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ ...S.card, padding: "14px 16px", marginBottom: 0 }}>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "var(--font-display)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "var(--card-bg)", padding: 4, borderRadius: 12, border: "1px solid var(--card-border)", width: "fit-content", flexWrap: "wrap" }}>
        {[
          ["all",      `All Activities (${allItems.length})`],
          ["subjects", `Subjects (${subjects.length})`],
          ["sync",     "+ Sync BULMS"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "7px 15px", borderRadius: 9, fontSize: 13, border: "none", cursor: "pointer",
            fontWeight: tab === k ? 600 : 400,
            background: tab === k ? (k === "sync" ? "#f59e0b" : "var(--green-600)") : "transparent",
            color: tab === k ? "#fff" : "var(--text-muted)",
            transition: "all 0.15s",
          }}>{l}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: ALL ACTIVITIES (Google + BULMS merged)
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "all" && (
        <div style={{ animation: "bfade 0.3s ease" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {[
              ["all",      "All"],
              ["overdue",  `Overdue (${overdueCount})`],
              ["upcoming", "Upcoming"],
              ["google",   "Google Only"],
              ["bulms",    "BULMS Only"],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setSyncFilter(k)} style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                fontWeight: syncFilter === k ? 600 : 400,
                background: syncFilter === k ? "var(--green-600)" : "var(--card-bg)",
                color: syncFilter === k ? "#fff" : "var(--text-muted)",
                border: `1px solid ${syncFilter === k ? "var(--green-600)" : "var(--card-border)"}`,
              }}>{l}</button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No activities match this filter.</p>
              {allItems.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                  No BULMS data yet.{" "}
                  <button onClick={() => setTab("sync")} style={{ background: "none", border: "none", color: "var(--green-600)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                    Run the sync script →
                  </button>
                </p>
              )}
            </div>
          ) : (
            filteredItems.map(item => <ActivityCard key={`${item.source}-${item.id}`} item={item} />)
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SUBJECTS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "subjects" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, animation: "bfade 0.3s ease" }}>
          {subjects.length === 0 ? (
            <div style={{ ...S.card, textAlign: "center", padding: "48px 24px", gridColumn: "1/-1" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
              <p style={{ color: "var(--text-muted)" }}>No BULMS subjects synced yet.</p>
            </div>
          ) : subjects.map(s => {
            const courseActs = activities.filter(a => a.course_id === s.course_id);
            const overdue    = courseActs.filter(a => a.due_date && new Date(a.due_date) < now).length;
            return (
              <div key={s.course_id} style={{ ...S.card, borderTop: "4px solid var(--green-600)", marginBottom: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,var(--green-600),#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 18 }}>📖</div>
                <p style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 8 }}>{s.course_name}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={S.badge("var(--text-muted)", "var(--bg-tertiary)")}>{courseActs.length} activities</span>
                  {overdue > 0 && <span style={S.badge("#dc2626", "#fee2e2")}>{overdue} overdue</span>}
                </div>
                {s.course_url && (
                  <a href={s.course_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "var(--green-600)", fontWeight: 700, textDecoration: "none" }}>
                    OPEN BULMS →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SYNC WIZARD
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "sync" && (
        <div style={{ maxWidth: 620, margin: "0 auto", animation: "bfade 0.3s ease" }}>

          {/* Step 1 */}
          <div style={{ ...S.card, borderLeft: "4px solid var(--green-600)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              Step 1 — Open BULMS & run the script
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
              Log into BULMS, then open <strong>DevTools</strong> (press <kbd style={{ background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: 5, fontSize: 11 }}>F12</kbd>), click the <strong>Console</strong> tab, paste this script, and press <kbd style={{ background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: 5, fontSize: 11 }}>Enter</kbd>.
            </p>
            <pre style={S.pre}>{MAGIC_SCRIPT}</pre>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button style={S.btn("primary")} onClick={copyScript}>
                {copied ? "✅ Copied!" : "📋 Copy Script"}
              </button>
              <a href="https://bulms.bicol-u.edu.ph" target="_blank" rel="noreferrer" style={{ ...S.btn("ghost"), textDecoration: "none" }}>
                Open BULMS ↗
              </a>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a" }}>
              <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                💡 After the script runs, a <strong>green overlay</strong> will appear on the BULMS page with a <strong>Copy to Clipboard</strong> button. Click it, then come back here and paste into Step 2.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ ...S.card, borderLeft: "4px solid #0ea5e9" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              Step 2 — Paste the result here
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              After clicking <strong>Copy to Clipboard</strong> in the overlay, paste here. It should start with <code style={{ fontSize: 11, background: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: 4 }}>{"{"}"subjects":</code>
            </p>
            <textarea
              value={pastedData}
              onChange={e => setPastedData(e.target.value)}
              placeholder='{"subjects": [...], "activities": [...]}'
              style={{
                width: "100%", height: 130, borderRadius: 12, padding: "12px 14px",
                border: "1px solid var(--input-border)", background: "var(--input-bg)",
                color: "var(--text-primary)", fontSize: 12, outline: "none",
                fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
              }}
            />
            <button
              style={{ ...S.btn("amber", { marginTop: 12, width: "100%", justifyContent: "center", height: 44 }) }}
              onClick={handleManualSync}
              disabled={loading || !pastedData.trim()}
            >
              {loading ? <><Spinner s={15} /> Syncing…</> : "⚡ Finalize Sync"}
            </button>
          </div>

          {/* What the script does */}
          <div style={{ ...S.card, background: "var(--bg-tertiary)", border: "none" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              What the script extracts
            </p>
            {[
              ["📚", "Real course names (skips \"Course image\" noise)"],
              ["📋", "Assignments and quizzes per course"],
              ["🗓", "Due dates from Moodle activity pages"],
              ["🔗", "Direct links to each activity"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Unlink confirmation modal ───────────────────────────────────────── */}
      {showUnlink && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ ...S.card, maxWidth: 360, width: "90%", marginBottom: 0 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Unlink BULMS?</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              This will delete all your synced subjects and activities from BUPulse. Your Google Classroom data is not affected. You can re-sync anytime.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => setShowUnlink(false)}>Cancel</button>
              <button style={S.btn("danger")} onClick={handleUnlink} disabled={unlinking}>
                {unlinking ? <Spinner s={14} /> : null}
                {unlinking ? "Unlinking…" : "Yes, Unlink"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
