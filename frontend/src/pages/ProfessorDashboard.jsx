import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// ── Banner colors per course ─────────────────────────────────────
const BANNERS = [
  "linear-gradient(135deg,#1a3a5c,#2563eb)",
  "linear-gradient(135deg,#1a2e1a,#16a34a)",
  "linear-gradient(135deg,#4c1d95,#7c3aed)",
  "linear-gradient(135deg,#7c2d12,#ea580c)",
  "linear-gradient(135deg,#134e4a,#0d9488)",
  "linear-gradient(135deg,#831843,#db2777)",
];
const getBg = (n = "") => BANNERS[n.charCodeAt(0) % BANNERS.length];

// ── Icons ────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Multi-class selector component ───────────────────────────────
function ClassSelector({ courses, selectedIds, onChange }) {
  const allSelected = selectedIds.length === courses.length;

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : courses.map((c) => c.id));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          Select Classes * ({selectedIds.length} selected)
        </label>
        <button
          type="button"
          onClick={toggleAll}
          style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--green-200)", background: "var(--green-50)" }}
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", padding: 2 }}>
        {courses.map((course) => {
          const checked = selectedIds.includes(course.id);
          return (
            <button
              key={course.id}
              type="button"
              onClick={() => toggle(course.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, textAlign: "left", width: "100%",
                border: `1.5px solid ${checked ? "#16a34a" : "var(--card-border)"}`,
                background: checked ? "rgba(22,163,74,0.06)" : "var(--card-bg)",
                cursor: "pointer", transition: "all 0.13s",
              }}
            >
              {/* Color dot */}
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: getBg(course.name).split(",")[1]?.trim().replace(")", ""), flexShrink: 0 }} />

              {/* Checkbox */}
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "#16a34a" : "var(--border-color)"}`, background: checked ? "#16a34a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.13s", color: "#fff" }}>
                {checked && <IconCheck />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: checked ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {course.name}
                </div>
                {course.section && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{course.section}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────
export default function ProfessorDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [text, setText] = useState("");
  const [success, setSuccess] = useState("");
  const [postError, setPostError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const loadData = async () => {
    setLoading(true);
    setCoursesError("");
    try {
      const [cRes, aRes] = await Promise.all([
        api.get("/professor/courses"),
        api.get("/professor/announcements").catch(() => ({ data: { announcements: [] } })),
      ]);
      const c = cRes.data.courses || [];
      setCourses(c);
      setAnnouncements(aRes.data.announcements || []);
    } catch (err) {
      setCoursesError(
        err.response?.data?.error || "Failed to load classes. Make sure you're logged in as a professor."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) return setPostError("Please select at least one class.");
    if (!text.trim()) return setPostError("Please write an announcement.");

    setPosting(true);
    setPostError("");
    setSuccess("");

    try {
      const res = await api.post("/professor/announcements", {
        courseIds: selectedIds,
        text: text.trim(),
      });
      setSuccess(res.data.message || "✅ Announcement posted successfully!");
      setText("");
      setSelectedIds([]);
      // Refresh announcement list
      const aRes = await api.get("/professor/announcements");
      setAnnouncements(aRes.data.announcements || []);
    } catch (err) {
      setPostError(err.response?.data?.error || "Failed to post. Check your permissions.");
    } finally {
      setPosting(false);
    }
  };

  const now = new Date();

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,var(--green-900),#1e4d1e)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative" }}>
          <p style={{ color: "var(--green-200)", fontSize: 13, marginBottom: 4 }}>
            {now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h2 style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: "clamp(18px,3vw,26px)", marginBottom: 4 }}>
            Welcome, Prof. {user?.name?.split(" ").slice(-1)[0]}! 👨‍🏫
          </h2>
          <p style={{ color: "var(--green-200)", fontSize: 13 }}>
            {loading ? "Loading classes…" : `Managing ${courses.length} active class${courses.length !== 1 ? "es" : ""}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-tertiary)", borderRadius: 10, padding: 4 }}>
        {[
          ["overview", "📊 Overview"],
          ["post", "📢 Post Announcement"],
          ["classes", "📚 My Classes"],
        ].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: activeTab === tab ? "var(--card-bg)" : "transparent",
            color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: activeTab === tab ? "var(--shadow-sm)" : "none",
            border: "none", transition: "all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* Error banner */}
      {coursesError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#dc2626", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {coursesError}</span>
          <button onClick={loadData} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div className="prof-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { icon: "📚", label: "Active Classes", value: loading ? "…" : courses.length },
              { icon: "📢", label: "Total Posts", value: loading ? "…" : announcements.length },
              { icon: "📝", label: "This Month", value: loading ? "…" : announcements.filter((a) => new Date(a.updateTime) >= new Date(now.getFullYear(), now.getMonth(), 1)).length },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "16px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 50, height: 50, background: "rgba(22,163,74,0.08)", borderRadius: "0 12px 0 30px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{s.icon}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Recent Posts</h3>
              <button onClick={() => setActiveTab("post")} style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, cursor: "pointer", padding: "5px 10px", borderRadius: 7, border: "1px solid var(--green-200)", background: "var(--green-50)" }}>
                + New Post
              </button>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>Loading…</div>
            ) : announcements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <p style={{ fontSize: 14 }}>No announcements yet. Post one!</p>
              </div>
            ) : (
              announcements.slice(0, 5).map((ann, i) => {
                const h = Math.floor((Date.now() - new Date(ann.updateTime || ann.creationTime)) / 3600000);
                const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
                return (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < Math.min(announcements.length, 5) - 1 ? "1px solid var(--border-color)" : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green-700)", marginBottom: 4 }}>{ann.courseName}</div>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{ann.text?.slice(0, 150)}{ann.text?.length > 150 ? "…" : ""}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{ago}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Post Announcement tab ── */}
      {activeTab === "post" && (
        <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 640 }}>
          <div style={{ background: "var(--card-bg)", borderRadius: 14, border: "1px solid var(--card-border)", padding: "24px", boxShadow: "var(--shadow-sm)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Post Announcement</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Post directly to Google Classroom — one class or many at once.
            </p>

            {success && (
              <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", color: "#16a34a", fontSize: 14, marginBottom: 16 }}>
                {success}
              </div>
            )}
            {postError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
                ⚠️ {postError}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                <div style={{ width: 32, height: 32, border: "3px solid var(--border-color)", borderTopColor: "var(--green-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                Loading your classes…
              </div>
            ) : courses.length === 0 ? (
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "16px", color: "#9a3412" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠️ No classes found</div>
                <p style={{ fontSize: 13 }}>No active courses where you are listed as a teacher.</p>
                <button onClick={loadData} style={{ marginTop: 10, padding: "7px 14px", borderRadius: 8, background: "#ea580c", color: "#fff", border: "none", fontSize: 13, cursor: "pointer" }}>Retry</button>
              </div>
            ) : (
              <form onSubmit={handlePost}>
                {/* Multi-class selector */}
                <div style={{ marginBottom: 18 }}>
                  <ClassSelector courses={courses} selectedIds={selectedIds} onChange={setSelectedIds} />
                </div>

                {/* Announcement text */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Announcement *
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. No class tomorrow. Please review Chapter 5 and prepare questions…"
                    rows={5}
                    style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "var(--font-body)", lineHeight: 1.6 }}
                    onFocus={(e) => (e.target.style.borderColor = "#16a34a")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--input-border)")}
                  />
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
                    {text.length} characters
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={posting || selectedIds.length === 0 || !text.trim()}
                  style={{
                    padding: "12px 24px", borderRadius: 10,
                    background: posting || selectedIds.length === 0 || !text.trim() ? "#9ca3af" : "var(--green-800)",
                    color: "#fff", fontSize: 14, fontWeight: 600,
                    cursor: posting || selectedIds.length === 0 || !text.trim() ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 8, border: "none", transition: "background 0.15s",
                  }}
                >
                  {posting ? (
                    <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Posting…</>
                  ) : (
                    `📢 Post to ${selectedIds.length} Class${selectedIds.length !== 1 ? "es" : ""}`
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Classes tab ── */}
      {activeTab === "classes" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {loading ? (
            <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: 160, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
              <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>No Classes Found</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No active courses where you are listed as a teacher.</p>
              <button onClick={loadData} style={{ marginTop: 16, padding: "9px 20px", borderRadius: 10, background: "var(--green-800)", color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}>Refresh</button>
            </div>
          ) : (
            <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {courses.map((course) => (
                <a key={course.id} href={course.alternateLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <div
                    style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)", transition: "all 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.boxShadow = "var(--shadow-md)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "var(--shadow-sm)")}
                  >
                    <div style={{ height: 70, background: getBg(course.name), position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "16px 16px" }} />
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</div>
                      {course.section && <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{course.section}</div>}
                      {course.room && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>📍 {course.room}</div>}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ background: "var(--green-50)", color: "var(--green-700)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>ACTIVE</span>
                        <span style={{ color: "var(--green-700)", fontSize: 12, fontWeight: 500 }}>Open →</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 640px)  { .prof-stats, .courses-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 900px)  { .courses-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  );
}
