import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const S = {
  card: { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "var(--shadow-sm)", marginBottom: 16 },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? "var(--green-600)" : "transparent",
    color: variant === "primary" ? "#fff" : "var(--text-muted)",
    border: variant === "primary" ? "none" : "1px solid var(--card-border)",
    padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer"
  }),
  pre: { background: "#1e293b", color: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 11, overflowX: "auto", fontFamily: "monospace", marginTop: 10 },
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
    } catch (e) {
      console.error("Load error:", e);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleManualSync = async () => {
    try {
      setLoading(true);
      const data = JSON.parse(pastedData);
      await api.post("/bulms/sync-manual-data", data);
      setSyncMsg("✅ Data Saved! Refreshing...");
      setPastedData("");
      await loadData();
    } catch (e) {
      setSyncMsg("❌ Invalid data format. Ensure you copied the full JSON block.");
    } finally {
      setLoading(false);
    }
  };

  const magicScript = `
(async () => {
  console.log("🚀 BUPulse Scraper Active...");
  const courses = [];
  document.querySelectorAll("a[href*='course/view.php?id=']").forEach(a => {
    const id = new URL(a.href).searchParams.get("id");
    let name = a.innerText.trim();
    if (id && name.length > 3 && !courses.find(c => c.course_id === id)) {
      courses.push({ course_id: id, course_name: name, course_url: a.href });
    }
  });
  const activities = [];
  for (const course of courses.slice(0, 10)) {
    console.log("Scraping: " + course.course_name);
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
  console.log("✅ DONE! Copy the line below:");
  console.log(result);
  prompt("Copy this sync data:", result);
})();`.trim();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>BULMS Sync Center</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Manually sync your Bicol University subjects and activities.</p>
      </header>

      {/* Sync Toggle */}
      {(subjects.length > 0 || activities.length > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button style={S.btn(tab === "activities" ? "primary" : "ghost")} onClick={() => setTab("activities")}>Activities ({activities.length})</button>
          <button style={S.btn(tab === "subjects" ? "primary" : "ghost")} onClick={() => setTab("subjects")}>Subjects ({subjects.length})</button>
          <button style={S.btn("ghost")} onClick={() => setTab("sync")}>+ Sync Fresh Data</button>
        </div>
      )}

      {/* Sync Step UI */}
      {(subjects.length === 0 || tab === "sync") && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={S.card}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>1. Run Scraper</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>Log into BULMS, press F12, and run this in the Console:</p>
            <pre style={S.pre}>{magicScript}</pre>
            <button style={{ ...S.btn("ghost"), marginTop: 10 }} onClick={() => navigator.clipboard.writeText(magicScript)}>Copy Script</button>
          </div>

          <div style={S.card}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>2. Paste Data</h3>
            <textarea
              style={{ width: "100%", height: 100, borderRadius: 10, padding: 12, border: "1px solid var(--card-border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
              placeholder="Paste JSON here..."
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
            />
            <button style={{ ...S.btn("primary"), marginTop: 15, width: "100%" }} onClick={handleManualSync} disabled={loading || !pastedData}>
              {loading ? "Saving..." : "Update Dashboard"}
            </button>
          </div>
        </div>
      )}

      {/* Data Views */}
      {tab === "subjects" && subjects.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
          {subjects.map(s => (
            <div key={s.course_id} style={S.card}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{s.course_name}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>ID: {s.course_id}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "activities" && activities.length > 0 && (
        <div>
          {activities.map(a => (
            <div key={a.activity_id} style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{a.activity_name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Course: {a.course_id}</p>
              </div>
              <span style={S.badge(a.activity_type === "quiz" ? "#8b5cf6" : "#0ea5e9", "var(--bg-tertiary)")}>{a.activity_type}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
