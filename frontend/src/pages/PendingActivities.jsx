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

export default function PendingActivities() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    api.get("/classroom/deadlines")
      .then(r => setDeadlines(r.data.deadlines || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const overdue = deadlines.filter(d => new Date(d.dueDate) < now);
  const upcoming = deadlines.filter(d => new Date(d.dueDate) >= now);

  const filtered = filter === "OVERDUE" ? overdue : filter === "UPCOMING" ? upcoming : deadlines;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>

      {/* Summary badges */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: "#fee2e2", borderRadius: "var(--radius-lg)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>{overdue.length}</div><div style={{ fontSize: 11, color: "#f87171" }}>Overdue</div></div>
        </div>
        <div style={{ background: "#ffedd5", borderRadius: "var(--radius-lg)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>{upcoming.filter(d => Math.ceil((new Date(d.dueDate) - now) / 86400000) <= 3).length}</div><div style={{ fontSize: 11, color: "#fbbf24" }}>Due soon</div></div>
        </div>
        <div style={{ background: "var(--green-50)", borderRadius: "var(--radius-lg)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--green-700)" }}>{upcoming.length}</div><div style={{ fontSize: 11, color: "var(--green-600)" }}>Upcoming</div></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {[["ALL", "All Activities"], ["OVERDUE", "Overdue"], ["UPCOMING", "Upcoming"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: "7px 16px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0,
            border: `1.5px solid ${filter === val ? "var(--green-600)" : "var(--border-color)"}`,
            background: filter === val ? "var(--green-800)" : "var(--card-bg)",
            color: filter === val ? "#fff" : "var(--text-secondary)",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {loading
        ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ height: 80, borderRadius: "var(--radius-lg)", background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />)}</div>
        : filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: "var(--radius-xl)", border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>All Clear!</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No {filter !== "ALL" ? filter.toLowerCase() : ""} activities found.</p>
          </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((d, i) => {
              const dueDate = new Date(d.dueDate);
              const info = daysInfo(d.dueDate);
              return (
                <div key={d.courseWorkId || i} style={{
                  background: "var(--card-bg)", borderRadius: "var(--radius-lg)",
                  border: `1px solid ${info.urgent ? info.bg : "var(--card-border)"}`,
                  padding: "14px 16px", boxShadow: "var(--shadow-sm)",
                  animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  {/* Date block */}
                  <div style={{ textAlign: "center", flexShrink: 0, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", padding: "6px 10px", minWidth: 44 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{dueDate.toLocaleDateString("en-PH", { month: "short" })}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{dueDate.getDate()}</div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{dueDate.toLocaleDateString("en-PH", { weekday: "short" })}</div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{d.courseName}</div>
                    <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>{info.label}</span>
                  </div>

                  {/* Open in Classroom button */}
                  {d.link && (
                    <a href={d.link} target="_blank" rel="noopener noreferrer" style={{
                      padding: "8px 14px", borderRadius: "var(--radius-md)",
                      background: "var(--green-800)", color: "#fff",
                      fontSize: 12, fontWeight: 600, flexShrink: 0,
                      display: "flex", alignItems: "center", gap: 5,
                      transition: "opacity 0.2s",
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
