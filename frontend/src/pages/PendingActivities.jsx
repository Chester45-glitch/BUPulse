import { useState, useEffect } from "react";
import api from "../utils/api";

const daysInfo = (dueDate) => {
  const d = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, color: "#dc2626", bg: "#fee2e2", urgent: true };
  if (d === 0) return { label: "Due today!", color: "#dc2626", bg: "#fee2e2", urgent: true };
  if (d === 1) return { label: "Due tomorrow", color: "#d97706", bg: "#ffedd5", urgent: true };
  if (d <= 3) return { label: `${d} days left`, color: "#d97706", bg: "#ffedd5", urgent: false };
  return { label: `${d} days left`, color: "#16a34a", bg: "#dcfce7", urgent: false };
};

/* ── Simple B&W SVG Icons ──────────────────────────────────── */
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconClipboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconHelpCircle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconCheckCircle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const WORK_TYPE_ICON = {
  ASSIGNMENT: IconFile,
  SHORT_ANSWER_QUESTION: IconHelpCircle,
  MULTIPLE_CHOICE_QUESTION: IconHelpCircle,
  QUIZ: IconClipboard,
};

export default function PendingActivities() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");

  useEffect(() => {
    api.get("/classroom/deadlines")
      .then(r => setDeadlines(r.data.deadlines || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const overdue = deadlines.filter(d => new Date(d.dueDate) < now);
  const upcoming = deadlines.filter(d => new Date(d.dueDate) >= now);
  const courses = [...new Set(deadlines.map(d => d.courseName))].sort();

  const filtered = deadlines.filter(d => {
    const statusOk = filter === "ALL" || (filter === "OVERDUE" ? new Date(d.dueDate) < now : new Date(d.dueDate) >= now);
    const courseOk = courseFilter === "ALL" || d.courseName === courseFilter;
    return statusOk && courseOk;
  });

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Info note */}
      <div style={{ background: "var(--green-50)", border: "1px solid var(--green-200)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ color: "var(--green-700)", flexShrink: 0 }}><IconCheckCircle /></div>
        <p style={{ fontSize: 13, color: "var(--green-700)" }}>Only showing <strong>unsubmitted</strong> activities. Already submitted work is automatically hidden.</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#fee2e2", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#dc2626" }}><IconAlert /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626", lineHeight: 1 }}>{overdue.length}</div>
            <div style={{ fontSize: 11, color: "#f87171", marginTop: 2 }}>Overdue</div>
          </div>
        </div>
        <div style={{ background: "#ffedd5", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#d97706" }}><IconClock /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706", lineHeight: 1 }}>{upcoming.filter(d => Math.ceil((new Date(d.dueDate) - now) / 86400000) <= 3).length}</div>
            <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 2 }}>Due soon</div>
          </div>
        </div>
        <div style={{ background: "var(--green-50)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "var(--green-700)" }}><IconClipboard /></div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green-700)", lineHeight: 1 }}>{upcoming.length}</div>
            <div style={{ fontSize: 11, color: "var(--green-600)", marginTop: 2 }}>Upcoming</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["ALL", "All"], ["OVERDUE", "Overdue"], ["UPCOMING", "Upcoming"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: "7px 14px", borderRadius: 99, whiteSpace: "nowrap",
              border: `1.5px solid ${filter === val ? "var(--green-600)" : "var(--border-color)"}`,
              background: filter === val ? "var(--green-800)" : "var(--card-bg)",
              color: filter === val ? "#fff" : "var(--text-secondary)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{
          padding: "7px 12px", borderRadius: 10, border: "1.5px solid var(--input-border)",
          background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
          flex: 1, minWidth: 0,
        }}>
          <option value="ALL">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c.length > 30 ? c.slice(0, 30) + "…" : c}</option>)}
        </select>
      </div>

      {loading
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, color: "var(--text-muted)" }}><IconCheckCircle /></div>
              <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>All Clear!</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No pending activities found.</p>
            </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((d, i) => {
              const dueDate = new Date(d.dueDate);
              const info = daysInfo(d.dueDate);
              const TypeIcon = WORK_TYPE_ICON[d.workType] || IconFile;
              return (
                <div key={d.courseWorkId || i} style={{
                  background: "var(--card-bg)", borderRadius: 12,
                  border: `1px solid ${info.urgent ? info.bg : "var(--card-border)"}`,
                  padding: "14px 16px", boxShadow: "var(--shadow-sm)",
                  animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  {/* Type icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: info.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: info.color }}>
                    <TypeIcon />
                  </div>

                  {/* Date block */}
                  <div style={{ textAlign: "center", flexShrink: 0, background: "var(--bg-tertiary)", borderRadius: 10, padding: "4px 10px", minWidth: 44 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{dueDate.toLocaleDateString("en-PH", { month: "short" })}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{dueDate.getDate()}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{dueDate.toLocaleDateString("en-PH", { weekday: "short" })}</div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.courseName}</div>
                    <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>{info.label}</span>
                  </div>

                  {/* Open button */}
                  {d.link && (
                    <a href={d.link} target="_blank" rel="noopener noreferrer" style={{
                      padding: "8px 14px", borderRadius: 10,
                      background: "var(--green-800)", color: "#fff",
                      fontSize: 12, fontWeight: 600, flexShrink: 0,
                      display: "flex", alignItems: "center", gap: 5, transition: "opacity 0.2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}
