import { sanitizeAnnouncement } from "../utils/sanitizeHtml";
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
  const [annCourseFilter, setAnnCourseFilter] = useState("all");
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState("all");

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

    // Load attendance for this student
    setAttendanceLoading(true);
    setAttendance([]);
    setAttendanceFilter("all");
    setAnnCourseFilter("all");
    api.get(`/parent/student/${selectedStudent.id}/attendance`)
      .then(r => setAttendance(r.data.records || []))
      .catch(() => setAttendance([]))
      .finally(() => setAttendanceLoading(false));
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
                    {[["deadlines", "📋 Deadlines"], ["attendance", "✅ Attendance"], ["announcements", "📢 Announcements"], ["courses", "📚 Courses"]].map(([tab, label]) => (
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
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                            <span style={{ fontSize:15, fontWeight:800, color:"#dc2626" }}>🚨 Overdue</span>
                            <span style={{ background:"#dc2626", color:"#fff", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99 }}>{overdue.length}</span>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                            {overdue.map((d, i) => {
                              const info = daysInfo(d.dueDate);
                              return (
                                <div key={i} style={{ background:"#fff5f5", borderRadius:12, border:"1.5px solid #fecaca", padding:"14px 16px" }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:6 }}>
                                    <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", lineHeight:1.35 }}>{d.title}</div>
                                    <span style={{ background:info.bg, color:info.color, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:99, flexShrink:0, whiteSpace:"nowrap" }}>{info.label}</span>
                                  </div>
                                  <div style={{ fontSize:13, color:"#dc2626", fontWeight:600, marginBottom:3 }}>{d.courseName}</div>
                                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>{new Date(d.dueDate).toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)" }}>📋 Upcoming</span>
                        <span style={{ background:"var(--bg-tertiary)", color:"var(--text-secondary)", fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99 }}>{upcoming.length}</span>
                      </div>
                      {upcoming.length === 0
                        ? <div style={{ textAlign:"center", padding:28, color:"var(--text-muted)" }}>🎉 No upcoming deadlines!</div>
                        : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          {upcoming.map((d, i) => {
                            const info = daysInfo(d.dueDate);
                            return (
                              <div key={i} style={{ background:"var(--card-bg)", borderRadius:12, border:"1px solid var(--card-border)", padding:"14px 16px" }}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:6 }}>
                                  <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", lineHeight:1.35 }}>{d.title}</div>
                                  <span style={{ background:info.bg, color:info.color, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:99, flexShrink:0, whiteSpace:"nowrap" }}>{info.label}</span>
                                </div>
                                <div style={{ fontSize:13, color:"var(--text-secondary)", fontWeight:600, marginBottom:4 }}>{d.courseName}</div>
                                <div style={{ fontSize:12, color:"var(--text-muted)" }}>{new Date(d.dueDate).toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</div>
                              </div>
                            );
                          })}
                        </div>
                      }
                    </div>
                  )}

                  {/* Announcements tab */}
                  {activeTab === "announcements" && (() => {
                    const uniqueCourses = [...new Set(announcements.map(a => a.courseName).filter(Boolean))];
                    const filteredAnn = annCourseFilter === "all"
                      ? announcements
                      : announcements.filter(a => a.courseName === annCourseFilter);
                    const timeAgo = iso => {
                      if (!iso) return "";
                      const m = Math.floor((Date.now()-new Date(iso))/60000);
                      if (m<1) return "Just now"; if (m<60) return `${m}m ago`;
                      const h=Math.floor(m/60); if (h<24) return `${h}h ago`;
                      return `${Math.floor(h/24)}d ago`;
                    };
                    return (
                      <div>
                        {/* Course filter pills */}
                        {uniqueCourses.length > 1 && (
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                            {["all", ...uniqueCourses].map(c => {
                              const active = annCourseFilter === c;
                              const label = c==="all" ? "All Courses" : c.length>22 ? c.slice(0,21)+"…" : c;
                              return (
                                <button key={c} onClick={() => setAnnCourseFilter(c)}
                                  style={{ padding:"4px 12px", borderRadius:99, fontSize:11.5, fontWeight:active?700:400,
                                    border:`1.5px solid ${active?"#3730a3":"var(--border-color)"}`,
                                    background:active?"rgba(55,48,163,0.1)":"transparent",
                                    color:active?"#3730a3":"var(--text-muted)", cursor:"pointer", transition:"all 0.12s" }}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {filteredAnn.length === 0
                          ? <div style={{ textAlign:"center", padding:28, color:"var(--text-muted)" }}>📭 No announcements</div>
                          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                            {filteredAnn.map((ann, i) => {
                              const isUrgent = ann.priority === "urgent";
                              const cleanText = sanitizeAnnouncement(ann.text || "");
                              return (
                                <div key={i} style={{ background:"var(--card-bg)", borderRadius:12,
                                  border:`1.5px solid ${isUrgent?"#fecaca":"var(--card-border)"}`,
                                  overflow:"hidden" }}>
                                  {isUrgent && (
                                    <div style={{ background:"#dc2626", padding:"5px 14px", fontSize:11.5, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", gap:6 }}>
                                      🔴 URGENT ANNOUNCEMENT
                                    </div>
                                  )}
                                  <div style={{ padding:"12px 14px" }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                                      <div style={{ fontSize:13, fontWeight:700, color:"#3730a3" }}>{ann.courseName}</div>
                                      <div style={{ fontSize:11, color:"var(--text-faint)", flexShrink:0 }}>{timeAgo(ann.updateTime||ann.creationTime)}</div>
                                    </div>
                                    <div style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", lineHeight:1.5, marginBottom:4, whiteSpace:"pre-line" }}>
                                      {cleanText.length > 200 ? cleanText.slice(0,200)+"…" : cleanText}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        }
                      </div>
                    );
                  })()}

                  {/* Attendance tab */}
                  {activeTab === "attendance" && (() => {
                    const statusCfg = {
                      present: { bg:"#dcfce7", color:"#16a34a", label:"Present" },
                      absent:  { bg:"#fee2e2", color:"#dc2626", label:"Absent"  },
                      late:    { bg:"#fef9c3", color:"#ca8a04", label:"Late"    },
                    };
                    const uniqueClasses = [...new Set(attendance.map(r => r.class_id))];
                    const filtered = attendanceFilter === "all"
                      ? attendance
                      : attendance.filter(r => r.class_id === attendanceFilter);
                    const fmtDate = d => !d ? "" : new Date(d).toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",year:"numeric"});

                    return (
                      <div>
                        {attendanceLoading ? (
                          <div style={{ textAlign:"center", padding:32, color:"var(--text-muted)" }}>
                            <div style={{ width:28,height:28,border:"3px solid var(--border-color)",borderTopColor:"#16a34a",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px" }}/>
                            Loading attendance…
                          </div>
                        ) : attendance.length === 0 ? (
                          <div style={{ textAlign:"center", padding:36, color:"var(--text-muted)" }}>
                            <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
                            <p style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>No attendance records found</p>
                            <p style={{ fontSize:12 }}>Attendance will appear here once the student's classes post records.</p>
                          </div>
                        ) : (
                          <>
                            {/* Summary */}
                            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                              {["present","absent","late"].map(s => {
                                const count = filtered.reduce((acc,r)=>acc+(r.names||[]).filter(n=>n.status===s).length,0);
                                const cfg = statusCfg[s];
                                return (
                                  <div key={s} style={{ background:cfg.bg, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                                    <div style={{ fontSize:22, fontWeight:700, color:cfg.color }}>{count}</div>
                                    <div style={{ fontSize:11, color:cfg.color, fontWeight:600 }}>{cfg.label}</div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Class filter pills */}
                            {uniqueClasses.length > 1 && (
                              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
                                {["all", ...uniqueClasses].map(id => {
                                  const name = id==="all" ? "All Classes" : attendance.find(r=>r.class_id===id)?.class_name||id;
                                  const active = attendanceFilter === id;
                                  return (
                                    <button key={id} onClick={()=>setAttendanceFilter(id)}
                                      style={{ padding:"4px 12px", borderRadius:99, fontSize:11.5, fontWeight:active?700:400,
                                        border:`1.5px solid ${active?"#3730a3":"var(--border-color)"}`,
                                        background:active?"rgba(55,48,163,0.1)":"transparent",
                                        color:active?"#3730a3":"var(--text-muted)", cursor:"pointer" }}>
                                      {name.length>22 ? name.slice(0,21)+"…" : name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Records */}
                            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                              {filtered.map((record, i) => {
                                const isVerified = record.is_verified===true;
                                const present = (record.names||[]).filter(n=>n.status==="present").length;
                                const absent  = (record.names||[]).filter(n=>n.status==="absent").length;
                                const late    = (record.names||[]).filter(n=>n.status==="late").length;
                                return (
                                  <div key={record.id||i} style={{ background:"var(--card-bg)", borderRadius:12,
                                    border:`1.5px solid ${isVerified?"rgba(22,163,74,0.35)":"var(--card-border)"}`,
                                    overflow:"hidden" }}>
                                    {isVerified && (
                                      <div style={{ background:"rgba(22,163,74,0.08)", padding:"5px 14px", fontSize:11.5, color:"#16a34a", fontWeight:700, display:"flex", alignItems:"center", gap:6, borderBottom:"1px solid rgba(22,163,74,0.2)" }}>
                                        ✅ Verified {record.verifier?.name ? `by ${record.verifier.name}` : ""}
                                      </div>
                                    )}
                                    <div style={{ padding:"12px 14px" }}>
                                      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                                        <div>
                                          <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{record.class_name}</div>
                                          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>
                                            {fmtDate(record.record_date)}
                                            {record.session_label ? ` · ${record.session_label}` : ""}
                                          </div>
                                        </div>
                                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"flex-start" }}>
                                          {present>0 && <span style={{ padding:"2px 8px", borderRadius:99, background:"#dcfce7", color:"#16a34a", fontSize:11, fontWeight:700 }}>{present} Present</span>}
                                          {absent>0  && <span style={{ padding:"2px 8px", borderRadius:99, background:"#fee2e2", color:"#dc2626", fontSize:11, fontWeight:700 }}>{absent} Absent</span>}
                                          {late>0    && <span style={{ padding:"2px 8px", borderRadius:99, background:"#fef9c3", color:"#ca8a04", fontSize:11, fontWeight:700 }}>{late} Late</span>}
                                        </div>
                                      </div>
                                      {record.poster && (
                                        <div style={{ fontSize:11.5, color:"var(--text-faint)" }}>
                                          Posted by {record.poster.name||"Unknown"}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 640px) { .parent-courses { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
