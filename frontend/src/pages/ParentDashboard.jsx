import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [linking, setLinking] = useState(false);
  const [email, setEmail] = useState("");
  const [linkError, setLinkError] = useState("");
  const [activeTab, setActiveTab] = useState("deadlines");

  // Load linked students
  useEffect(() => {
    api.get("/parent/students").then(r => {
      const s = r.data.students || [];
      setStudents(s);
      if (s.length > 0) setSelectedStudent(s[0]);
    }).catch(console.error);
  }, []);

  // Load student data when selected changes
  useEffect(() => {
    if (!selectedStudent) return;
    setLoadingData(true);
    api.get(`/parent/student/${selectedStudent.id}/data`)
      .then(r => setStudentData(r.data))
      .catch(console.error)
      .finally(() => setLoadingData(false));
  }, [selectedStudent]);

  const handleLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLinking(true); setLinkError("");
    try {
      const res = await api.post("/parent/link-student", { studentEmail: email.trim() });
      const newStudent = res.data.student;
      setStudents(prev => [...prev.filter(s => s.id !== newStudent.id), newStudent]);
      setSelectedStudent(newStudent);
      setEmail("");
    } catch (err) {
      setLinkError(err.response?.data?.error || "Student not found");
    } finally {
      setLinking(false);
    }
  };

  const now = new Date();
  const { stats = {}, deadlines = [], announcements = [], courses = [] } = studentData || {};

  const overdue = deadlines.filter(d => new Date(d.dueDate) < now);
  const upcoming = deadlines.filter(d => new Date(d.dueDate) >= now);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1e1a5c, #3730a3)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: "clamp(18px,3vw,24px)", marginBottom: 6 }}>
            Parent Dashboard 👨‍👩‍👧
          </h2>
          <p style={{ color: "#c7d2fe", fontSize: 13 }}>Monitor your child's academic progress</p>
        </div>
      </div>

      {/* Link a student */}
      <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "18px 20px", marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
          {students.length === 0 ? "🔗 Link Your Child's Account" : "🔗 Add Another Student"}
        </h3>
        <form onSubmit={handleLink} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="student@bulsu.edu.ph" type="email"
            style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14 }}
          />
          <button type="submit" disabled={linking || !email.trim()} style={{
            padding: "9px 18px", borderRadius: 10, background: "#3730a3", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: linking ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {linking ? "Linking…" : "Link Student"}
          </button>
        </form>
        {linkError && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>⚠️ {linkError}</p>}
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>The student must have logged into BUPulse first.</p>
      </div>

      {students.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍👩‍👧</div>
          <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>No Students Linked</h3>
          <p style={{ fontSize: 14 }}>Link your child's school email above to start monitoring their progress.</p>
        </div>
      ) : (
        <>
          {/* Student selector */}
          {students.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {students.map(s => (
                <button key={s.id} onClick={() => setSelectedStudent(s)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                  borderRadius: 10, border: `2px solid ${selectedStudent?.id === s.id ? "#3730a3" : "var(--border-color)"}`,
                  background: selectedStudent?.id === s.id ? "#eef2ff" : "var(--card-bg)",
                  cursor: "pointer",
                }}>
                  {s.picture ? <img src={s.picture} style={{ width: 24, height: 24, borderRadius: "50%" }} /> : <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#3730a3", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.name?.charAt(0)}</div>}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{s.name?.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}

          {loadingData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
          ) : studentData && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {/* Student info */}
              <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                {selectedStudent?.picture
                  ? <img src={selectedStudent.picture} style={{ width: 44, height: 44, borderRadius: "50%" }} />
                  : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#3730a3", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{selectedStudent?.name?.charAt(0)}</div>
                }
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{selectedStudent?.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedStudent?.email}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { label: "Classes", value: stats.totalCourses ?? 0, color: "#2d5a1b" },
                    { label: "Overdue", value: stats.overdueCount ?? 0, color: "#dc2626" },
                    { label: "Upcoming", value: stats.upcomingCount ?? 0, color: "#d97706" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Read-only badge */}
              <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <span>👁️</span>
                <p style={{ fontSize: 12, color: "#92400e" }}>You have <strong>read-only access</strong> to your child's academic information.</p>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--bg-tertiary)", borderRadius: 10, padding: 4 }}>
                {[["deadlines", "📋 Deadlines"], ["announcements", "📢 Announcements"], ["courses", "📚 Courses"]].map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: activeTab === tab ? "var(--card-bg)" : "transparent",
                    color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
                    border: "none", transition: "all 0.15s",
                  }}>{label}</button>
                ))}
              </div>

              {/* Deadlines */}
              {activeTab === "deadlines" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {deadlines.length === 0
                    ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>🎉 No pending activities!</div>
                    : deadlines.map((d, i) => {
                      const isPast = new Date(d.dueDate) < now;
                      return (
                        <div key={i} style={{ background: "var(--card-bg)", borderRadius: 10, border: `1px solid ${isPast ? "#fee2e2" : "var(--card-border)"}`, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.title}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.courseName}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color: isPast ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {isPast ? "OVERDUE" : "PENDING"}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {new Date(d.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              )}

              {/* Announcements */}
              {activeTab === "announcements" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {announcements.map((ann, i) => (
                    <div key={i} style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#3730a3", marginBottom: 4 }}>{ann.courseName}</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{ann.text?.slice(0, 120)}{ann.text?.length > 120 ? "…" : ""}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Courses */}
              {activeTab === "courses" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }} className="parent-courses">
                  {courses.map((c, i) => (
                    <div key={c.id || i} style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                      {c.section && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.section}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @media (max-width: 640px) { .parent-courses { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
