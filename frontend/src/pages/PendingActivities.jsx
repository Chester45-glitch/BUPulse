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

const WORK_TYPE_ICON = {
  ASSIGNMENT: "📝",
  SHORT_ANSWER_QUESTION: "❓",
  MULTIPLE_CHOICE_QUESTION: "🔘",
  QUIZ: "📋",
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

  // These are already filtered to NOT_SUBMITTED by the backend
  const overdue = deadlines.filter(d => new Date(d.dueDate) < now);
  const upcoming = deadlines.filter(d => new Date(d.dueDate) >= now);

  // Unique courses for filter
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
        <span style={{ fontSize: 16 }}>✅</span>
        <p style={{ fontSize: 13, color: "var(--green-700)" }}>Only showing <strong>unsubmitted</strong> activities. Already submitted work is automatically hidden.</p>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: "#fee2e2", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{overdue.length}</div><div style={{ fontSize: 11, color: "#f87171" }}>Overdue</div></div>
        </div>
        <div style={{ background: "#ffedd5", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⏰</span>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{upcoming.filter(d => Math.ceil((new Date(d.dueDate) - now) / 86400000) <= 3).length}</div><div style={{ fontSize: 11, color: "#fbbf24" }}>Due soon</div></div>
        </div>
        <div style={{ background: "var(--green-50)", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--green-700)" }}>{upcoming.length}</div><div style={{ fontSize: 11, color: "var(--green-600)" }}>Upcoming</div></div>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {[["ALL", "All"], ["OVERDUE", "Overdue"], ["UPCOMING", "Upcoming"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: "7px 14px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
              border: `1.5px solid ${filter === val ? "var(--green-600)" : "var(--border-color)"}`,
              background: filter === val ? "var(--green-800)" : "var(--card-bg)",
              color: filter === val ? "#fff" : "var(--text-secondary)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>

        {/* Course filter dropdown */}
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{
          padding: "7px 12px", borderRadius: 10, border: "1.5px solid var(--input-border)",
          background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
          maxWidth: 200,
        }}>
          <option value="ALL">All Courses</option>
          {courses.map(c => <option key={c} value={c}>{c.length > 30 ? c.slice(0, 30) + "…" : c}</option>)}
        </select>
      </div>

      {loading
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>All Clear!</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No pending activities found.</p>
          </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((d, i) => {
              const dueDate = new Date(d.dueDate);
              const info = daysInfo(d.dueDate);
              const typeIcon = WORK_TYPE_ICON[d.workType] || "📝";
              return (
                <div key={d.courseWorkId || i} style={{
                  background: "var(--card-bg)", borderRadius: 12,
                  border: `1px solid ${info.urgent ? info.bg : "var(--card-border)"}`,
                  padding: "14px 16px", boxShadow: "var(--shadow-sm)",
                  animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  {/* Type icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: info.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {typeIcon}
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
