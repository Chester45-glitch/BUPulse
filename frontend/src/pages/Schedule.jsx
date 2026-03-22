import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// Start week on Sunday to match school schedule
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const COLORS = ["#16a34a","#2563eb","#7c3aed","#dc2626","#d97706","#0891b2","#db2777"];
const SHORT  = { Sunday:"Sun",Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat" };

const timeToMins = (t) => { const [h,m] = (t||"00:00").split(":").map(Number); return h*60+m; };
const fmtTime = (t) => {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
};
const fmtDate = (d) => new Date(d).toLocaleDateString("en-PH",{month:"short",day:"numeric"});
const daysUntil = (d) => Math.ceil((new Date(d)-new Date())/86400000);

const IcoPlus     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoTrash    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
const IcoUpload   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcoEdit     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoClock    = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoPin      = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcoUser     = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoCalendar = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoChevL    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IcoChevR    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;

// ── Add/Edit Modal ──────────────────────────────────────────────────
function EntryModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState(entry || {
    course_name:"", course_code:"", day_of_week:"Monday",
    start_time:"08:00", end_time:"10:00", room:"", professor:"", color:"#16a34a",
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"var(--card-bg)",borderRadius:18,padding:24,width:"100%",maxWidth:500,boxShadow:"var(--shadow-xl)",maxHeight:"90vh",overflowY:"auto"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:"var(--text-primary)",marginBottom:20}}>{entry?.id?"Edit Class":"Add Class"}</h3>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:2}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Course Name *</label>
              <input value={form.course_name} onChange={e=>set("course_name",e.target.value)} style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Code</label>
              <input value={form.course_code} onChange={e=>set("course_code",e.target.value)} style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Day *</label>
            <select value={form.day_of_week} onChange={e=>set("day_of_week",e.target.value)} style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none"}}>
              {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Start *</label>
              <input type="time" value={form.start_time} onChange={e=>set("start_time",e.target.value)} style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>End *</label>
              <input type="time" value={form.end_time} onChange={e=>set("end_time",e.target.value)} style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Room</label>
            <input value={form.room} onChange={e=>set("room",e.target.value)} placeholder="e.g. CL 6, ECB 201" style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:5}}>Professor</label>
            <input value={form.professor} onChange={e=>set("professor",e.target.value)} placeholder="e.g. Dr. Juan dela Cruz" style={{width:"100%",padding:"9px 12px",border:"1.5px solid var(--card-border)",borderRadius:9,background:"var(--input-bg)",color:"var(--text-primary)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:8}}>Color</label>
            <div style={{display:"flex",gap:8}}>
              {COLORS.map(c=><button key={c} onClick={()=>set("color",c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"3px solid var(--text-primary)":"2px solid transparent",cursor:"pointer"}}/>)}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:22,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 18px",borderRadius:9,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:13.5,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave(form)} disabled={!form.course_name||!form.day_of_week} style={{padding:"9px 18px",borderRadius:9,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}>
            {entry?.id?"Save changes":"Add class"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Class card ──────────────────────────────────────────────────────
function ClassCard({ c, onEdit, onDelete }) {
  const duration = timeToMins(c.end_time) - timeToMins(c.start_time);
  return (
    <div style={{background:c.color+"12",border:`1.5px solid ${c.color}35`,borderLeft:`3px solid ${c.color}`,borderRadius:10,overflow:"hidden",position:"relative"}}>
      <div style={{background:c.color,padding:"5px 8px",display:"flex",alignItems:"center",gap:4}}>
        <IcoClock/>
        <span style={{color:"#fff",fontSize:10.5,fontWeight:700}}>{fmtTime(c.start_time)} – {fmtTime(c.end_time)}</span>
        <span style={{color:"rgba(255,255,255,0.65)",fontSize:9.5,marginLeft:"auto"}}>{duration}min</span>
      </div>
      <div style={{padding:"7px 8px 8px"}}>
        <div style={{fontSize:12,fontWeight:700,color:c.color,lineHeight:1.3,marginBottom:3}}>{c.course_name}</div>
        {c.course_code&&<div style={{fontSize:10,color:"var(--text-muted)",marginBottom:4,fontWeight:600}}>{c.course_code}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {c.room&&<div style={{display:"flex",alignItems:"center",gap:4,color:"var(--text-muted)"}}><IcoPin/><span style={{fontSize:10.5}}>{c.room}</span></div>}
          {c.professor&&<div style={{display:"flex",alignItems:"center",gap:4,color:"var(--text-muted)"}}><IcoUser/><span style={{fontSize:10.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.professor}</span></div>}
        </div>
      </div>
      <div style={{position:"absolute",top:28,right:4,display:"flex",gap:2}}>
        <button onClick={()=>onEdit(c)} style={{width:18,height:18,border:"none",background:"rgba(255,255,255,0.85)",cursor:"pointer",color:"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,padding:0}}><IcoEdit/></button>
        <button onClick={()=>onDelete(c.id)} style={{width:18,height:18,border:"none",background:"rgba(255,255,255,0.85)",cursor:"pointer",color:"#dc2626",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,padding:0}}><IcoTrash/></button>
      </div>
    </div>
  );
}

// ── Calendar Month View ─────────────────────────────────────────────
function CalendarView({ schedules, deadlines }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-PH",{month:"long",year:"numeric"});

  // Build calendar grid (6 weeks)
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewDate(new Date(year, month-1, 1));
  const nextMonth = () => setViewDate(new Date(year, month+1, 1));

  // Map schedules by day-of-week name
  const scheduleByDay = {};
  schedules.forEach(s => {
    if (!scheduleByDay[s.day_of_week]) scheduleByDay[s.day_of_week] = [];
    scheduleByDay[s.day_of_week].push(s);
  });

  // Map deadlines by date string "YYYY-MM-DD"
  const deadlineByDate = {};
  (deadlines||[]).forEach(d => {
    const key = new Date(d.dueDate).toISOString().split("T")[0];
    if (!deadlineByDate[key]) deadlineByDate[key] = [];
    deadlineByDate[key].push(d);
  });

  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  return (
    <div style={{background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)",overflow:"hidden",boxShadow:"var(--shadow-sm)"}}>
      {/* Calendar header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--card-border)"}}>
        <button onClick={prevMonth} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:"var(--bg-tertiary)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}><IcoChevL/></button>
        <h3 style={{fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>{monthName}</h3>
        <button onClick={nextMonth} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--card-border)",background:"var(--bg-tertiary)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}><IcoChevR/></button>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--card-border)"}}>
        {DAY_NAMES.map(d=>(
          <div key={d} style={{padding:"8px 4px",textAlign:"center",fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.4px"}}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
        {cells.map((day,i) => {
          if (!day) return <div key={`e${i}`} style={{minHeight:90,borderRight:"1px solid var(--border-color)",borderBottom:"1px solid var(--border-color)",background:"var(--bg-primary)",opacity:0.4}}/>;

          const dateObj  = new Date(year, month, day);
          const dayName  = DAY_FULL[dateObj.getDay()];
          const dateKey  = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isToday  = today.getDate()===day && today.getMonth()===month && today.getFullYear()===year;
          const isPast   = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const classes  = scheduleByDay[dayName] || [];
          const dues     = deadlineByDate[dateKey] || [];

          return (
            <div key={day} style={{
              minHeight:90,
              borderRight:"1px solid var(--border-color)",
              borderBottom:"1px solid var(--border-color)",
              padding:"4px",
              background: isToday ? "rgba(22,163,74,0.04)" : "transparent",
              opacity: isPast ? 0.55 : 1,
            }}>
              {/* Day number */}
              <div style={{
                width:24,height:24,borderRadius:"50%",
                background:isToday?"var(--green-700)":"transparent",
                color:isToday?"#fff":"var(--text-muted)",
                fontSize:12,fontWeight:isToday?700:400,
                display:"flex",alignItems:"center",justifyContent:"center",
                marginBottom:2,
              }}>{day}</div>

              {/* Class chips */}
              {classes.slice(0,2).map((c,ci)=>(
                <div key={ci} style={{
                  background:c.color,color:"#fff",
                  borderRadius:4,padding:"1px 5px",
                  fontSize:9.5,fontWeight:600,
                  marginBottom:2,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  lineHeight:1.6,
                }} title={`${c.course_name} ${fmtTime(c.start_time)}`}>
                  {c.course_name.length>14?c.course_name.slice(0,13)+"…":c.course_name}
                </div>
              ))}
              {classes.length>2&&(
                <div style={{fontSize:9,color:"var(--text-muted)",padding:"0 2px"}}>+{classes.length-2} more</div>
              )}

              {/* Deadline chips */}
              {dues.slice(0,2).map((d,di)=>(
                <div key={`d${di}`} style={{
                  background:"#fee2e2",color:"#dc2626",
                  borderRadius:4,padding:"1px 5px",
                  fontSize:9.5,fontWeight:600,
                  marginBottom:2,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  lineHeight:1.6,
                  border:"1px solid #fecaca",
                }} title={d.title}>
                  📋 {d.title.length>12?d.title.slice(0,11)+"…":d.title}
                </div>
              ))}
              {dues.length>2&&(
                <div style={{fontSize:9,color:"#dc2626",padding:"0 2px"}}>+{dues.length-2} due</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{padding:"10px 16px",borderTop:"1px solid var(--card-border)",display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text-muted)"}}>
          <div style={{width:10,height:10,borderRadius:2,background:"var(--green-600)"}}/> Class
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--text-muted)"}}>
          <div style={{width:10,height:10,borderRadius:2,background:"#fee2e2",border:"1px solid #fecaca"}}/> Deadline
        </div>
      </div>
    </div>
  );
}

// ── Main Schedule Page ──────────────────────────────────────────────
export default function Schedule() {
  const { user } = useAuth();
  const [schedules, setSchedules]   = useState([]);
  const [deadlines, setDeadlines]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("calendar"); // calendar | week
  const [showModal, setShowModal]   = useState(false);
  const [editEntry, setEditEntry]   = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted]   = useState(null);
  const [error, setError]           = useState("");
  const fileRef = useRef(null);

  const todayName = DAYS[new Date().getDay()]; // DAYS starts with Sunday so index matches JS getDay()

  const load = async () => {
    try {
      const [schRes, dlRes] = await Promise.all([
        api.get("/schedule"),
        api.get("/classroom/deadlines").catch(()=>({data:{deadlines:[]}})),
      ]);
      setSchedules(schRes.data.schedules || []);
      setDeadlines(dlRes.data.deadlines || []);
    } catch { setError("Failed to load schedule"); }
    finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const nowMins = new Date().getHours()*60+new Date().getMinutes();
  const todayClasses = schedules.filter(s=>s.day_of_week===todayName).sort((a,b)=>timeToMins(a.start_time)-timeToMins(b.start_time));
  const currentClass = todayClasses.find(c=>timeToMins(c.start_time)<=nowMins&&timeToMins(c.end_time)>nowMins);
  const nextClass    = todayClasses.find(c=>timeToMins(c.start_time)>nowMins);
  const minsUntilNext = nextClass ? timeToMins(nextClass.start_time)-nowMins : null;

  // Upcoming deadlines (next 7 days)
  const now = new Date();
  const upcomingDue = deadlines
    .filter(d=>{ const diff=daysUntil(d.dueDate); return diff>=0&&diff<=7; })
    .sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))
    .slice(0,5);
  const overdueDue = deadlines.filter(d=>daysUntil(d.dueDate)<0).slice(0,3);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value="";
    if (file.size>10*1024*1024){setError("File too large (max 10MB)");return;}
    setUploading(true);setError("");
    try {
      const base64 = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      await api.post("/upload/drive",{fileName:file.name,fileType:file.type,fileData:base64});
      setExtracting(true);
      const extractRes = await api.post("/schedule/extract",{fileName:file.name,fileData:base64,fileType:file.type});
      const entries = (extractRes.data.entries||[]).map((e,i)=>({...e,color:COLORS[i%COLORS.length]}));
      setExtracted(entries);
    } catch(err){setError(err.response?.data?.error||"Failed to process file");}
    finally{setUploading(false);setExtracting(false);}
  };

  const saveExtracted = async () => {
    if(!extracted?.length)return;
    try{await api.post("/schedule/bulk",{entries:extracted});setExtracted(null);load();}
    catch(err){setError(err.response?.data?.error||"Failed to save");}
  };

  const handleSave = async (form) => {
    try{
      if(editEntry?.id) await api.put(`/schedule/${editEntry.id}`,form);
      else await api.post("/schedule",form);
      setShowModal(false);setEditEntry(null);load();
    }catch(err){setError(err.response?.data?.error||"Failed to save");}
  };

  const handleDelete = async (id) => {
    if(!confirm("Remove this class?"))return;
    try{await api.delete(`/schedule/${id}`);setSchedules(prev=>prev.filter(s=>s.id!==id));}
    catch{setError("Failed to delete");}
  };

  // ── Weekly grid (Sun–Sat) ────────────────────────────────────────
  const renderWeek = () => (
    <div className="schedule-week-grid" style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,overflowX:"auto"}}>
      {DAYS.map(day=>{
        const dayClasses=schedules.filter(s=>s.day_of_week===day).sort((a,b)=>timeToMins(a.start_time)-timeToMins(b.start_time));
        const isToday=day===todayName;
        return(
          <div key={day}>
            <div style={{padding:"8px 10px",borderRadius:"10px 10px 0 0",background:isToday?"var(--green-700)":"var(--bg-tertiary)",color:isToday?"#fff":"var(--text-muted)",fontSize:12.5,fontWeight:isToday?700:600,textAlign:"center",marginBottom:6}}>
              {SHORT[day]}
              {isToday&&<div style={{fontSize:9,fontWeight:400,opacity:0.85,marginTop:1}}>Today</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {dayClasses.map(c=>(
                <ClassCard key={c.id} c={c} onEdit={entry=>{setEditEntry(entry);setShowModal(true);}} onDelete={handleDelete}/>
              ))}
              {dayClasses.length===0&&(
                <div style={{minHeight:60,borderRadius:8,border:"1.5px dashed var(--card-border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,color:"var(--text-faint)"}}>No class</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{animation:"fadeIn 0.3s ease",maxWidth:1100}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"var(--text-primary)",margin:0,display:"flex",alignItems:"center",gap:8}}><IcoCalendar/> My Schedule</h1>
          <p style={{fontSize:13.5,color:"var(--text-muted)",margin:"4px 0 0"}}>{schedules.length>0?`${schedules.length} class${schedules.length!==1?"es":""} scheduled`:"No schedule yet"}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{display:"none"}}/>
          <button onClick={()=>fileRef.current?.click()} disabled={uploading||extracting} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:10,border:"1.5px solid var(--card-border)",background:"var(--card-bg)",color:"var(--text-secondary)",fontSize:13,cursor:"pointer",opacity:uploading||extracting?0.7:1}}>
            <IcoUpload/> {uploading?"Uploading…":extracting?"Reading file…":"Upload file"}
          </button>
          <button onClick={()=>{setEditEntry(null);setShowModal(true);}} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderRadius:10,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            <IcoPlus/> Add class
          </button>
        </div>
      </div>

      {error&&(
        <div style={{background:"#fee2e2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",color:"#b91c1c",fontSize:13,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {error}<button onClick={()=>setError("")} style={{background:"none",border:"none",color:"#b91c1c",cursor:"pointer",fontSize:16}}>✕</button>
        </div>
      )}

      {/* Today banner */}
      {!loading&&(
        <div style={{background:todayClasses.length>0?"var(--green-700)":"var(--bg-tertiary)",borderRadius:14,padding:"14px 18px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:todayClasses.length>0?"rgba(255,255,255,0.7)":"var(--text-muted)",marginBottom:2}}>{todayName} — Today</div>
            <div style={{fontSize:15,fontWeight:700,color:todayClasses.length>0?"#fff":"var(--text-secondary)"}}>
              {todayClasses.length===0?"🎉 No classes today":`${todayClasses.length} class${todayClasses.length!==1?"es":""} today`}
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            {currentClass&&(
              <div style={{background:"rgba(255,255,255,0.18)",borderRadius:10,padding:"8px 14px"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:700,marginBottom:2}}>🟢 NOW</div>
                <div style={{fontSize:13,color:"#fff",fontWeight:700}}>{currentClass.course_name}</div>
                {currentClass.room&&<div style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>📍 {currentClass.room}</div>}
                {currentClass.professor&&<div style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>👤 {currentClass.professor}</div>}
              </div>
            )}
            {nextClass&&(
              <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"8px 14px"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",fontWeight:700,marginBottom:2}}>NEXT CLASS</div>
                <div style={{fontSize:13,color:"#fff",fontWeight:700}}>{nextClass.course_name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>in {minsUntilNext>=60?`${Math.floor(minsUntilNext/60)}h ${minsUntilNext%60}m`:`${minsUntilNext}min`}</div>
                {nextClass.room&&<div style={{fontSize:11,color:"rgba(255,255,255,0.65)"}}>📍 {nextClass.room}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Extracted preview */}
      {extracted&&(
        <div style={{background:"var(--card-bg)",border:"2px solid var(--green-600)",borderRadius:14,padding:18,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>✨ Found {extracted.length} classes — review and save</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setExtracted(null)} style={{padding:"6px 14px",borderRadius:8,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:12.5,cursor:"pointer"}}>Discard</button>
              <button onClick={saveExtracted} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"var(--green-700)",color:"#fff",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Save all</button>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid var(--card-border)"}}>
                  {["Course","Day","Time","Room","Professor",""].map(h=>(
                    <th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.4px"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extracted.map((e,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid var(--border-color)",borderLeft:`3px solid ${e.color}`}}>
                    <td style={{padding:"10px 10px"}}>
                      <div style={{fontWeight:600,color:"var(--text-primary)"}}>{e.course_name}</div>
                      {e.course_code&&<div style={{fontSize:11,color:"var(--text-muted)"}}>{e.course_code}</div>}
                    </td>
                    <td style={{padding:"10px 10px",color:"var(--text-secondary)",fontWeight:500}}>{e.day_of_week}</td>
                    <td style={{padding:"10px 10px",color:"var(--text-secondary)",whiteSpace:"nowrap"}}>{fmtTime(e.start_time)} – {fmtTime(e.end_time)}</td>
                    <td style={{padding:"10px 10px",color:"var(--text-muted)"}}>{e.room||"—"}</td>
                    <td style={{padding:"10px 10px",color:"var(--text-muted)"}}>{e.professor||"—"}</td>
                    <td style={{padding:"10px 10px"}}>
                      <button onClick={()=>setExtracted(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer"}}><IcoTrash/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {schedules.length === 0 && !loading ? (
        /* Empty state */
        <div style={{textAlign:"center",padding:"60px 24px",background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)"}}>
          <div style={{fontSize:48,marginBottom:12}}>📅</div>
          <h3 style={{fontSize:17,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>No schedule yet</h3>
          <p style={{fontSize:14,color:"var(--text-muted)",maxWidth:320,margin:"0 auto 20px"}}>Upload your schedule file (PDF, image, Word) or add classes manually.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={()=>fileRef.current?.click()} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:10,border:"1.5px solid var(--card-border)",background:"var(--card-bg)",color:"var(--text-secondary)",fontSize:13.5,cursor:"pointer"}}><IcoUpload/> Upload file</button>
            <button onClick={()=>{setEditEntry(null);setShowModal(true);}} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:10,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}><IcoPlus/> Add class manually</button>
          </div>
        </div>
      ) : (
        <>
          {/* View tabs */}
          <div style={{display:"flex",gap:4,marginBottom:16,background:"var(--bg-tertiary)",borderRadius:10,padding:4,width:"fit-content"}}>
            {[["calendar","📅 Calendar"],["week","🗓 Weekly Grid"]].map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 16px",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",background:tab===t?"var(--card-bg)":"transparent",color:tab===t?"var(--text-primary)":"var(--text-muted)",border:"none",boxShadow:tab===t?"var(--shadow-sm)":"none",transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
              {DAYS.map(d=><div key={d} style={{height:160,borderRadius:10,background:"var(--card-bg)",animation:"pulse-bg 1.5s ease infinite"}}/>)}
            </div>
          ) : tab==="calendar" ? (
            <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16}} className="cal-layout">
              <CalendarView schedules={schedules} deadlines={deadlines}/>

              {/* Sidebar: upcoming deadlines */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {/* Overdue */}
                {overdueDue.length>0&&(
                  <div style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid #fecaca",padding:"14px 16px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.4px"}}>🚨 Overdue</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {overdueDue.map((d,i)=>(
                        <div key={i} style={{padding:"8px 10px",background:"#fff5f5",borderRadius:8,border:"1px solid #fecaca"}}>
                          <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",marginBottom:2}}>{d.title}</div>
                          <div style={{fontSize:11,color:"#dc2626"}}>{d.courseName}</div>
                          <div style={{fontSize:10.5,color:"#dc2626",fontWeight:600,marginTop:2}}>{Math.abs(daysUntil(d.dueDate))}d overdue</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming */}
                <div style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid var(--card-border)",padding:"14px 16px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.4px"}}>📋 Due This Week</div>
                  {upcomingDue.length===0?(
                    <div style={{textAlign:"center",padding:"16px 0",color:"var(--text-muted)",fontSize:13}}>🎉 All caught up!</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {upcomingDue.map((d,i)=>{
                        const diff=daysUntil(d.dueDate);
                        const color=diff===0?"#dc2626":diff===1?"#d97706":"#16a34a";
                        const label=diff===0?"Today":diff===1?"Tomorrow":`${diff}d left`;
                        return(
                          <div key={i} style={{padding:"8px 10px",background:"var(--bg-tertiary)",borderRadius:8,border:"1px solid var(--border-color)"}}>
                            <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",marginBottom:2}}>{d.title}</div>
                            <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:4}}>{d.courseName}</div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <span style={{fontSize:10.5,color:"var(--text-faint)"}}>{fmtDate(d.dueDate)}</span>
                              <span style={{fontSize:10.5,fontWeight:700,color,background:color+"18",padding:"1px 7px",borderRadius:99}}>{label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Today's full schedule */}
                {todayClasses.length>0&&(
                  <div style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid var(--card-border)",padding:"14px 16px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.4px"}}>📚 Today's Classes</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {todayClasses.map((c,i)=>(
                        <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"8px 10px",background:c.color+"0d",borderRadius:8,borderLeft:`3px solid ${c.color}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12.5,fontWeight:600,color:c.color}}>{c.course_name}</div>
                            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:1}}>{fmtTime(c.start_time)} – {fmtTime(c.end_time)}</div>
                            {c.room&&<div style={{fontSize:10.5,color:"var(--text-faint)"}}>📍 {c.room}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : renderWeek()}
        </>
      )}

      {showModal&&<EntryModal entry={editEntry} onSave={handleSave} onClose={()=>{setShowModal(false);setEditEntry(null);}}/>}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
        @keyframes pulse-bg { 0%,100%{opacity:1}50%{opacity:0.5} }
        @media (max-width: 900px) { .cal-layout { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
