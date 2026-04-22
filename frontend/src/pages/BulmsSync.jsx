import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

const S = {
  card: { background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "var(--shadow-sm)" },
  btn: (variant = "primary") => ({
    background: variant === "primary" ? "var(--green-600)" : "transparent",
    color: variant === "primary" ? "#fff" : "var(--text-muted)",
    border: variant === "primary" ? "none" : "1px solid var(--card-border)",
    padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer"
  }),
  pre: { background: "#1e293b", color: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 11, overflowX: "auto", fontFamily: "monospace", marginTop: 10 }
};

export default function BulmsSync() {
  const [status, setStatus] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [pastedData, setPastedData] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: sData } = await api.get("/bulms/status");
      setStatus(sData);
      const { data: dData } = await api.get("/bulms/data");
      setSubjects(dData.subjects || []);
      setActivities(dData.activities || []);
    } catch (e) {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const magicScript = `
(async () => {
  console.log("🚀 BUPulse Scraper Active...");
  const courses = [];
  document.querySelectorAll("a[href*='course/view.php?id=']").forEach(a => {
    const id = new URL(a.href).searchParams.get("id");
    const name = a.innerText.trim();
    if (id && name.length > 3 && !courses.find(c => c.course_id === id)) {
      courses.push({ course_id: id, course_name: name, course_url: a.href });
    }
  });

  const activities = [];
  for (const course of courses.slice(0, 10)) {
    console.log("Scraping: " + course.course_name);
    const res = await fetch(course.course_url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
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
  }
  const result = JSON.stringify({ subjects: courses, activities });
  console.log("✅ DONE! Copy the line below:");
  console.log(result);
  copy(result);
  alert("Sync data copied to clipboard!");
})();
  `.trim();

  const handleManualSync = async () => {
    try {
      setLoading(true);
      const data = JSON.parse(pastedData);
      await api.post("/bulms/sync-manual-data", data);
      setSyncMsg("✅ Sync Successful!");
      setPastedData("");
      loadData();
    } catch (e) {
      setSyncMsg("❌ Invalid data. Make sure you copied the entire line.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h2 style={{ marginBottom: 10 }}>BULMS Manual Sync</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Since the university firewall blocks our server, we'll use your browser to grab the data.
      </p>

      {syncMsg && <div style={{ padding: 12, borderRadius: 8, background: "var(--bg-tertiary)", marginBottom: 15 }}>{syncMsg}</div>}

      <div style={S.card}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Step 1: Copy & Run Script</h3>
        <ol style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <li>Open <strong>BULMS</strong> in a new tab and log in.</li>
          <li>Press <strong>F12</strong> (or Right-Click {'>'} Inspect) and click the <strong>Console</strong> tab.</li>
          <li>Copy the code below, paste it into the console, and press <strong>Enter</strong>.</li>
        </ol>
        <pre style={S.pre}>{magicScript}</pre>
        <button 
          style={{ ...S.btn("ghost"), marginTop: 10 }} 
          onClick={() => { navigator.clipboard.writeText(magicScript); alert("Script copied!"); }}
        >
          Copy Script Code
        </button>
      </div>

      <div style={{ ...S.card, marginTop: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Step 2: Paste Result</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          After the script finishes, it will automatically copy the result. Paste it below:
        </p>
        <textarea
          style={{ width: "100%", height: 80, borderRadius: 8, padding: 10, border: "1px solid var(--card-border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          placeholder="Paste the JSON result here..."
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
        />
        <button 
          style={{ ...S.btn("primary"), marginTop: 15, width: "100%" }} 
          onClick={handleManualSync}
          disabled={loading || !pastedData}
        >
          {loading ? "Processing..." : "Complete Sync"}
        </button>
      </div>
    </div>
  );
}
