import { useState, useEffect, useRef } from "react";
import api from "../utils/api";

/* ── Tag classifier ─────────────────────────────────────────── */
const classify = (text = "") => {
  const t = text.toLowerCase();
  if (t.includes("urgent") || t.includes("no class") || t.includes("cancel"))
    return { label: "Urgent", color: "#b91c1c", bg: "#fee2e2", dot: "#ef4444", border: "#fecaca" };
  if (t.includes("deadline") || t.includes("due") || t.includes("reminder"))
    return { label: "Reminder", color: "#c2410c", bg: "#fff7ed", dot: "#f97316", border: "#fed7aa" };
  return { label: "Announcement", color: "#166534", bg: "#f0fdf4", dot: "#22c55e", border: "#bbf7d0" };
};

const PALETTE = ["#2563eb","#16a34a","#7c3aed","#b45309","#0f766e","#be123c","#0284c7","#65a30d","#9333ea","#0369a1"];
const courseColor = (name = "") => PALETTE[name.charCodeAt(0) % PALETTE.length];
const courseInitials = (name = "") => name.trim().slice(0, 2).toUpperCase();

const timeAgo = (iso) => {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso)) / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

/* ── SearchIcon ────────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

/* ── ChevronDown ───────────────────────────────────────────── */
const ChevronDown = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.22s ease", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

