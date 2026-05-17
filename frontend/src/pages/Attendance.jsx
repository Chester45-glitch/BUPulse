/**
 * Attendance.jsx — Definitive shared class attendance board
 *
 * VISIBILITY: calls /sync-courses on mount so user_courses is always
 *   populated before the attendance query runs.
 *
 * REALTIME: SSE connection broadcasts INSERT/UPDATE/DELETE to all
 *   members of the same class instantly.
 *
 * PERMISSIONS (mirrors backend exactly):
 *   Professor   → create, edit any, delete any, verify
 *   Student     → create, edit own unverified, delete own unverified
 *   Verified    → students cannot edit or delete; only professor can
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { getClassSolid } from "../utils/classColors";

// ── Icon helper ───────────────────────────────────────────────────
const Ico = ({ d, size = 18, sw = 1.8, stroke = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const D = {
  plus:    "M12 5v14M5 12h14",
  upload:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  trash:   "M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  edit:    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z",
  checkC:  "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
  x:       "M18 6L6 18M6 6l12 12",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  lock:    "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  warn:    "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  info:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8h.01M12 12v4",
};

// ── Constants ─────────────────────────────────────────────────────
const clrCourse = name => getClassSolid(name || "");
const statusCfg = {
  present: { bg:"#dcfce7", color:"#16a34a", label:"Present" },
  absent:  { bg:"#fee2e2", color:"#dc2626", label:"Absent"  },
  late:    { bg:"#fef9c3", color:"#ca8a04", label:"Late"    },
};
const fmtDate = d => !d ? "" : new Date(d).toLocaleDateString("en-PH", { weekday:"short", month:"short", day:"numeric", year:"numeric" });
const timeAgo = iso => {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};

const IN  = { width:"100%", padding:"9px 12px", border:"1.5px solid var(--card-border)", borderRadius:9, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:14, outline:"none", boxSizing:"border-box" };
const LBL = { fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:5 };

// ── Stat box ──────────────────────────────────────────────────────
function StatBox({ label, value, color="#16a34a" }) {
  return (
    <div style={{ background:"var(--card-bg)", border:"1px solid var(--card-border)", borderRadius:12, padding:"14px 18px", textAlign:"center", boxShadow:"var(--shadow-sm)" }}>
      <div style={{ fontSize:26, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:11.5, color:"var(--text-muted)", marginTop:2 }}>{label}</div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────
function DeleteModal({ record, loading, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20, backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--card-bg)", borderRadius:18, padding:"28px 28px 24px", width:"100%", maxWidth:420, boxShadow:"0 24px 60px rgba(0,0,0,0.25)", animation:"scaleIn 0.18s ease" }}>
        <div style={{ width:52, height:52, borderRadius:14, background:"#fee2e2", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
          <Ico d={D.trash} size={22} stroke="#dc2626" />
        </div>
        <h3 style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>Delete this record?</h3>
        <p style={{ fontSize:13.5, color:"var(--text-muted)", lineHeight:1.6, marginBottom:16 }}>
          Attendance for <strong style={{ color:"var(--text-primary)" }}>{record?.class_name}</strong> on{" "}
          <strong style={{ color:"var(--text-primary)" }}>{fmtDate(record?.record_date)}</strong> will be permanently removed for <em>all class members</em>.
        </p>
        {record?.is_verified && (
          <div style={{ background:"#fef9c3", border:"1px solid #fde047", borderRadius:9, padding:"8px 12px", fontSize:12.5, color:"#854d0e", marginBottom:16, display:"flex", alignItems:"center", gap:7 }}>
            <Ico d={D.shield} size={14} stroke="#854d0e" /> Verified record — only professors can delete this.
          </div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-muted)", fontSize:13.5, cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:loading?"#9ca3af":"#dc2626", color:"#fff", fontSize:13.5, fontWeight:600, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8 }}>
            {loading && <div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.75s linear infinite" }}/>}
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit modal ───────────────────────────────────────────
function RecordModal({ courses, existing, onSave, onClose }) {
  const isEdit = !!existing;
  const [classId,      setClassId]      = useState(existing?.class_id      || courses?.[0]?.id   || "");
  const [className,    setClassName]    = useState(existing?.class_name    || courses?.[0]?.name || "");
  const [date,         setDate]         = useState(existing?.record_date   || new Date().toISOString().split("T")[0]);
  const [sessionLabel, setSessionLabel] = useState(existing?.session_label || "");
  const [notes,        setNotes]        = useState(existing?.notes         || "");
  const [names,        setNames]        = useState(existing?.names?.length ? existing.names : [{ name:"", status:"present" }]);
  const [uploading,    setUploading]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const fileRef = useRef(null);

  const addRow    = () => setNames(n => [...n, { name:"", status:"present" }]);
  const removeRow = i  => setNames(n => n.filter((_,j) => j !== i));
  const updRow    = (i,f,v) => setNames(n => n.map((r,j) => j===i ? {...r,[f]:v} : r));

  const handleFile = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = ""; setUploading(true); setError("");
    try {
      const base64 = await new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      const payload = file.type.startsWith("image/") ? { fileData:base64, fileType:file.type } : { text:`Attendance sheet: ${file.name}` };
      const res = await api.post("/attendance/extract", payload);
      const extracted = res.data.names || [];
      if (extracted.length) setNames(extracted); else setError("No names found — add manually.");
    } catch (err) { setError(err.response?.data?.error || "Failed to extract names"); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!classId) { setError("Select a class"); return; }
    if (!date)    { setError("Select a date");  return; }
    const valid = names.filter(n => n.name.trim());
    setSaving(true); setError("");
    try {
      if (isEdit) {
        const r = await api.patch(`/attendance/class/${existing.id}`, { names:valid, session_label:sessionLabel, notes, record_date:date });
        onSave(r.data.record);
      } else {
        const r = await api.post("/attendance/class", { classId, className, recordDate:date, names:valid, sessionLabel, notes });
        onSave(r.data.record);
      }
    } catch (err) { setError(err.response?.data?.error || "Save failed"); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div style={{ background:"var(--card-bg)", borderRadius:18, padding:24, width:"100%", maxWidth:540, boxShadow:"var(--shadow-xl)", animation:"scaleIn 0.18s ease", margin:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>{isEdit?"Edit":"New"} Attendance Record</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", padding:4 }}><Ico d={D.x} size={20}/></button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:13, marginBottom:16 }}>
          <div>
            <label style={LBL}>Class *</label>
            {courses?.length > 0 ? (
              <select value={classId} onChange={e => { setClassId(e.target.value); setClassName(courses.find(c=>c.id===e.target.value)?.name||e.target.value); }} style={IN}>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <input value={className} onChange={e=>setClassName(e.target.value)} style={IN} placeholder="Class name"/>
            )}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={LBL}>Date *</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={IN}/></div>
            <div><label style={LBL}>Session</label><input value={sessionLabel} onChange={e=>setSessionLabel(e.target.value)} placeholder="e.g. Morning / Lab" style={IN}/></div>
          </div>
          <div><label style={LBL}>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes" style={IN}/></div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Students ({names.filter(n=>n.name.trim()).length})</span>
          <div style={{ display:"flex", gap:8 }}>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFile} style={{ display:"none" }}/>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-muted)", fontSize:12, cursor:"pointer" }}>
              <Ico d={D.upload} size={13}/>{uploading?" Reading…":" Import file"}
            </button>
            <button onClick={addRow} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, border:"none", background:"#16a34a", color:"#fff", fontSize:12, cursor:"pointer" }}>
              <Ico d={D.plus} size={13}/> Add
            </button>
          </div>
        </div>
        {error && <div style={{ color:"#dc2626", fontSize:12.5, marginBottom:8 }}>{error}</div>}
        <div style={{ maxHeight:240, overflowY:"auto", display:"flex", flexDirection:"column", gap:5, marginBottom:18 }}>
          {names.map((row,i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input value={row.name} onChange={e=>updRow(i,"name",e.target.value)} placeholder={`Student ${i+1}`}
                style={{ flex:1, padding:"7px 10px", border:"1px solid var(--card-border)", borderRadius:7, background:"var(--input-bg)", color:"var(--text-primary)", fontSize:13, outline:"none" }}/>
              <select value={row.status} onChange={e=>updRow(i,"status",e.target.value)}
                style={{ padding:"7px 8px", border:"1px solid var(--card-border)", borderRadius:7, background:"var(--input-bg)", color:statusCfg[row.status]?.color||"inherit", fontSize:12, outline:"none", fontWeight:600 }}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
              <button onClick={()=>removeRow(i)} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", padding:4 }}><Ico d={D.x} size={14}/></button>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"9px 18px", borderRadius:10, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-secondary)", fontWeight:600, fontSize:14, cursor:"pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:"9px 22px", borderRadius:10, border:"none", background:saving?"#9ca3af":"#16a34a", color:"#fff", fontWeight:600, fontSize:14, cursor:saving?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8 }}>
            {saving && <div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.75s linear infinite" }}/>}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Post Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Attendance record card ────────────────────────────────────────
function AttendanceCard({ record, currentUser, onEdit, onDelete, onVerify, index }) {
  const [expanded, setExpanded] = useState(false);

  const isProfessor  = currentUser?.role === "professor";
  const isOwnRecord  = record.posted_by === currentUser?.id;
  const isVerified   = record.is_verified === true;

  // Mirrors backend permission matrix exactly
  const canEdit   = isProfessor || (isOwnRecord && !isVerified);
  const canDelete = isProfessor || (isOwnRecord && !isVerified);
  const canVerify = isProfessor && !isVerified;

  const present = (record.names||[]).filter(n=>n.status==="present").length;
  const absent  = (record.names||[]).filter(n=>n.status==="absent").length;
  const late    = (record.names||[]).filter(n=>n.status==="late").length;
  const total   = (record.names||[]).length;
  const color   = clrCourse(record.class_name);

  return (
    <div style={{
      background:"var(--card-bg)", borderRadius:16, overflow:"hidden",
      border: isVerified ? "1.5px solid rgba(22,163,74,0.45)" : "1px solid var(--card-border)",
      boxShadow:"var(--shadow-sm)", animation:`fadeUp 0.3s ease ${index*0.04}s both`,
    }}>
      {/* Verified banner */}
      {isVerified && (
        <div style={{ background:"rgba(22,163,74,0.08)", borderBottom:"1px solid rgba(22,163,74,0.2)", padding:"6px 16px", display:"flex", alignItems:"center", gap:8 }}>
          <Ico d={D.shield} size={13} stroke="#16a34a"/>
          <span style={{ fontSize:12, fontWeight:700, color:"#16a34a" }}>Verified</span>
          {record.verifier && <span style={{ fontSize:11.5, color:"#15803d" }}>by {record.verifier.name} · {timeAgo(record.verified_at)}</span>}
          {!isProfessor && (
            <span style={{ marginLeft:"auto", fontSize:11, color:"#16a34a", display:"flex", alignItems:"center", gap:4 }}>
              <Ico d={D.lock} size={11} stroke="#16a34a"/> Locked
            </span>
          )}
        </div>
      )}

      {/* Coloured header */}
      <div style={{ background:color, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.22)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700 }}>
            {record.class_name?.slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{record.class_name}</div>
            <div style={{ color:"rgba(255,255,255,0.85)", fontSize:12 }}>
              {fmtDate(record.record_date)}{record.session_label && ` · ${record.session_label}`}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {canVerify && (
            <button onClick={() => onVerify(record.id)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, background:"rgba(255,255,255,0.92)", border:"none", color:"#16a34a", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              <Ico d={D.checkC} size={13} stroke="#16a34a"/> Verify
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(record)} title="Edit"
              style={{ padding:"5px 8px", borderRadius:7, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", cursor:"pointer" }}>
              <Ico d={D.edit} size={14}/>
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(record)} title="Delete"
              style={{ padding:"5px 8px", borderRadius:7, background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", cursor:"pointer" }}>
              <Ico d={D.trash} size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding:"18px 20px" }}>
        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
          {[
            { label:"Present", val:present, ...statusCfg.present },
            { label:"Absent",  val:absent,  ...statusCfg.absent  },
            { label:"Late",    val:late,    ...statusCfg.late     },
            { label:"Total",   val:total,   bg:"var(--bg-tertiary)", color:"var(--text-secondary)" },
          ].map(({ label, val, bg, color: c }) => (
            <span key={label} style={{ padding:"3px 10px", borderRadius:99, background:bg, color:c, fontSize:12, fontWeight:600 }}>
              {val} {label}
            </span>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:record.notes?10:0 }}>
          {record.poster?.picture && <img src={record.poster.picture} alt="" style={{ width:22, height:22, borderRadius:"50%", objectFit:"cover" }}/>}
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>
            Posted by <strong style={{ color:"var(--text-secondary)" }}>{record.poster?.name || "Unknown"}</strong>
            <span style={{ color:"var(--text-faint)" }}> · {timeAgo(record.created_at)}</span>
          </span>
        </div>

        {record.notes && (
          <div style={{ fontSize:12.5, color:"var(--text-muted)", background:"var(--bg-tertiary)", borderRadius:8, padding:"7px 10px", marginTop:4 }}>{record.notes}</div>
        )}

        {total > 0 && (
          <>
            <button onClick={() => setExpanded(e => !e)}
              style={{ fontSize:12.5, color:"#16a34a", background:"none", border:"none", cursor:"pointer", fontWeight:600, padding:0, marginTop:10, display:"flex", alignItems:"center", gap:5 }}>
              {expanded ? "▲ Hide" : "▼ View"} {total} student{total!==1?"s":""}
            </button>
            {expanded && (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
                {/* Group by status for cleaner display */}
                {["present","absent","late"].map(status => {
                  const group = (record.names||[]).filter(s => (s.status||"present") === status);
                  if (!group.length) return null;
                  const cfg = statusCfg[status];
                  return (
                    <div key={status}>
                      <div style={{ fontSize:11, fontWeight:700, color:cfg.color, textTransform:"uppercase",
                        letterSpacing:"0.4px", marginBottom:4, marginTop:4 }}>
                        {cfg.label} ({group.length})
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                        {group.map((s,i) => (
                          <span key={i} style={{
                            display:"inline-block", padding:"4px 12px", borderRadius:99,
                            background:cfg.bg, color:cfg.color,
                            fontSize:14, fontWeight:500,
                            maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          }} title={s.name}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const isProfessor = user?.role === "professor";

  const [records,      setRecords]      = useState([]);
  const [courses,      setCourses]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);   // course sync indicator
  const [refreshing,   setRefreshing]   = useState(false);
  const [filterClass,  setFilterClass]  = useState("all");
  const [filterDate,   setFilterDate]   = useState("");       // ISO date string YYYY-MM-DD
  const [showModal,    setShowModal]    = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [error,        setError]        = useState("");
  const [liveMsg,      setLiveMsg]      = useState("");
  const sseRef = useRef(null);

  // ── Fetch records + courses ─────────────────────────────────────
  const loadData = useCallback(async (bg = false) => {
    if (bg) setRefreshing(true); else setLoading(true);
    try {
      const [recRes, courseRes] = await Promise.all([
        api.get("/attendance/my-classes"),
        api.get(isProfessor ? "/professor/courses" : "/classroom/courses"),
      ]);
      setRecords(recRes.data.records || []);
      const crs = (courseRes.data.courses || []).map(c => ({
        id:   c.id,
        name: c.name || c.courseName || c.section || c.id,
      }));
      setCourses(crs);
      setError("");
    } catch {
      if (!bg) setError("Could not load attendance — check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isProfessor]);

  // ── On mount: sync courses first, then load data ────────────────
  useEffect(() => {
    const init = async () => {
      setSyncing(true);
      try {
        // Populate user_courses so /my-classes returns correct data
        await api.post("/attendance/sync-courses");
      } catch {
        // Non-fatal — loadData will still try from existing cache
      } finally {
        setSyncing(false);
      }
      await loadData(false);
    };
    init();
  }, [loadData]);

  // ── SSE realtime ────────────────────────────────────────────────
  useEffect(() => {
    const token   = localStorage.getItem("bupulse_token");
    const apiBase = import.meta.env.VITE_API_URL || "";
    if (!token) return;

    const url = `${apiBase}/api/attendance/events?token=${encodeURIComponent(token)}`;
    const es  = new EventSource(url);
    sseRef.current = es;

    es.onmessage = e => {
      try {
        const { event, record, recordId } = JSON.parse(e.data);
        if (event === "INSERT" && record) {
          setRecords(prev => prev.find(r => r.id === record.id) ? prev : [record, ...prev]);
          setLiveMsg("New attendance posted"); setTimeout(() => setLiveMsg(""), 3000);
        } else if (event === "UPDATE" && record) {
          setRecords(prev => prev.map(r => r.id === record.id ? record : r));
        } else if (event === "DELETE" && recordId) {
          setRecords(prev => prev.filter(r => r.id !== recordId));
          setLiveMsg("Record removed"); setTimeout(() => setLiveMsg(""), 3000);
        }
      } catch {}
    };

    es.onerror = () => {}; // auto-reconnects

    return () => { es.close(); sseRef.current = null; };
  }, []);

  // ── Manual refresh — re-sync then reload ───────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await api.post("/attendance/sync-courses"); } catch {}
    await loadData(true);
  };

  // ── Handlers ────────────────────────────────────────────────────
  const handleSave = record => {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === record.id);
      if (idx >= 0) { const n=[...prev]; n[idx]=record; return n; }
      return [record, ...prev];
    });
    setShowModal(false); setEditRecord(null);
  };

  const handleVerify = async id => {
    try {
      const r = await api.patch(`/attendance/class/${id}/verify`);
      setRecords(prev => prev.map(rec => rec.id === id ? r.data.record : rec));
    } catch (err) { setError(err.response?.data?.error || "Verification failed"); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setRecords(prev => prev.filter(r => r.id !== deleteTarget.id)); // optimistic
    try {
      await api.delete(`/attendance/class/${deleteTarget.id}`);
    } catch (err) {
      setError(err.response?.data?.error || "Delete failed");
      loadData(true); // revert optimistic on failure
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  // ── Derived ─────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    const classOk = filterClass === "all" || r.class_id === filterClass;
    const dateOk  = !filterDate || r.record_date === filterDate;
    return classOk && dateOk;
  });
  const totalPresent  = filtered.reduce((s,r) => s + (r.names||[]).filter(n=>n.status==="present").length, 0);
  const totalStudents = filtered.reduce((s,r) => s + (r.names||[]).length, 0);
  const pct           = totalStudents ? Math.round((totalPresent/totalStudents)*100) : 0;

  // ── Skeleton ────────────────────────────────────────────────────
  if (loading || syncing) return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <div style={{ textAlign:"center", padding:"60px 0", color:"var(--text-muted)" }}>
        <div style={{ width:36, height:36, border:"3px solid var(--border-color)", borderTopColor:"#16a34a", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 14px" }}/>
        <div style={{ fontSize:14 }}>{syncing ? "Syncing your class roster…" : "Loading attendance…"}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:1100, margin:"0 auto", animation:"fadeIn 0.35s ease" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"var(--text-primary)", fontFamily:"var(--font-display)", marginBottom:2 }}>Attendance</h1>
          <div style={{ fontSize:12.5, color:"var(--text-muted)", display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", animation:"pulse-dot 2.5s ease infinite", flexShrink:0 }} title="Realtime connected"/>
            {liveMsg
              ? <span style={{ color:"#16a34a", fontWeight:600 }}>{liveMsg}</span>
              : refreshing ? "Updating…"
              : `${records.length} record${records.length!==1?"s":""} · ${courses.length} class${courses.length!==1?"es":""}`
            }
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleRefresh} title="Refresh" disabled={refreshing}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:10, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-secondary)", fontSize:13, cursor:"pointer", opacity:refreshing?0.6:1 }}>
            <Ico d={D.refresh} size={14}/>
          </button>
          <button onClick={() => { setEditRecord(null); setShowModal(true); }}
            style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", borderRadius:10, border:"none", background:"#16a34a", color:"#fff", fontWeight:600, fontSize:14, cursor:"pointer", boxShadow:"0 2px 8px rgba(22,163,74,0.3)" }}>
            <Ico d={D.plus} size={15} stroke="#fff"/> New Record
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:"#fee2e2", borderRadius:10, padding:"11px 16px", color:"#dc2626", fontSize:13.5, marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
          <Ico d={D.warn} size={16} stroke="#dc2626"/>{error}
          <button onClick={() => setError("")} style={{ marginLeft:"auto", background:"none", border:"none", color:"#dc2626", cursor:"pointer" }}><Ico d={D.x} size={14} stroke="#dc2626"/></button>
        </div>
      )}

      {/* No courses warning */}
      {courses.length === 0 && !loading && (
        <div style={{ background:"#fef9c3", border:"1px solid #fde047", borderRadius:12, padding:"12px 16px", color:"#854d0e", fontSize:13.5, marginBottom:14, display:"flex", gap:10, alignItems:"flex-start" }}>
          <Ico d={D.info} size={16} stroke="#854d0e"/>
          <span>No classes found. Make sure you're enrolled in Google Classroom courses and try <button onClick={handleRefresh} style={{ color:"#b45309", fontWeight:700, background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>refreshing</button>.</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        <StatBox label="Sessions"        value={filtered.length}  color="var(--text-primary)"/>
        <StatBox label="Total Present"   value={totalPresent}     color="#16a34a"/>
        <StatBox label="Attendance Rate" value={`${pct}%`}        color={pct>=75?"#16a34a":pct>=50?"#ca8a04":"#dc2626"}/>
      </div>

      {/* Class filter — dropdown */}
      {courses.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <label style={{ fontSize:12.5, color:"var(--text-muted)", fontWeight:600, flexShrink:0 }}>Class:</label>
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            style={{ flex:1, maxWidth:340, padding:"8px 12px", borderRadius:9, border:"1.5px solid var(--card-border)", background:"var(--input-bg)", color:"var(--text-primary)", fontSize:13.5, outline:"none", cursor:"pointer" }}
          >
            <option value="all">All Classes</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date filter */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <label style={{ fontSize:12.5, color:"var(--text-muted)", fontWeight:600, flexShrink:0 }}>Filter by date:</label>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{ padding:"6px 10px", borderRadius:8, border:"1.5px solid var(--card-border)",
            background:"var(--input-bg)", color:"var(--text-primary)", fontSize:13, outline:"none" }}
        />
        {filterDate && (
          <button onClick={() => setFilterDate("")}
            style={{ padding:"5px 12px", borderRadius:8, border:"1px solid var(--card-border)",
              background:"transparent", color:"var(--text-muted)", fontSize:12.5, cursor:"pointer" }}>
            Clear
          </button>
        )}
        <span style={{ fontSize:12, color:"var(--text-faint)", marginLeft:"auto" }}>
          {filtered.length} record{filtered.length!==1?"s":""} shown
        </span>
      </div>

      {/* Records */}
      {filtered.length === 0 ? (
        <div style={{ background:"var(--card-bg)", border:"1px solid var(--card-border)", borderRadius:16, padding:"48px 24px", textAlign:"center" }}>
          <div style={{ fontSize:38, marginBottom:10 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--text-primary)", marginBottom:6 }}>No attendance records yet</div>
          <div style={{ fontSize:13.5, color:"var(--text-muted)" }}>
            {courses.length === 0 ? "No classes found — try refreshing." : "Be the first to post attendance for your class."}
          </div>
        </div>
      ) : (
        <div className="attendance-grid" style={{ display:"grid", gap:16 }}>
          {filtered.map((record, i) => (
            <AttendanceCard key={record.id} record={record} index={i} currentUser={user}
              onEdit={rec => { setEditRecord(rec); setShowModal(true); }}
              onDelete={rec => setDeleteTarget(rec)}
              onVerify={handleVerify}
            />
          ))}
        </div>
      )}

      {showModal && <RecordModal courses={courses} existing={editRecord} onSave={handleSave} onClose={() => { setShowModal(false); setEditRecord(null); }}/>}
      {deleteTarget && <DeleteModal record={deleteTarget} loading={deleting} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)}/>}

      <style>{`
        @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3}  }
        @keyframes fadeIn    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn   { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        .attendance-grid { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 700px) { .attendance-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
