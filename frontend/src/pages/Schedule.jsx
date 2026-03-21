import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const COLORS = ["#16a34a","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#db2777"];
const SHORT  = { Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat",Sunday:"Sun" };

const timeToMins = (t) => { const [h,m] = t.split(":").map(Number); return h*60+m; };
const fmtTime = (t) => {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h%12||12}:${String(m).padStart(2,"0")} ${ampm}`;
};

// ── Icons ──────────────────────────────────────────────────────────
const IcoPlus    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoTrash   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
const IcoUpload  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcoCalendar= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoEdit    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

// ── Add/Edit Modal ──────────────────────────────────────────────
function EntryModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState(entry || {
    course_name:"", course_code:"", day_of_week:"Monday",
    start_time:"08:00", end_time:"10:00", room:"", color:"#16a34a",
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--card-bg)", borderRadius:18, padding:24, width:"100%", maxWidth:480, boxShadow:"var(--shadow-xl)" }}>
        <h3 style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)", marginBottom:20 }}>
          {entry?.id ? "Edit Class" : "Add Class"}
        </h3>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:2 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 }}>Course Name *</label>
              <input value={form.course_name} onChange={e=>set("course_name",e.target.value)}
                style={{ width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 }}>Code</label>
              <input value={form.course_code} onChange={e=>set("course_code",e.target.value)}
                style={{ width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 }}>Day *</label>
            <select value={form.day_of_week} onChange={e=>set("day_of_week",e.target.value)}
              style={{ width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none" }}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 }}>Start *</label>
              <input type="time" value={form.start_time} onChange={e=>set("start_time",e.target.value)}
                style={{ width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 }}>End *</label>
              <input type="time" value={form.end_time} onChange={e=>set("end_time",e.target.value)}
                style={{ width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 }}>Room</label>
            <input value={form.room} onChange={e=>set("room",e.target.value)}
              style={{ width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:8 }}>Color</label>
            <div style={{ display:"flex", gap:8 }}>
              {COLORS.map(c => (
                <button key={c} onClick={()=>set("color",c)}
                  style={{ width:28, height:28, borderRadius:"50%", background:c, border: form.color===c ? "3px solid var(--text-primary)" : "2px solid transparent", cursor:"pointer" }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-muted)", fontSize:13.5, cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>onSave(form)} disabled={!form.course_name||!form.day_of_week}
            style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"var(--green-700)", color:"#fff", fontSize:13.5, fontWeight:600, cursor:"pointer" }}>
            {entry?.id ? "Save changes" : "Add class"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Schedule Page ─────────────────────────────────────────────
export default function Schedule() {
  const { user } = useAuth();
  const [schedules, setSchedules]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("week"); // week | list
  const [showModal, setShowModal]   = useState(false);
  const [editEntry, setEditEntry]   = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted]   = useState(null); // preview before saving
  const [error, setError]           = useState("");
  const fileRef = useRef(null);
  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  const load = async () => {
    try {
      const r = await api.get("/schedule");
      setSchedules(r.data.schedules || []);
    } catch { setError("Failed to load schedule"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Get today's classes ──────────────────────────────────────
  const todayClasses = schedules
    .filter(s => s.day_of_week === today)
    .sort((a,b) => timeToMins(a.start_time) - timeToMins(b.start_time));

  const nextClass = todayClasses.find(c => {
    const now = new Date();
    const mins = now.getHours()*60 + now.getMinutes();
    return timeToMins(c.start_time) > mins;
  });

  const minutesUntilNext = nextClass ? (() => {
    const now = new Date();
    const mins = now.getHours()*60 + now.getMinutes();
    return timeToMins(nextClass.start_time) - mins;
  })() : null;

  // ── Upload & extract ─────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) { setError("File too large (max 10MB)"); return; }

    setUploading(true);
    setError("");

    try {
      // Convert to base64
      const base64 = await new Promise((res,rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      // Upload to Drive for storage
      const uploadRes = await api.post("/upload/drive", {
        fileName: file.name,
        fileType: file.type,
        fileData: base64,
      });

      // Extract text from file content and send to AI
      setExtracting(true);
      // Use the file data for text extraction
      const extractRes = await api.post("/schedule/extract", {
        text: `Schedule file: ${file.name}. Please extract any class schedule information. Note: This is a ${file.type} file.`,
        fileName: file.name,
        fileData: base64,
        fileType: file.type,
      });

      setExtracted(extractRes.data.entries || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to process file");
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  // ── Save extracted entries ────────────────────────────────────
  const saveExtracted = async () => {
    if (!extracted?.length) return;
    try {
      await api.post("/schedule/bulk", { entries: extracted });
      setExtracted(null);
      load();
    } catch (err) { setError(err.response?.data?.error || "Failed to save"); }
  };

  // ── Add/edit save ─────────────────────────────────────────────
  const handleSave = async (form) => {
    try {
      if (editEntry?.id) {
        await api.put(`/schedule/${editEntry.id}`, form);
      } else {
        await api.post("/schedule", form);
      }
      setShowModal(false);
      setEditEntry(null);
      load();
    } catch (err) { setError(err.response?.data?.error || "Failed to save"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this class from your schedule?")) return;
    try {
      await api.delete(`/schedule/${id}`);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch { setError("Failed to delete"); }
  };

  // ── Weekly grid render ────────────────────────────────────────
  const renderWeek = () => (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:8 }}>
      {DAYS.map(day => {
        const dayClasses = schedules
          .filter(s => s.day_of_week === day)
          .sort((a,b) => timeToMins(a.start_time) - timeToMins(b.start_time));
        const isToday = day === today;

        return (
          <div key={day} style={{ minHeight:200 }}>
            <div style={{ padding:"8px 10px", borderRadius:"10px 10px 0 0", background: isToday ? "var(--green-700)" : "var(--bg-tertiary)", color: isToday ? "#fff" : "var(--text-muted)", fontSize:12.5, fontWeight:isToday?700:600, textAlign:"center", marginBottom:6 }}>
              {SHORT[day]}
              {isToday && <div style={{ fontSize:10, fontWeight:400, opacity:0.85 }}>Today</div>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {dayClasses.map(c => (
                <div key={c.id} style={{ background:c.color+"18", border:`1.5px solid ${c.color}40`, borderLeft:`3px solid ${c.color}`, borderRadius:8, padding:"8px 10px", position:"relative", group:"true" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:c.color, marginBottom:2, lineHeight:1.3 }}>{c.course_name}</div>
                  {c.course_code && <div style={{ fontSize:10.5, color:"var(--text-muted)", marginBottom:3 }}>{c.course_code}</div>}
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{fmtTime(c.start_time)} – {fmtTime(c.end_time)}</div>
                  {c.room && <div style={{ fontSize:10.5, color:"var(--text-faint)", marginTop:2 }}>📍 {c.room}</div>}
                  <div style={{ position:"absolute", top:6, right:6, display:"flex", gap:4 }}>
                    <button onClick={()=>{ setEditEntry(c); setShowModal(true); }}
                      style={{ width:20, height:20, border:"none", background:"transparent", cursor:"pointer", color:"var(--text-muted)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:4, padding:0 }}>
                      <IcoEdit />
                    </button>
                    <button onClick={()=>handleDelete(c.id)}
                      style={{ width:20, height:20, border:"none", background:"transparent", cursor:"pointer", color:"#dc2626", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:4, padding:0 }}>
                      <IcoTrash />
                    </button>
                  </div>
                </div>
              ))}
              {dayClasses.length === 0 && (
                <div style={{ height:60, borderRadius:8, border:"1.5px dashed var(--card-border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:11, color:"var(--text-faint)" }}>No class</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ animation:"fadeIn 0.3s ease", maxWidth:1000 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--text-primary)", margin:0, display:"flex", alignItems:"center", gap:8 }}>
            <IcoCalendar /> My Schedule
          </h1>
          <p style={{ fontSize:13.5, color:"var(--text-muted)", margin:"4px 0 0" }}>
            {schedules.length > 0 ? `${schedules.length} class${schedules.length!==1?"es":""} scheduled` : "No schedule yet — add classes or upload a file"}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display:"none" }} />
          <button onClick={()=>fileRef.current?.click()} disabled={uploading||extracting}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 14px", borderRadius:10, border:"1.5px solid var(--card-border)", background:"var(--card-bg)", color:"var(--text-secondary)", fontSize:13, cursor:"pointer" }}>
            <IcoUpload /> {uploading ? "Uploading…" : extracting ? "Reading…" : "Upload file"}
          </button>
          <button onClick={()=>{ setEditEntry(null); setShowModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 14px", borderRadius:10, border:"none", background:"var(--green-700)", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            <IcoPlus /> Add class
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background:"#fee2e2", border:"1px solid #fecaca", borderRadius:10, padding:"10px 14px", color:"#b91c1c", fontSize:13, marginBottom:14, display:"flex", justifyContent:"space-between" }}>
          {error} <button onClick={()=>setError("")} style={{ background:"none", border:"none", color:"#b91c1c", cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* Today banner */}
      {!loading && (
        <div style={{ background: todayClasses.length>0 ? "var(--green-700)" : "var(--bg-tertiary)", borderRadius:14, padding:"14px 18px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: todayClasses.length>0 ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}>
              {today} — Today
            </div>
            <div style={{ fontSize:15, fontWeight:600, color: todayClasses.length>0 ? "#fff" : "var(--text-secondary)", marginTop:2 }}>
              {todayClasses.length === 0
                ? "🎉 No classes today"
                : `${todayClasses.length} class${todayClasses.length!==1?"es":""} today`}
            </div>
          </div>
          {nextClass && (
            <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:10, padding:"8px 14px", textAlign:"right" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontWeight:600 }}>NEXT CLASS</div>
              <div style={{ fontSize:14, color:"#fff", fontWeight:700 }}>{nextClass.course_name}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.8)" }}>
                in {minutesUntilNext >= 60 ? `${Math.floor(minutesUntilNext/60)}h ${minutesUntilNext%60}m` : `${minutesUntilNext}min`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extracted preview */}
      {extracted && (
        <div style={{ background:"var(--card-bg)", border:"2px solid var(--green-600)", borderRadius:14, padding:18, marginBottom:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>
              ✨ Found {extracted.length} classes — review and save
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setExtracted(null)} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-muted)", fontSize:12.5, cursor:"pointer" }}>Discard</button>
              <button onClick={saveExtracted} style={{ padding:"6px 12px", borderRadius:8, border:"none", background:"var(--green-700)", color:"#fff", fontSize:12.5, fontWeight:600, cursor:"pointer" }}>Save all</button>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {extracted.map((e,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"var(--bg-tertiary)", borderRadius:9, fontSize:13 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:COLORS[i%COLORS.length], flexShrink:0 }} />
                <span style={{ fontWeight:600, color:"var(--text-primary)", flex:2 }}>{e.course_name}</span>
                <span style={{ color:"var(--text-muted)", flex:1 }}>{e.day_of_week}</span>
                <span style={{ color:"var(--text-muted)" }}>{fmtTime(e.start_time)} – {fmtTime(e.end_time)}</span>
                {e.room && <span style={{ color:"var(--text-faint)", fontSize:12 }}>📍 {e.room}</span>}
                <button onClick={()=>setExtracted(prev=>prev.filter((_,j)=>j!==i))}
                  style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", padding:2 }}><IcoTrash /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly view */}
      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
          {DAYS.map(d => (
            <div key={d} style={{ height:160, borderRadius:10, background:"var(--card-bg)", animation:"pulse-bg 1.5s ease infinite" }} />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 24px", background:"var(--card-bg)", borderRadius:16, border:"1px solid var(--card-border)" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
          <h3 style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>No schedule yet</h3>
          <p style={{ fontSize:14, color:"var(--text-muted)", maxWidth:320, margin:"0 auto 20px" }}>
            Upload your schedule file (PDF, image, Word) or add classes manually.
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={()=>fileRef.current?.click()} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:"1.5px solid var(--card-border)", background:"var(--card-bg)", color:"var(--text-secondary)", fontSize:13.5, cursor:"pointer" }}>
              <IcoUpload /> Upload file
            </button>
            <button onClick={()=>{ setEditEntry(null); setShowModal(true); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:"none", background:"var(--green-700)", color:"#fff", fontSize:13.5, fontWeight:600, cursor:"pointer" }}>
              <IcoPlus /> Add class manually
            </button>
          </div>
        </div>
      ) : renderWeek()}

      {/* Modal */}
      {showModal && (
        <EntryModal
          entry={editEntry}
          onSave={handleSave}
          onClose={()=>{ setShowModal(false); setEditEntry(null); }}
        />
      )}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
        @keyframes pulse-bg { 0%,100%{opacity:1}50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
