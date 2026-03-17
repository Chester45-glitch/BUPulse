import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function ProfessorDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ courseId: "", text: "" });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    Promise.all([
      api.get("/professor/courses"),
      api.get("/professor/announcements"),
    ]).then(([cRes, aRes]) => {
      setCourses(cRes.data.courses || []);
      setAnnouncements(aRes.data.announcements || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!form.courseId || !form.text.trim()) return setError("Please select a course and write an announcement.");
    setPosting(true); setError(""); setSuccess("");
    try {
      await api.post("/professor/announcements", form);
      setSuccess("Announcement posted successfully!");
      setForm(f => ({ ...f, text: "" }));
      // Refresh announcements
      const res = await api.get("/professor/announcements");
      setAnnouncements(res.data.announcements || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to post announcement.");
    } finally {
      setPosting(false);
    }
  };

  const now = new Date();
  const BANNERS = ["linear-gradient(135deg,#1a3a5c,#2563eb)","linear-gradient(135deg,#1a2e1a,#16a34a)","linear-gradient(135deg,#4c1d95,#7c3aed)","linear-gradient(135deg,#7c2d12,#ea580c)","linear-gradient(135deg,#134e4a,#0d9488)","linear-gradient(135deg,#831843,#db2777)"];
  const getBg = (n = "") => BANNERS[n.charCodeAt(0) % BANNERS.length];

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, var(--green-900), #1e4d1e)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative" }}>
          <p style={{ color: "var(--green-200)", fontSize: 13, marginBottom: 4 }}>
            {now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h2 style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: "clamp(18px,3vw,26px)", marginBottom: 6 }}>
            Welcome, Prof. {user?.name?.split(" ").slice(-1)[0]}! 👨‍🏫
          </h2>
          <p style={{ color: "var(--green-200)", fontSize: 13 }}>Managing {courses.length} active class{courses.length !== 1 ? "es" : ""}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-tertiary)", borderRadius: 10, padding: 4 }}>
        {[["overview", "📊 Overview"], ["post", "📢 Post Announcement"], ["classes", "📚 My Classes"]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: activeTab === tab ? "var(--card-bg)" : "transparent",
            color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: activeTab === tab ? "var(--shadow-sm)" : "none",
            border: "none", transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }} className="prof-stats">
            {[
              { icon: "📚", label: "Active Classes", value: courses.length, color: "rgba(45,90,27,0.1)" },
              { icon: "📢", label: "Announcements", value: announcements.length, color: "rgba(37,99,235,0.1)" },
              { icon: "👥", label: "Total Students", value: "—", color: "rgba(124,58,237,0.1)" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "16px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 50, height: 50, background: s.color, borderRadius: "0 12px 0 30px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{s.icon}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Recent announcements */}
          <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Recent Announcements</h3>
            {announcements.length === 0
              ? <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><p>No announcements yet</p></div>
              : announcements.slice(0, 5).map((ann, i) => {
                const h = Math.floor((Date.now() - new Date(ann.updateTime || ann.creationTime)) / 3600000);
                const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
                return (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < 4 ? "1px solid var(--border-color)" : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green-700)", marginBottom: 4 }}>{ann.courseName}</div>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{ann.text?.slice(0, 120)}{ann.text?.length > 120 ? "…" : ""}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{ago}</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* Post announcement tab */}
      {activeTab === "post" && (
        <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 600 }}>
          <div style={{ background: "var(--card-bg)", borderRadius: 14, border: "1px solid var(--card-border)", padding: "24px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Post New Announcement</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Post directly to Google Classroom</p>

            {success && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px", color: "#16a34a", fontSize: 14, marginBottom: 16 }}>✅ {success}</div>}
            {error && <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>⚠️ {error}</div>}

            <form onSubmit={handlePost}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Select Class *</label>
                <select value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--input-border)",
                  background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer",
                }}>
                  <option value="">-- Choose a class --</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Announcement *</label>
                <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                  placeholder="e.g. No class tomorrow due to faculty meeting. Please review Chapter 5..." rows={5}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid var(--input-border)",
                    background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14, resize: "vertical",
                    outline: "none", fontFamily: "var(--font-body)", lineHeight: 1.6,
                  }}
                />
              </div>

              <button type="submit" disabled={posting || !form.courseId || !form.text.trim()} style={{
                padding: "12px 24px", borderRadius: 10, background: posting ? "#9ca3af" : "var(--green-800)",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: posting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {posting ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Posting...</> : "📢 Post to Classroom"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Classes tab */}
      {activeTab === "classes" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {courses.map((course, i) => (
              <a key={course.id} href={course.alternateLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)", transition: "all 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.boxShadow = "var(--shadow-md)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "var(--shadow-sm)")}
                >
                  <div style={{ height: 70, background: getBg(course.name), position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "16px 16px" }} />
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{course.name}</div>
                    {course.section && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{course.section}</div>}
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ color: "var(--green-700)", fontSize: 12, fontWeight: 500 }}>Open →</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) { .prof-stats { grid-template-columns: 1fr !important; } .courses-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
