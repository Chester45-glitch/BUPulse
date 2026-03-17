import { useState, useEffect, useRef } from "react";
import api from "../utils/api";

/* ── Tag classifier ─────────────────────────────────────────── */
const classify = (text = "") => {
  const t = text.toLowerCase();
  if (t.includes("urgent") || t.includes("no class") || t.includes("cancel"))
    return { label: "Urgent", bg: "#fee2e2", color: "#b91c1c", dot: "#ef4444", border: "#fecaca" };
  if (t.includes("deadline") || t.includes("due") || t.includes("reminder"))
    return { label: "Reminder", bg: "#fff7ed", color: "#c2410c", dot: "#f97316", border: "#fed7aa" };
  return { label: "Info", bg: "#f0fdf4", color: "#166534", dot: "#22c55e", border: "#bbf7d0" };
};

const COURSE_PALETTE = [
  "#2563eb","#16a34a","#7c3aed","#b45309","#0f766e",
  "#be123c","#0284c7","#65a30d","#9333ea","#0369a1",
];
const courseColor = (name = "") => COURSE_PALETTE[name.charCodeAt(0) % COURSE_PALETTE.length];

/* ── ChevronIcon ─────────────────────────────────────────────── */
const ChevronDown = ({ open }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.25s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── SearchIcon ──────────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ── AnnouncementCard ────────────────────────────────────────── */
function AnnouncementCard({ ann, hideCourse, index }) {
  const [expanded, setExpanded] = useState(false);
  const tag = classify(ann.text);
  const PREVIEW = 140;
  const needsToggle = ann.text?.length > PREVIEW;
  const displayText = expanded || !needsToggle ? ann.text : ann.text.slice(0, PREVIEW) + "…";

  const h = ann.updateTime
    ? Math.floor((Date.now() - new Date(ann.updateTime)) / 3600000)
    : 0;
  const ago = h < 1 ? "Just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;

  return (
    <article
      style={{
        background: "var(--card-bg)",
        borderRadius: 14,
        border: "1px solid var(--card-border)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        animation: `fadeUp 0.3s ease ${index * 0.045}s both`,
      }}
      aria-label={`Announcement: ${ann.text?.slice(0, 60)}`}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: tag.dot }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Course + time row */}
        {!hideCourse && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: courseColor(ann.courseName), flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{ann.courseName}</span>
          </div>
        )}

        {/* Body text */}
        <p style={{
          fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)",
          marginBottom: 10, whiteSpace: "pre-line",
        }}>
          {displayText}
        </p>

        {needsToggle && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              fontSize: 12, color: "var(--green-700)", fontWeight: 600,
              background: "none", border: "none", cursor: "pointer",
              padding: "0 0 10px", display: "block",
            }}
          >
            {expanded ? "Show less ↑" : "Read more ↓"}
          </button>
        )}

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            background: tag.bg, color: tag.color,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.4px",
            padding: "2px 8px", borderRadius: 5,
            border: `1px solid ${tag.border}`,
          }}>{tag.label.toUpperCase()}</span>

          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{ago}</span>

          {ann.link && (
            <a
              href={ann.link} target="_blank" rel="noopener noreferrer"
              style={{
                marginLeft: "auto", fontSize: 12, color: "var(--green-700)",
                fontWeight: 500, textDecoration: "none", display: "flex", alignItems: "center", gap: 3,
              }}
            >
              View in Classroom
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── CourseFilterDropdown ────────────────────────────────────── */
function CourseFilterDropdown({ courses, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabel = selected === "ALL"
    ? "All Courses"
    : courses.find(c => c === selected) || selected;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 10,
          border: "1.5px solid var(--input-border)",
          background: open ? "var(--green-50)" : "var(--card-bg)",
          color: "var(--text-secondary)",
          fontSize: 13.5, fontWeight: 500,
          cursor: "pointer", transition: "all 0.15s",
          minWidth: 160,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedLabel}</span>
        <ChevronDown open={open} />
      </button>

      {/* Dropdown panel */}
      <div style={{
        position: "absolute", top: "calc(100% + 6px)", right: 0,
        background: "var(--dropdown-bg)",
        border: "1px solid var(--dropdown-border)",
        borderRadius: 12,
        boxShadow: "var(--shadow-xl)",
        minWidth: 220,
        zIndex: 100,
        overflow: "hidden",
        maxHeight: open ? 320 : 0,
        transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }} role="listbox" aria-label="Filter by course">
        <div style={{ overflowY: "auto", maxHeight: 320 }}>
          {["ALL", ...courses].map((c, i) => {
            const isSelected = selected === c;
            return (
              <button
                key={c}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(c); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: isSelected ? "var(--green-50)" : "transparent",
                  color: isSelected ? "var(--green-800)" : "var(--text-secondary)",
                  border: "none", cursor: "pointer", textAlign: "left",
                  fontSize: 13.5, fontWeight: isSelected ? 600 : 400,
                  borderBottom: i < courses.length ? "1px solid var(--border-color)" : "none",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--hover-bg)"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {c !== "ALL" && (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: courseColor(c), flexShrink: 0 }} />
                )}
                {c === "ALL" && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c === "ALL" ? "All Courses" : c}
                </span>
                {isSelected && (
                  <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Announcements page ──────────────────────────────────────── */
export default function Announcements({ role }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | grouped

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
    const searchOk = !q || a.text?.toLowerCase().includes(q) || a.courseName?.toLowerCase().includes(q);
    return tagOk && courseOk && searchOk;
  });

  const grouped = filtered.reduce((acc, ann) => {
    const k = ann.courseName || "Other";
    if (!acc[k]) acc[k] = [];
    acc[k].push(ann);
    return acc;
  }, {});

  return (
    <div style={{ animation: "fadeIn 0.35s ease", maxWidth: 760 }}>

      {/* Stats bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-primary)" }}>{announcements.length}</strong> announcement{announcements.length !== 1 ? "s" : ""} from{" "}
          <strong style={{ color: "var(--text-primary)" }}>{courses.length}</strong> course{courses.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Toolbar */}
      <div style={{
        background: "var(--card-bg)", borderRadius: 14,
        border: "1px solid var(--card-border)",
        padding: "12px 14px", marginBottom: 16,
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        boxShadow: "var(--shadow-sm)",
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 180, position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search announcements…"
            aria-label="Search announcements"
            style={{
              width: "100%", padding: "8px 12px 8px 32px",
              border: "1.5px solid var(--input-border)", borderRadius: 10,
              background: "var(--input-bg)", color: "var(--text-primary)",
              fontSize: 13.5, outline: "none", transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = "var(--green-600)"}
            onBlur={e => e.target.style.borderColor = "var(--input-border)"}
          />
        </div>

        {/* Tag filters */}
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", "Urgent", "Reminder", "Info"].map(f => (
            <button
              key={f}
              onClick={() => setTagFilter(f)}
              aria-pressed={tagFilter === f}
              style={{
                padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                border: `1.5px solid ${tagFilter === f ? "var(--green-600)" : "var(--border-color)"}`,
                background: tagFilter === f ? "var(--green-800)" : "transparent",
                color: tagFilter === f ? "#fff" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.14s",
              }}
            >{f}</button>
          ))}
        </div>

        {/* Course dropdown */}
        {courses.length > 0 && (
          <CourseFilterDropdown courses={courses} selected={courseFilter} onChange={setCourseFilter} />
        )}

        {/* View mode */}
        <div style={{ display: "flex", gap: 3, background: "var(--bg-tertiary)", borderRadius: 8, padding: 3 }}>
          {[["list", "≡"], ["grouped", "⊞"]].map(([v, icon]) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              aria-label={`${v} view`}
              aria-pressed={viewMode === v}
              style={{
                width: 30, height: 28, borderRadius: 6, fontSize: 15, cursor: "pointer",
                background: viewMode === v ? "var(--card-bg)" : "transparent",
                color: viewMode === v ? "var(--text-primary)" : "var(--text-muted)",
                border: "none", transition: "all 0.12s",
              }}
            >{icon}</button>
          ))}
        </div>
      </div>

      {/* Course pill row (quick filter) */}
      {courses.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {["ALL", ...courses].map(c => {
            const active = courseFilter === c;
            const col = c === "ALL" ? "var(--green-700)" : courseColor(c);
            return (
              <button
                key={c}
                onClick={() => setCourseFilter(c)}
                style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 99,
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  border: `1.5px solid ${active ? col : "var(--border-color)"}`,
                  background: active ? col + "15" : "transparent",
                  color: active ? col : "var(--text-muted)",
                  cursor: "pointer", transition: "all 0.14s", whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {c !== "ALL" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />}
                {c === "ALL" ? "All" : c.length > 28 ? c.slice(0, 28) + "…" : c}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 120, borderRadius: 14, background: "var(--card-bg)", animation: `pulse-dot 1.5s ease-in-out ${i * 0.1}s infinite` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No announcements match your filters</p>
          <button onClick={() => { setSearch(""); setTagFilter("ALL"); setCourseFilter("ALL"); }} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "var(--green-800)", color: "#fff", border: "none", fontSize: 13, cursor: "pointer" }}>Clear filters</button>
        </div>
      ) : viewMode === "grouped" ? (
        Object.entries(grouped).map(([course, anns]) => (
          <div key={course} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: courseColor(course) }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{course}</h3>
              <span style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99 }}>{anns.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {anns.map((ann, i) => <AnnouncementCard key={ann.id || i} ann={ann} hideCourse index={i} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