/* ── AnnouncementCard ──────────────────────────────────────── */
function AnnouncementCard({ ann, index }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 200;
  const tag = classify(ann.text);
  const color = courseColor(ann.courseName || "");
  const needsMore = ann.text?.length > PREVIEW;
  const displayText = expanded || !needsMore ? ann.text : ann.text.slice(0, PREVIEW) + "…";

  return (
    <article style={{
      background: "var(--card-bg, #fff)",
      borderRadius: 14,
      border: "1px solid var(--card-border, #e9ecef)",
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      animation: `fadeUp 0.3s ease ${index * 0.04}s both`,
      transition: "box-shadow 0.18s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.09)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"}
    >
      {/* Course header — GC-style colored top row */}
      <div style={{
        background: color,
        padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        position: "relative", overflow: "hidden",
      }}>
        {/* subtle dot texture */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
          {/* Course avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: "rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700,
          }}>
            {courseInitials(ann.courseName || "?")}
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{ann.courseName || "Unknown course"}</div>
            {ann.teacherName && (
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11.5, marginTop: 2 }}>
                {ann.teacherName}
              </div>
            )}
          </div>
        </div>

        {/* Time + tag */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, position: "relative" }}>
          <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>{timeAgo(ann.updateTime || ann.creationTime)}</span>
          <span style={{
            background: "rgba(255,255,255,0.18)", color: "#fff",
            fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px",
            padding: "1px 7px", borderRadius: 4, textTransform: "uppercase",
          }}>{tag.label}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px 16px" }}>
        <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--text-primary)", whiteSpace: "pre-line", marginBottom: needsMore ? 8 : 12 }}>
          {displayText}
        </p>
        {needsMore && (
          <button onClick={() => setExpanded(e => !e)} style={{
            fontSize: 12.5, color: color, fontWeight: 600,
            background: "none", border: "none", cursor: "pointer",
            padding: "0 0 8px",
          }}>
            {expanded ? "Show less ↑" : "Read more ↓"}
          </button>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: "1px solid var(--border-color, #e9ecef)", flexWrap: "wrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: tag.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: "var(--text-faint, #9ca3af)" }}>
            {ann.updateTime
              ? new Date(ann.updateTime).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : ""}
          </span>
          {ann.link && (
            <a href={ann.link} target="_blank" rel="noopener noreferrer" style={{
              marginLeft: "auto", fontSize: 12, color: color, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 3, textDecoration: "none",
            }}>
              Open in Classroom
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── CourseDropdown ────────────────────────────────────────── */
function CourseDropdown({ courses, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 13px",
          borderRadius: 10, border: "1.5px solid var(--input-border, #d1d5db)",
          background: open ? "var(--green-50, #f0fdf4)" : "var(--card-bg)",
          color: "var(--text-secondary)", fontSize: 13.5, fontWeight: 500,
          cursor: "pointer", transition: "all 0.14s", minWidth: 155,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected === "ALL" ? "All courses" : (selected.length > 22 ? selected.slice(0, 22) + "…" : selected)}
        </span>
        <ChevronDown open={open} />
      </button>

      <div style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0,
        background: "var(--dropdown-bg, #fff)",
        border: "1px solid var(--dropdown-border, #e5e7eb)",
        borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.13)",
        minWidth: 240, zIndex: 100, overflow: "hidden",
        maxHeight: open ? 300 : 0,
        transition: "max-height 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
      }}>
        <div style={{ overflowY: "auto", maxHeight: 300 }}>
          {["ALL", ...courses].map((c, i) => {
            const active = selected === c;
            const col = c === "ALL" ? "#16a34a" : courseColor(c);
            return (
              <button key={c} onClick={() => { onChange(c); setOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "10px 14px",
                background: active ? `${col}10` : "transparent",
                color: active ? col : "var(--text-secondary)",
                border: "none", cursor: "pointer", textAlign: "left",
                fontSize: 13.5, fontWeight: active ? 600 : 400,
                borderBottom: i < courses.length ? "1px solid var(--border-color, #f0f0f0)" : "none",
                transition: "background 0.1s",
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--hover-bg, rgba(0,0,0,0.03))"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {c === "ALL"
                  ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#d1d5db", flexShrink: 0 }} />
                  : <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                }
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c === "ALL" ? "All courses" : c}
                </span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Announcements page ────────────────────────────────────── */
export default function Announcements({ role }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("list");

  const endpoint = role === "professor" ? "/professor/announcements" : "/classroom/announcements";

  useEffect(() => {
    setLoading(true);
    api.get(endpoint)
      .then(r => setAnnouncements(r.data.announcements || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint]);

  const courses = [...new Set(announcements.map(a => a.courseName).filter(Boolean))].sort();

  const filtered = announcements.filter(a => {
    const tag = classify(a.text);
    const tagOk = tagFilter === "ALL" || tag.label === tagFilter;
    const courseOk = courseFilter === "ALL" || a.courseName === courseFilter;
    const q = search.toLowerCase();
    const searchOk = !q || a.text?.toLowerCase().includes(q) || a.courseName?.toLowerCase().includes(q) || a.teacherName?.toLowerCase().includes(q);
    return tagOk && courseOk && searchOk;
  });

  const grouped = filtered.reduce((acc, ann) => {
    const k = ann.courseName || "Other";
    if (!acc[k]) acc[k] = [];
    acc[k].push(ann);
    return acc;
  }, {});

  return (
    <div style={{ animation: "fadeIn 0.35s ease", maxWidth: 780 }}>
      {/* Stats */}
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        <strong style={{ color: "var(--text-primary)" }}>{announcements.length}</strong> announcement{announcements.length !== 1 ? "s" : ""} across{" "}
        <strong style={{ color: "var(--text-primary)" }}>{courses.length}</strong> course{courses.length !== 1 ? "s" : ""}
      </p>

      {/* Toolbar */}
      <div style={{
        background: "var(--card-bg)", borderRadius: 14,
        border: "1px solid var(--card-border)", padding: "11px 13px",
        marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        boxShadow: "var(--shadow-sm)",
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 170, position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 10, color: "var(--text-muted)", pointerEvents: "none" }}><SearchIcon /></span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search announcements…"
            style={{
              width: "100%", padding: "8px 12px 8px 30px",
              border: "1.5px solid var(--input-border, #d1d5db)", borderRadius: 9,
              background: "var(--input-bg)", color: "var(--text-primary)",
              fontSize: 13.5, outline: "none", transition: "border-color 0.14s",
            }}
            onFocus={e => e.target.style.borderColor = "#16a34a"}
            onBlur={e => e.target.style.borderColor = "var(--input-border, #d1d5db)"}
          />
        </div>

        {/* Tag filters */}
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", "Urgent", "Reminder", "Announcement"].map(f => (
            <button key={f} onClick={() => setTagFilter(f)} style={{
              padding: "6px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 500,
              border: `1.5px solid ${tagFilter === f ? "#16a34a" : "var(--border-color, #e5e7eb)"}`,
              background: tagFilter === f ? "#16a34a" : "transparent",
              color: tagFilter === f ? "#fff" : "var(--text-muted)",
              cursor: "pointer", transition: "all 0.13s", whiteSpace: "nowrap",
            }}>{f === "Announcement" ? "Info" : f}</button>
          ))}
        </div>

        {courses.length > 0 && <CourseDropdown courses={courses} selected={courseFilter} onChange={setCourseFilter} />}

        {/* View toggle */}
        <div style={{ display: "flex", gap: 3, background: "var(--bg-tertiary)", borderRadius: 8, padding: 3 }}>
          {[["list", "≡"], ["grouped", "⊞"]].map(([v, icon]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              width: 30, height: 27, borderRadius: 6, fontSize: 14, cursor: "pointer",
              background: viewMode === v ? "var(--card-bg)" : "transparent",
              color: viewMode === v ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* Course pill quick-filter */}
      {courses.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 3 }}>
          {["ALL", ...courses].map(c => {
            const active = courseFilter === c;
            const col = c === "ALL" ? "#16a34a" : courseColor(c);
            return (
              <button key={c} onClick={() => setCourseFilter(c)} style={{
                flexShrink: 0, padding: "5px 11px", borderRadius: 99,
                fontSize: 12, fontWeight: active ? 600 : 400,
                border: `1.5px solid ${active ? col : "var(--border-color, #e5e7eb)"}`,
                background: active ? col + "14" : "transparent",
                color: active ? col : "var(--text-muted)", cursor: "pointer",
                transition: "all 0.13s", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {c !== "ALL" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />}
                {c === "ALL" ? "All" : c.length > 26 ? c.slice(0, 26) + "…" : c}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 160, borderRadius: 14, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No announcements match your filters</p>
          <button onClick={() => { setSearch(""); setTagFilter("ALL"); setCourseFilter("ALL"); }} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 9, background: "#16a34a", color: "#fff", border: "none", fontSize: 13, cursor: "pointer" }}>Clear filters</button>
        </div>
      ) : viewMode === "grouped" ? (
        Object.entries(grouped).map(([course, anns]) => (
          <div key={course} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: courseColor(course) }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{course}</h3>
              <span style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: 11, padding: "1px 7px", borderRadius: 99 }}>{anns.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {anns.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} index={i} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} index={i} />)}
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
