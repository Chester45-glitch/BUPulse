import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const S = {
  card: { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "16px 20px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", marginBottom: "12px", position: "relative" },
  btn: (v = "primary") => ({
    background: v === "primary" ? "#16a34a" : v === "amber" ? "#d97706" : "transparent",
    color: v === "ghost" ? "var(--text-muted)" : "#fff",
    border: v === "ghost" ? "1px solid var(--card-border)" : "none",
    padding: "10px 16px", borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px"
  }),
  badge: (color, bg) => ({ display: "inline-flex", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg }),
  pre: { background: "#0f172a", color: "#e2e8f0", padding: 16, borderRadius: 12, fontSize: 11, overflowX: "auto", fontFamily: "monospace", marginTop: 10, lineHeight: 1.6, border: "1px solid #1e293b" }
};

export default function BulmsSync() {
  const [subjects, setSubjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState("activities");
  const [pastedData, setPastedData] = useState("");
  const [syncMsg, setSyncMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get("/bulms/data");
      setSubjects(data.subjects || []);
      setActivities(data.activities || []);
    } catch(e) { console.error(e); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleManualSync = async () => {
    if (!pastedData.trim().startsWith("{")) return setSyncMsg("❌ Invalid format. Please paste the JSON from the script.");
    try {
      setLoading(true);
      const data = JSON.parse(pastedData);
      await api.post("/bulms/sync-manual-data", data);
      setSyncMsg(`✅ Sync Successful! Found ${data.subjects.length} subjects.`);
      setPastedData("");
      await loadData();
      setTab("activities");
    } catch(e) { setSyncMsg("❌ Error parsing data. Ensure you copied the full block."); }
    finally { setLoading(false); }
  };

  const MAGIC_SCRIPT = `(async () => {
    console.log("🚀 BUPulse Pro-Scraper Active...");
    const courseMap = new Map();
    document.querySelectorAll('a[href*="course/view.php?id="]').forEach(a => {
      const id = new URL(a.href).searchParams.get("id");
      if (!id || courseMap.has(id)) return;
      const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, null, false);
      const parts = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t && !/^(Course image|Star course|Course is starred|Starred|Dismiss)$/i.test(t)) parts.push(t);
      }
      let name = parts.join(" ").trim();
      if (name.length > 2) courseMap.set(id, { course_id: id, course_name: name, course_url: a.href });
    });
    const courses = [...courseMap.values()];
    const activities = [];
    for (const c of courses.slice(0, 10)) {
      const r = await fetch(c.course_url); const h = await r.text();
      const doc = new DOMParser().parseFromString(h, "text/html");
      doc.querySelectorAll(".activity").forEach(el => {
        const a = el.querySelector("a[href*='mod/assign/'], a[href*='mod/quiz/']");
        if (a) {
          const actId = new URL(a.href).searchParams.get("id");
          activities.push({
            course_id: c.course_id, course_name: c.course_name,
            activity_id: c.course_id + "_" + actId,
            activity_name: a.innerText.replace(/Mark as done/ig, "").trim(),
            activity_type: a.href.includes("quiz") ? "quiz" : "assign",
            activity_url: a.href,
            due_date: null // Full date scraping can be added here
          });
        }
      });
    }
    const res = JSON.stringify({ subjects: courses, activities });
    prompt("✅ Done! Copy this sync data:", res);
  })();`.trim();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20 }}>BULMS Sync</h2>
      {syncMsg && <div style={{ padding: 12, borderRadius: 8, background: "#f0fdf4", marginBottom: 16 }}>{syncMsg}</div>}
      
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={S.btn(tab === "activities" ? "primary" : "ghost")} onClick={() => setTab("activities")}>Activities ({activities.length})</button>
        <button style={S.btn(tab === "subjects" ? "primary" : "ghost")} onClick={() => setTab("subjects")}>Subjects ({subjects.length})</button>
        <button style={S.btn("ghost")} onClick={() => setTab("sync")}>+ New Sync</button>
      </div>

      {tab === "sync" && (
        <div>
          <div style={S.card}>
            <h3>1. Run Script</h3>
            <pre style={S.pre}>{MAGIC_SCRIPT}</pre>
            <button style={S.btn("primary", { marginTop: 12 })} onClick={() => navigator.clipboard.writeText(MAGIC_SCRIPT)}>Copy Script</button>
          </div>
          <div style={S.card}>
            <h3>2. Paste Data</h3>
            <textarea style={{ width: "100%", height: 100, marginTop: 10 }} value={pastedData} onChange={e => setPastedData(e.target.value)} placeholder='Paste JSON result here...' />
            <button style={S.btn("amber", { marginTop: 12, width: "100%" })} onClick={handleManualSync} disabled={loading}>{loading ? "Syncing..." : "Finalize Sync"}</button>
          </div>
        </div>
      )}

      {tab === "subjects" && subjects.map(s => (
        <div key={s.course_id} style={{ ...S.card, borderTop: "4px solid #16a34a" }}>
          <p style={{ fontWeight: 700 }}>{s.course_name}</p>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {s.course_id}</span>
        </div>
      ))}

      {tab === "activities" && activities.map(a => (
        <div key={a.activity_id} style={S.card}>
          <p style={{ fontWeight: 700 }}>{a.activity_name}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.course_name}</p>
          <span style={S.badge(a.activity_type === "quiz" ? "#8b5cf6" : "#0ea5e9", "var(--bg-tertiary)")}>{a.activity_type.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}
