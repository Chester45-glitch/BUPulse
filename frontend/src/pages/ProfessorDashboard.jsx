import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import AnnouncementForm from "../components/AnnouncementForm";

const BANNERS = [
  "linear-gradient(135deg,#1a3a5c,#2563eb)",
  "linear-gradient(135deg,#1a2e1a,#16a34a)",
  "linear-gradient(135deg,#4c1d95,#7c3aed)",
  "linear-gradient(135deg,#7c2d12,#ea580c)",
  "linear-gradient(135deg,#134e4a,#0d9488)",
  "linear-gradient(135deg,#831843,#db2777)",
];
const getBg = (n = "") => BANNERS[n.charCodeAt(0) % BANNERS.length];

// ── My Classes tab ────────────────────────────────────────────────
function MyClassesTab({ courses, loading, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loadStudents = async (courseId) => {
    setSelected(courseId);
    setLoadingStudents(true);
    try {
      const res = await api.get(`/professor/courses/${courseId}/students`);
      setStudents(res.data.students || []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div className="courses-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {loading
          ? [...Array(3)].map((_, i) => <div key={i} style={{ height: 150, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)
          : courses.map((course) => (
            <div key={course.id} onClick={() => loadStudents(course.id)} style={{ background: "var(--card-bg)", borderRadius: 12, border: `2px solid ${selected === course.id ? "#16a34a" : "var(--card-border)"}`, overflow: "hidden", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.boxShadow = "var(--shadow-md)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none", e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ height: 60, background: getBg(course.name), position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "14px 14px" }} />
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</div>
                {course.section && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{course.section}</div>}
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--green-700)", fontWeight: 500 }}>
                  {selected === course.id ? "▼ Viewing students" : "Click to view students"}
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Student list */}
      {selected && (
        <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "16px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            Students — {courses.find((c) => c.id === selected)?.name}
            <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 13 }}> ({students.length})</span>
          </div>
          {loadingStudents ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
              <div style={{ width: 20, height: 20, border: "2px solid var(--border-color)", borderTopColor: "var(--green-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
              Loading…
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 14 }}>No students found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {students.map((s, i) => (
                <div key={s.userId || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--bg-tertiary)" }}>
                  {s.profile?.photoUrl
                    ? <img src={s.profile.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: "50%", background: getBg(s.profile?.name?.fullName || ""), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {(s.profile?.name?.fullName || "?").charAt(0)}
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.profile?.name?.fullName || "Unknown"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.profile?.emailAddress}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function ProfessorDashboard({ defaultTab } = {}) {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [activeTab, setActiveTab] = useState(defaultTab || "overview");

  const loadData = async () => {
    setLoading(true);
    setCoursesError("");
    try {
      const [cRes, aRes] = await Promise.all([
        api.get("/professor/courses"),
        api.get("/professor/announcements").catch(() => ({ data: { announcements: [] } })),
      ]);
      setCourses(cRes.data.courses || []);
      setAnnouncements(aRes.data.announcements || []);
    } catch (err) {
      setCoursesError(err.response?.data?.error || "Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const now = new Date();

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,var(--green-900),#1e4d1e)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative" }}>
          <p style={{ color: "var(--green-200)", fontSize: 13, marginBottom: 4 }}>{now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h2 style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: "clamp(18px,3vw,26px)", marginBottom: 4 }}>
            Welcome, Prof. {user?.name?.split(" ").slice(-1)[0]}! 👨‍🏫
          </h2>
          <p style={{ color: "var(--green-200)", fontSize: 13 }}>
            {loading ? "Loading…" : `Managing ${courses.length} class${courses.length !== 1 ? "es" : ""}`}
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
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", background: activeTab === tab ? "var(--card-bg)" : "transparent", color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)", boxShadow: activeTab === tab ? "var(--shadow-sm)" : "none", border: "none", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {coursesError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#dc2626", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {coursesError}</span>
          <button onClick={loadData} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Overview */}
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
              <button onClick={() => setActiveTab("post")} style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 500, cursor: "pointer", padding: "5px 10px", borderRadius: 7, border: "1px solid var(--green-200)", background: "var(--green-50)" }}>+ New Post</button>
            </div>
            {loading ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>Loading…</div>
              : announcements.length === 0 ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 14 }}>📭 No announcements yet.</div>
              : announcements.slice(0, 5).map((ann, i) => {
                const h = Math.floor((Date.now() - new Date(ann.updateTime || ann.creationTime)) / 3600000);
                const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
                return (
                  <div key={i} style={{ padding: "10px 0", borderBottom: i < 4 ? "1px solid var(--border-color)" : "none" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green-700)", marginBottom: 3 }}>{ann.courseName}</div>
                    <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.5 }}>{ann.text?.slice(0, 140)}{ann.text?.length > 140 ? "…" : ""}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{ago}</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* Post tab — uses AnnouncementForm */}
      {activeTab === "post" && (
        <div style={{ animation: "fadeIn 0.3s ease", maxWidth: 680 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              <div style={{ width: 28, height: 28, border: "3px solid var(--border-color)", borderTopColor: "var(--green-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              Loading classes…
            </div>
          ) : (
            <AnnouncementForm
              courses={courses}
              onSuccess={async () => {
                const res = await api.get("/professor/announcements").catch(() => ({ data: { announcements: [] } }));
                setAnnouncements(res.data.announcements || []);
              }}
            />
          )}
        </div>
      )}

      {/* Classes tab */}
      {activeTab === "classes" && (
        <MyClassesTab courses={courses} loading={loading} onRefresh={loadData} />
      )}

      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width:640px)  { .prof-stats,.courses-grid{grid-template-columns:1fr!important} }
        @media (max-width:900px)  { .courses-grid{grid-template-columns:repeat(2,1fr)!important} }
      `}</style>
    </div>
  );
}
