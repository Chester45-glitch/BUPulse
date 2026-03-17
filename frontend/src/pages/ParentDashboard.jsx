import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const daysInfo = (dueDate) => {
  const d = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, color: "#dc2626", bg: "#fee2e2" };
  if (d === 0) return { label: "Due today", color: "#dc2626", bg: "#fee2e2" };
  if (d === 1) return { label: "Due tomorrow", color: "#d97706", bg: "#ffedd5" };
  return { label: `${d} days left`, color: "#16a34a", bg: "#dcfce7" };
};

export default function ParentDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [linking, setLinking] = useState(false);
  const [email, setEmail] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("deadlines");
  const [dataError, setDataError] = useState("");

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await api.get("/parent/students");
      const s = res.data.students || [];
      setStudents(s);
      const active = s.find(st => !st.pending);
      if (active) setSelectedStudent(active);
      else if (s.length > 0) setSelectedStudent(s[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => { loadStudents(); }, []);

  useEffect(() => {
    if (!selectedStudent || selectedStudent.pending) {
      setStudentData(null);
      return;
    }
    setLoadingData(true);
    setDataError("");
    api.get(`/parent/student/${selectedStudent.id}/data`)
      .then(r => setStudentData(r.data))
      .catch(err => setDataError(err.response?.data?.error || "Failed to load student data"))
      .finally(() => setLoadingData(false));
  }, [selectedStudent]);

  const handleLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLinking(true); setLinkError(""); setLinkSuccess("");
    try {
      const res = await api.post("/parent/link-student", { studentEmail: email.trim() });
      if (res.data.pending) {
        setLinkSuccess(`📧 Email saved! Data will appear once ${email} logs into BUPulse.`);
      } else {
        setLinkSuccess(`✅ Successfully linked to ${res.data.student.name}!`);
      }
      setEmail("");
      await loadStudents();
    } catch (err) {
      setLinkError(err.response?.data?.error || "Failed to link student");
    } finally {
      setLinking(false);
    }
  };

  const handleRemove = async (linkId) => {
    if (!confirm("Remove this student from your monitoring list?")) return;
    await api.delete(`/parent/students/${linkId}`).catch(console.error);
    await loadStudents();
    setSelectedStudent(null);
    setStudentData(null);
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
          <h2 style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: "clamp(18px,3vw,24px)", marginBottom: 6 }}>Parent Dashboard 👨‍👩‍👧</h2>
          <p style={{ color: "#c7d2fe", fontSize: 13 }}>Monitor your child's academic progress</p>
        </div>
      </div>

      {/* Link student form */}
      <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "18px 20px", marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>🔗 Link a Student</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Enter your child's school email. They do not need to be logged in first.</p>

        {linkSuccess && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", color: "#16a34a", fontSize: 13, marginBottom: 10 }}>{linkSuccess}</div>}
        {linkError && <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 10 }}>⚠️ {linkError}</div>}

        <form onSubmit={handleLink} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="student@school.edu.ph" type="email"
            style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14 }}
          />
          <button type="submit" disabled={linking || !email.trim()} style={{
            padding: "9px 18px", borderRadius: 10, background: linking ? "#6b7280" : "#3730a3",
            color: "#fff", fontSize: 14, fontWeight: 600, cursor: linking ? "not-allowed" : "pointer", border: "none",
          }}>
            {linking ? "Linking…" : "Link Student"}
          </button>
        </form>
      </div>

      {loadingStudents ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading linked students...</div>
      ) : students.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍👩‍👧</div>
          <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>No Students Linked</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Enter your child's school email above to start monitoring.</p>
        </div>
      ) : (
        <>
          {/* Student selector tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {students.map(s => (
              <div key={s.linkId || s.email} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setSelectedStudent(s)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                  borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${selectedStudent?.email === s.email ? "#3730a3" : "var(--border-color)"}`,
                  background: selectedStudent?.email === s.email ? "#eef2ff" : "var(--card-bg)",
                }}>
                  {s.picture
                    ? <img src={s.picture} style={{ width: 24, height: 24, borderRadius: "50%" }} />
                    : <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.pending ? "#9ca3af" : "#3730a3", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.name?.charAt(0) || "?"}</div>
                  }
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {s.pending ? s.email : s.name?.split(" ")[0]}
                  </span>
                  {s.pending && <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>PENDING</span>}
                </button>
                <button onClick={() => handleRemove(s.linkId)} style={{ width: 24, height: 24, borderRadius: "50%", background: "#fee2e2", color: "#dc2626", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ))}
          </div>

          {/* Pending student message */}
          {selectedStudent?.pending && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <h3 style={{ color: "#9a3412", marginBottom: 8 }}>Waiting for Student</h3>
              <p style={{ color: "#c2410c", fontSize: 14 }}>
                Saved <strong>{selectedStudent.email}</strong>. Their data will appear here automatically once they log into BUPulse with their Google account.
              </p>
            </div>
          )}

          {/* Active student data */}
          {selectedStudent && !selectedStudent.pending && (
            <>
              {loadingData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[...Array(3)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i*0.1}s infinite` }} />)}
                </div>
              ) : dataError ? (
                <div style={{ background: "#fee2e2", borderRadius: 12, padding: "20px 24px", color: "#dc2626", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                  <p>{dataError}</p>
                </div>
              ) : studentData && (
                <div style={{ animation: "fadeIn 0.3s ease" }}>
                  {/* Student info card */}
                  <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {selectedStudent.picture
                        ? <img src={selectedStudent.picture} style={{ width: 44, height: 44, borderRadius: "50%" }} />
                        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#3730a3", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{selectedStudent.name?.charAt(0)}</div>
                      }
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{selectedStudent.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedStudent.email}</div>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {[
                          { label: "Classes", value: stats.totalCourses ?? 0, color: "#2d5a1b" },
                          { label: "Overdue", value: overdue.length, color: "#dc2626" },
                          { label: "Upcoming", value: upcoming.length, color: "#d97706" },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Read-only badge */}
                  <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👁️</span>
                    <p style={{ fontSize: 12, color: "#92400e" }}>You have <strong>read-only access</strong> to this student's information.</p>
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

                  {/* Deadlines tab */}
                  {activeTab === "deadlines" && (
                    <div>
                      {overdue.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>🚨 Overdue ({overdue.length})</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {overdue.map((d, i) => {
                              const info = daysInfo(d.dueDate);
                              return (
                                <div key={i} style={{ background: "#fff5f5", borderRadius: 10, border: "1px solid #fee2e2", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.title}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.courseName}</div>
                                  </div>
                                  <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, flexShrink: 0 }}>{info.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>📋 Upcoming ({upcoming.length})</h4>
                      {upcoming.length === 0
                        ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>🎉 No upcoming deadlines!</div>
                        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {upcoming.map((d, i) => {
                            const info = daysInfo(d.dueDate);
                            return (
                              <div key={i} style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.title}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.courseName}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(d.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</div>
                                </div>
                                <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, flexShrink: 0 }}>{info.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      }
                    </div>
                  )}

                  {/* Announcements tab */}
                  {activeTab === "announcements" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {announcements.length === 0
                        ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>📭 No announcements</div>
                        : announcements.map((ann, i) => (
                          <div key={i} style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", padding: "12px 14px" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#3730a3", marginBottom: 4 }}>{ann.courseName}</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{ann.text}</div>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* Courses tab */}
                  {activeTab === "courses" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }} className="parent-courses">
                      {courses.length === 0
                        ? <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", gridColumn: "1/-1" }}>No courses found</div>
                        : courses.map((c, i) => (
                          <div key={c.id || i} style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", padding: "12px 14px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</div>
                            {c.section && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.section}</div>}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 640px) { .parent-courses { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
