import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const IcoPlus   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoUpload = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcoTrash  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
const IcoCheck  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoUsers  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoEdit   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",year:"numeric"}) : "";
const statusColors = {
  draft:     {bg:"#fff7ed",color:"#d97706",label:"Draft"},
  submitted: {bg:"#eff6ff",color:"#2563eb",label:"Submitted"},
  verified:  {bg:"#f0fdf4",color:"#16a34a",label:"Verified"},
};

// ── New Record Modal ──────────────────────────────────────────────
function NewRecordModal({ courses, onSave, onClose }) {
  const [course, setCourse]       = useState(courses?.[0]?.name || "");
  const [courseId, setCourseId]   = useState(courses?.[0]?.id || "");
  const [date, setDate]           = useState(new Date().toISOString().split("T")[0]);
  const [names, setNames]         = useState([{ name:"", status:"present" }]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef(null);

  const addRow    = () => setNames(n=>[...n,{name:"",status:"present"}]);
  const removeRow = (i) => setNames(n=>n.filter((_,j)=>j!==i));
  const updateRow = (i,field,val) => setNames(n=>n.map((r,j)=>j===i?{...r,[field]:val}:r));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true); setError("");
    try {
      const base64 = await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(",")[1]);
        r.onerror=rej;
        r.readAsDataURL(file);
      });
      setExtracting(true);

      // Send fileData for images so Gemini can read them visually
      const payload = file.type.startsWith("image/")
        ? { fileData: base64, fileType: file.type }
        : { text: `Attendance sheet: ${file.name}` };

      const res = await api.post("/attendance/extract", payload);
      const extracted = res.data.names || [];
      if (extracted.length > 0) setNames(extracted);
      else setError("No names found. Please add manually.");
    } catch(err) { setError(err.response?.data?.error || "Failed to extract names"); }
    finally { setUploading(false); setExtracting(false); }
  };

  const validNames = names.filter(n=>n.name.trim());

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"var(--card-bg)",borderRadius:18,padding:24,width:"100%",maxWidth:520,boxShadow:"var(--shadow-xl)"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:"var(--text-primary)",marginBottom:20}}>New Attendance Record</h3>
        <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
          {courses?.length > 0 ? (
            <div>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Class *</label>
              <select value={courseId} onChange={e=>{setCourseId(e.target.value);setCourse(courses.find(c=>c.id===e.target.value)?.name||e.target.value);}}
                style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none"}}>
                {courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Class name *</label>
              <input value={course} onChange={e=>setCourse(e.target.value)}
                style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          )}
          <div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Date *</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>Students ({validNames.length})</div>
          <div style={{display:"flex",gap:8}}>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFile} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading||extracting}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:12,cursor:"pointer"}}>
              <IcoUpload/> {uploading?"Uploading…":extracting?"Reading…":"Import from file"}
            </button>
            <button onClick={addRow} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:7,border:"none",background:"var(--green-700)",color:"#fff",fontSize:12,cursor:"pointer"}}>
              <IcoPlus/> Add
            </button>
          </div>
        </div>

        {error && <div style={{color:"#dc2626",fontSize:12.5,marginBottom:10}}>{error}</div>}

        <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {names.map((row,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={row.name} onChange={e=>updateRow(i,"name",e.target.value)} placeholder={`Student ${i+1}`}
                style={{flex:1,padding:"7px 10px",border:"1px solid var(--card-border)",borderRadius:7,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:13,outline:"none"}}/>
              <select value={row.status} onChange={e=>updateRow(i,"status",e.target.value)}
                style={{padding:"7px 8px",border:"1px solid var(--card-border)",borderRadius:7,background:"var(--input-bg)",color:row.status==="present"?"#16a34a":"#dc2626",fontSize:12,outline:"none"}}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
              <button onClick={()=>removeRow(i)} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer"}}><IcoTrash/></button>
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 18px",borderRadius:9,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:13.5,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave({course_name:course||courseId,course_id:courseId||null,record_date:date,names:validNames,source:"manual"})}
            disabled={!course||!date||validNames.length===0}
            style={{padding:"9px 18px",borderRadius:9,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>
            Save attendance
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Record Detail Modal (with edit for professor) ─────────────────
function RecordDetail({ record, isProfessor, onVerify, onSave, onClose }) {
  const [editing, setEditing]     = useState(false);
  const [names, setNames]         = useState(record.names || []);
  const [saving, setSaving]       = useState(false);

  const present = names.filter(n=>n.status==="present").length;
  const absent  = names.filter(n=>n.status==="absent").length;
  const late    = names.filter(n=>n.status==="late").length;
  const cfg     = statusColors[record.status] || statusColors.draft;

  const handleSave = async () => {
    setSaving(true);
    await onSave(record.id, names);
    setEditing(false);
    setSaving(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"var(--card-bg)",borderRadius:18,padding:24,width:"100%",maxWidth:500,boxShadow:"var(--shadow-xl)",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <h3 style={{fontSize:16,fontWeight:700,color:"var(--text-primary)",margin:0}}>{record.course_name}</h3>
            <p style={{fontSize:13,color:"var(--text-muted)",margin:"4px 0 0"}}>{fmtDate(record.record_date)}</p>
            {record.user && <p style={{fontSize:12,color:"var(--text-muted)",margin:"2px 0 0"}}>👤 {record.user.name || record.user.email}</p>}
          </div>
          <span style={{background:cfg.bg,color:cfg.color,fontSize:11.5,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{cfg.label}</span>
        </div>

        {/* Stats */}
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          {[["Present","#16a34a",present],["Absent","#dc2626",absent],["Late","#d97706",late]].map(([l,c,v])=>(
            <div key={l} style={{flex:1,background:c+"15",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Name list */}
        <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:16}}>
          {names.map((n,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"var(--bg-tertiary)",borderRadius:8,fontSize:13}}>
              <span style={{color:"var(--text-primary)"}}>{i+1}. {n.name}</span>
              {editing ? (
                <select value={n.status} onChange={e=>setNames(prev=>prev.map((r,j)=>j===i?{...r,status:e.target.value}:r))}
                  style={{padding:"3px 8px",borderRadius:6,border:"1px solid var(--card-border)",background:"var(--input-bg)",color:n.status==="present"?"#16a34a":n.status==="late"?"#d97706":"#dc2626",fontSize:12,outline:"none"}}>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
              ) : (
                <span style={{fontSize:11.5,fontWeight:700,color:n.status==="present"?"#16a34a":n.status==="late"?"#d97706":"#dc2626",background:n.status==="present"?"#f0fdf4":n.status==="late"?"#fff7ed":"#fee2e2",padding:"2px 8px",borderRadius:99}}>
                  {n.status?.charAt(0).toUpperCase()+n.status?.slice(1)}
                </span>
              )}
            </div>
          ))}
        </div>

        {record.file_url && (
          <a href={record.file_url} target="_blank" rel="noopener noreferrer"
            style={{display:"inline-flex",alignItems:"center",gap:5,marginBottom:14,padding:"7px 12px",background:"var(--bg-tertiary)",borderRadius:8,fontSize:12.5,color:"var(--text-secondary)",textDecoration:"none"}}>
            📎 View uploaded file
          </a>
        )}

        <div style={{display:"flex",gap:10,marginTop:6,justifyContent:"flex-end",flexWrap:"wrap"}}>
          {isProfessor && editing && (
            <button onClick={handleSave} disabled={saving}
              style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:9,border:"none",background:"#2563eb",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>
              {saving?"Saving…":"Save changes"}
            </button>
          )}
          {isProfessor && !editing && (
            <button onClick={()=>setEditing(true)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:9,border:"1px solid var(--card-border)",background:"var(--bg-tertiary)",color:"var(--text-primary)",fontSize:13.5,cursor:"pointer"}}>
              <IcoEdit/> Edit
            </button>
          )}
          {isProfessor && record.status !== "verified" && !editing && (
            <button onClick={()=>onVerify(record.id)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:9,border:"none",background:"#16a34a",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>
              <IcoCheck/> Verify
            </button>
          )}
          {editing && (
            <button onClick={()=>{setEditing(false);setNames(record.names||[]);}}
              style={{padding:"9px 16px",borderRadius:9,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:13.5,cursor:"pointer"}}>Cancel</button>
          )}
          <button onClick={onClose} style={{padding:"9px 16px",borderRadius:9,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:13.5,cursor:"pointer"}}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Attendance Record Card ────────────────────────────────────────
function RecordCard({ rec, onClick, onDelete, showStudent }) {
  const cfg     = statusColors[rec.status] || statusColors.draft;
  const present = rec.names?.filter(n=>n.status==="present").length || 0;
  const total   = rec.names?.length || 0;
  return (
    <div style={{display:"flex",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid var(--border-color)",cursor:"pointer"}} onClick={onClick}>
      <div style={{flex:1}}>
        <div style={{fontSize:13.5,fontWeight:600,color:"var(--text-primary)"}}>{fmtDate(rec.record_date)}</div>
        {showStudent && rec.user && (
          <div style={{fontSize:11.5,color:"var(--green-700)",marginTop:1}}>👤 {rec.user.name||rec.user.email}</div>
        )}
        <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>
          {total > 0 ? `${present}/${total} present` : "No names recorded"}
        </div>
      </div>
      <span style={{background:cfg.bg,color:cfg.color,fontSize:11.5,fontWeight:700,padding:"3px 10px",borderRadius:99,marginRight:10}}>{cfg.label}</span>
      {onDelete && (
        <button onClick={e=>{e.stopPropagation();onDelete(rec.id);}} style={{background:"none",border:"none",color:"var(--text-faint)",cursor:"pointer",padding:4}}>
          <IcoTrash/>
        </button>
      )}
    </div>
  );
}

// ── Parent Attendance View ────────────────────────────────────────
function ParentAttendanceView({ students }) {
  const [selected, setSelected] = useState(students?.find(s=>!s.pending) || null);
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [detail, setDetail]     = useState(null);

  useEffect(()=>{
    if (!selected || selected.pending) return;
    setLoading(true);
    api.get(`/attendance/parent/${selected.id}`)
      .then(r=>setRecords(r.data.records||[]))
      .catch(()=>setRecords([]))
      .finally(()=>setLoading(false));
  }, [selected?.id]);

  if (!students?.length) return (
    <div style={{textAlign:"center",padding:"60px 24px",background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)"}}>
      <div style={{fontSize:44,marginBottom:12}}>👨‍👩‍👧</div>
      <p style={{color:"var(--text-muted)",fontSize:14}}>No linked students. Link a student from the Parent Dashboard.</p>
    </div>
  );

  const grouped = records.reduce((acc,r)=>{const k=r.course_name;if(!acc[k])acc[k]=[];acc[k].push(r);return acc;},{});

  return (
    <div>
      {/* Student selector */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {students.filter(s=>!s.pending).map(s=>(
          <button key={s.id} onClick={()=>setSelected(s)} style={{
            display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,cursor:"pointer",
            border:`2px solid ${selected?.id===s.id?"#3730a3":"var(--border-color)"}`,
            background:selected?.id===s.id?"#eef2ff":"var(--card-bg)",
          }}>
            {s.picture ? <img src={s.picture} style={{width:24,height:24,borderRadius:"50%"}}/> :
              <div style={{width:24,height:24,borderRadius:"50%",background:"#3730a3",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>{s.name?.charAt(0)}</div>}
            <span style={{fontSize:13,fontWeight:500,color:"var(--text-primary)"}}>{s.name?.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>
      ) : records.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 24px",background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)"}}>
          <div style={{fontSize:40,marginBottom:10}}>📋</div>
          <p style={{color:"var(--text-muted)",fontSize:14}}>No attendance records for this student yet.</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {Object.entries(grouped).map(([courseName,recs])=>(
            <div key={courseName} style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid var(--card-border)",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"var(--bg-tertiary)",borderBottom:"1px solid var(--card-border)",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{courseName}</span>
                <span style={{fontSize:12,color:"var(--text-muted)",background:"var(--card-bg)",padding:"2px 8px",borderRadius:99}}>{recs.length} record{recs.length!==1?"s":""}</span>
              </div>
              {recs.map(rec=>(
                <RecordCard key={rec.id} rec={rec} onClick={()=>setDetail(rec)} showStudent={false}/>
              ))}
            </div>
          ))}
        </div>
      )}

      {detail && <RecordDetail record={detail} isProfessor={false} onVerify={()=>{}} onSave={()=>{}} onClose={()=>setDetail(null)}/>}
    </div>
  );
}

// ── Main Attendance Page ──────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuth();
  const isProfessor = user?.role === "professor";
  const isParent    = user?.role === "parent";

  const [records, setRecords]   = useState([]);
  const [students, setStudents] = useState([]); // for parent
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [selected, setSelected] = useState(null);
  const [courses, setCourses]   = useState([]);
  const [error, setError]       = useState("");

  const load = async () => {
    try {
      if (isParent) {
        const res = await api.get("/parent/students");
        setStudents(res.data.students || []);
        setLoading(false);
        return;
      }

      const endpoint = isProfessor ? "/attendance/professor/all" : "/attendance";
      const [recRes, courseRes] = await Promise.all([
        api.get(endpoint),
        api.get(isProfessor ? "/professor/courses" : "/classroom/courses").catch(()=>({data:{courses:[]}})),
      ]);
      setRecords(recRes.data.records || []);
      setCourses(courseRes.data.courses || []);
    } catch { setError("Failed to load attendance"); }
    finally { setLoading(false); }
  };

  useEffect(()=>{load();},[]);

  const handleSave = async (form) => {
    try { await api.post("/attendance", form); setShowNew(false); load(); }
    catch(err) { setError(err.response?.data?.error || "Failed to save"); }
  };

  const handleVerify = async (id) => {
    try { await api.patch(`/attendance/${id}/verify`); setSelected(null); load(); }
    catch(err) { setError(err.response?.data?.error || "Failed to verify"); }
  };

  const handleEdit = async (id, names) => {
    try {
      const endpoint = isProfessor ? `/attendance/professor/${id}` : `/attendance/${id}`;
      await api.patch(endpoint, { names });
      load();
    } catch(err) { setError(err.response?.data?.error || "Failed to save"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this attendance record?")) return;
    try { await api.delete(`/attendance/${id}`); setRecords(prev=>prev.filter(r=>r.id!==id)); }
    catch { setError("Failed to delete"); }
  };

  const grouped = records.reduce((acc,r)=>{
    const key = isProfessor ? (r.course_name) : r.course_name;
    if(!acc[key]) acc[key]=[];
    acc[key].push(r);
    return acc;
  },{});

  // Parent view
  if (isParent) return (
    <div style={{animation:"fadeIn 0.3s ease",maxWidth:800}}>
      <div style={{marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:800,color:"var(--text-primary)",margin:0,display:"flex",alignItems:"center",gap:8}}>
          <IcoUsers/> Student Attendance
        </h1>
        <p style={{fontSize:13.5,color:"var(--text-muted)",margin:"4px 0 0"}}>View your child's attendance records</p>
      </div>
      {loading ? <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Loading…</div>
        : <ParentAttendanceView students={students}/>}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );

  return (
    <div style={{animation:"fadeIn 0.3s ease",maxWidth:800}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"var(--text-primary)",margin:0,display:"flex",alignItems:"center",gap:8}}>
            <IcoUsers/> Attendance
          </h1>
          <p style={{fontSize:13.5,color:"var(--text-muted)",margin:"4px 0 0"}}>
            {isProfessor ? "View and verify all student attendance records" : "Track and submit attendance records"}
          </p>
        </div>
        <button onClick={()=>setShowNew(true)}
          style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",borderRadius:10,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>
          <IcoPlus/> New record
        </button>
      </div>

      {error && (
        <div style={{background:"#fee2e2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",color:"#b91c1c",fontSize:13,marginBottom:14,display:"flex",justifyContent:"space-between"}}>
          {error}<button onClick={()=>setError("")} style={{background:"none",border:"none",color:"#b91c1c",cursor:"pointer"}}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[...Array(3)].map((_,i)=><div key={i} style={{height:80,borderRadius:12,background:"var(--card-bg)",animation:"pulse-bg 1.5s ease infinite"}}/>)}
        </div>
      ) : records.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 24px",background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)"}}>
          <div style={{fontSize:48,marginBottom:12}}>📋</div>
          <h3 style={{fontSize:17,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>No attendance records</h3>
          <p style={{fontSize:14,color:"var(--text-muted)",marginBottom:20}}>Start by creating a new attendance record.</p>
          <button onClick={()=>setShowNew(true)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>
            <IcoPlus/> New record
          </button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {Object.entries(grouped).map(([courseName,recs])=>(
            <div key={courseName} style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid var(--card-border)",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"var(--bg-tertiary)",borderBottom:"1px solid var(--card-border)",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{courseName}</span>
                <span style={{fontSize:12,color:"var(--text-muted)",background:"var(--card-bg)",padding:"2px 8px",borderRadius:99}}>{recs.length} record{recs.length!==1?"s":""}</span>
              </div>
              {recs.map(rec=>(
                <RecordCard key={rec.id} rec={rec} onClick={()=>setSelected(rec)} onDelete={!isProfessor?handleDelete:null} showStudent={isProfessor}/>
              ))}
            </div>
          ))}
        </div>
      )}

      {showNew && <NewRecordModal courses={courses} onSave={handleSave} onClose={()=>setShowNew(false)}/>}
      {selected && (
        <RecordDetail
          record={selected}
          isProfessor={isProfessor}
          onVerify={handleVerify}
          onSave={handleEdit}
          onClose={()=>setSelected(null)}
        />
      )}

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes pulse-bg{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>
    </div>
  );
}
