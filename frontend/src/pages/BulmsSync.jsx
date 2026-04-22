import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const S = {
  card: { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "var(--shadow-sm)", marginBottom: 16, position: 'relative', overflow: 'hidden' },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? "var(--green-600)" : "transparent",
    color: variant === "primary" ? "#fff" : "var(--text-muted)",
    border: variant === "primary" ? "none" : "1px solid var(--card-border)",
    padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s"
  }),
  pre: { background: "#1e293b", color: "#f8fafc", padding: 15, borderRadius: 10, fontSize: 11, overflowX: "auto", fontFamily: "monospace", marginTop: 10, lineHeight: 1.5, border: "1px solid #334155" },
  badge: (color, bg) => ({ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg })
};

export default function BulmsSync() {
  const [status, setStatus] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pastedData, setPastedData] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("activities");

  const loadData = useCallback(async () => {
    try {
      const { data: sData } = await api.get("/bulms/status");
      setStatus(sData);
      const { data: dData } = await api.get("/bulms/data");
      setSubjects(dData.subjects || []);
      setActivities(dData.activities || []);
    } catch (e) { console.error("Load error:", e); }
  }, []);

  useEffect(() => { 
    loadData(); 
  }, [loadData]);

  // If we have data, default to activities tab
  useEffect(() => {
    if (subjects.length > 0) setTab("activities");
  }, [subjects.length]);

  const handleManualSync = async () => {
    if (!pastedData.startsWith('{')) return setSyncMsg("❌ Invalid format. Please paste the JSON block.");
    try {
      setLoading(true);
      const data = JSON.parse(pastedData);
      await api.post("/bulms/sync-manual-data", data);
      setSyncMsg("✅ Sync Successful!");
      setPastedData("");
      await loadData();
      setTab("activities");
    } catch (e) {
      setSyncMsg("❌ Error parsing JSON. Ensure you copied the full prompt result.");
    } finally {
      setLoading(false);
    }
  };

  const magicScript = `(async () => {
  console.log("🚀 BUPulse Pro-Scraper Active...");
  const courses = [];
  document.querySelectorAll(".coursename, .card-title, .multiline").forEach(el => {
    const a = el.closest('a') || el.querySelector('a');
    if (!a) return;
    const id = new URL(a.href).searchParams.get("id");
    let name = el.innerText.replace(/Course image/ig, '').replace(/Star course/ig, '').trim();
    if (id && name.length > 3 && !courses.find(c => c.course_id === id)) {
      courses.push({ course_id: id, course_name: name, course_url: a.href });
    }
  });
  const activities = [];
  for (const course of courses.slice(0, 12)) {
    console.log("Syncing: " + course.course_name);
    try {
      const res = await fetch(course.course_url);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll(".activity").forEach(el => {
        const a = el.querySelector("a[href*='mod/assign/'], a[href*='mod/quiz/']");
        if (a) {
          const actId = new URL(a.href).searchParams.get("id");
          activities.push({
            course_id: course.course_id,
            activity_id: course.course_id + "_" + actId,
            activity_name: a.innerText.replace(/Mark as done/ig, "").trim(),
            activity_type: a.href.includes("quiz") ? "quiz" : "assign",
            activity_url: a.href
          });
        }
      });
    } catch (e) { console.error(e); }
  }
  const result = JSON.stringify({ subjects: courses, activities });
  prompt("✅ Done! Copy this sync data:", result);
})();`.trim();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 10px" }}>
      <header style={{ marginBottom: 30, textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>BULMS Integration</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginTop: 5 }}>Your Bicol University academic data, synced locally.</p>
      </header>

      {syncMsg && (
        <div style={{ padding: "14px 20px", borderRadius: 12, background: syncMsg.includes("✅") ? "#f0fdf4" : "#fef2f2", border: `1px solid ${syncMsg.includes("✅") ? "#bbf7d0" : "#fecaca"}`, color: syncMsg.includes("✅") ? "#166534" : "#991b1b", marginBottom: 20, fontWeight: 500, fontSize: 14, textAlign: 'center' }}>
          {syncMsg}
        </div>
      )}

      {/* View Switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 25, justifyContent: 'center' }}>
        <button style={S.btn(tab === "activities" ? "primary" : "ghost")} onClick={() => setTab("activities")}>Activities ({activities.length})</button>
        <button style={S.btn(tab === "subjects" ? "primary" : "ghost")} onClick={() => setTab("subjects")}>Subjects ({subjects.length})</button>
        <button style={S.btn(tab === "sync" ? "primary" : "ghost")} onClick={() => setTab("sync")}>+ New Sync</button>
      </div>

      {/* Manual Sync Wizard */}
      {tab === "sync" && (
        <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 600, margin: '0 auto' }}>
          <div style={S.card}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--green-600)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>1. Copy Scraper Script</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 15 }}>Run this in the BULMS console (F12) while logged in.</p>
            <pre style={S.pre}>{magicScript}</pre>
            <button style={{ ...S.btn("ghost"), marginTop: 12, width: '100%' }} onClick={() => { navigator.clipboard.writeText(magicScript); alert("Copied!"); }}>Copy to Clipboard</button>
          </div>

          <div style={S.card}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0ea5e9' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>2. Paste Resulting Data</h3>
            <textarea
              style={{ width: "100%", height: 120, borderRadius: 12, padding: 15, border: "1px solid var(--card-border)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 13, outline: 'none' }}
              placeholder='{"subjects": [...'
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
            />
            <button style={{ ...S.btn("primary"), marginTop: 15, width: "100%", height: 45 }} onClick={handleManualSync} disabled={loading || !pastedData}>
              {loading ? "Syncing Data..." : "Finalize Sync"}
            </button>
          </div>
        </div>
      )}

      {/* Activities View */}
      {tab === "activities" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No activities synced yet.</div>
          ) : (
            activities.map(a => (
              <div key={a.activity_id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: a.activity_type === 'quiz' ? '#8b5cf6' : '#0ea5e9' }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{a.activity_name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Course ID: {a.course_id}</p>
                </div>
                <span style={S.badge(a.activity_type === "quiz" ? "#8b5cf6" : "#0ea5e9", "var(--bg-tertiary)")}>
                  {a.activity_type.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Subjects View */}
      {tab === "subjects" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, animation: "fadeIn 0.3s ease" }}>
          {subjects.map(s => (
            <div key={s.course_id} style={{ ...S.card, padding: 24, borderTop: '5px solid var(--green-600)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 15, fontSize: 20 }}>📚</div>
              <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.4 }}>{s.course_name}</p>
              <div style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>ID: {s.course_id}</span>
                <a href={s.course_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--green-600)", fontWeight: 700, textDecoration: 'none' }}>OPEN BULMS →</a>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        textarea:focus { border-color: var(--green-600) !important; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1); }
      `}</style>
    </div>
  );
}
