import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

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
const IcoAlert    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

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

// ── Class card in week grid ──────────────────────────────────────
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

// ── Day popup (shows all items when clicking +N more) ────────────
function DayPopup({ day, month, year, classes, dues, onClose }) {
  const date = new Date(year, month, day);
  const label = date.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric"});
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"var(--card-bg)",borderRadius:16,padding:20,width:"100%",maxWidth:340,boxShadow:"var(--shadow-xl)",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",margin:0}}>{label}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,color:"var(--text-muted)",cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        {classes.length>0&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:8}}>Classes</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {classes.map((c,i)=>(
                <div key={i} style={{background:c.color+"12",borderLeft:`3px solid ${c.color}`,borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:c.color}}>{c.course_name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{fmtTime(c.start_time)} – {fmtTime(c.end_time)}</div>
                  {c.room&&<div style={{fontSize:11,color:"var(--text-muted)"}}>📍 {c.room}</div>}
                  {c.professor&&<div style={{fontSize:11,color:"var(--text-muted)"}}>👤 {c.professor}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {dues.length>0&&(
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:8}}>Deadlines</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {dues.map((d,i)=>(
                <div key={i} style={{background:"#fff5f5",borderLeft:"3px solid #dc2626",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{d.title}</div>
                  <div style={{fontSize:11,color:"#dc2626"}}>{d.courseName}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar Month View ─────────────────────────────────────────
function CalendarView({ schedules, deadlines, onJumpToDate, jumpTarget }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => {
    // If there's a jumpTarget, start on that month
    if (jumpTarget) return new Date(jumpTarget.getFullYear(), jumpTarget.getMonth(), 1);
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [popup, setPopup] = useState(null); // {day, classes, dues}

  // When jumpTarget changes, navigate to that month
  useEffect(() => {
    if (jumpTarget) {
      setViewDate(new Date(jumpTarget.getFullYear(), jumpTarget.getMonth(), 1));
    }
  }, [jumpTarget]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-PH",{month:"long",year:"numeric"});

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const scheduleByDay = {};
  schedules.forEach(s => {
    if (!scheduleByDay[s.day_of_week]) scheduleByDay[s.day_of_week] = [];
    scheduleByDay[s.day_of_week].push(s);
  });

  const deadlineByDate = {};
  (deadlines||[]).forEach(d => {
    const key = new Date(d.dueDate).toISOString().split("T")[0];
    if (!deadlineByDate[key]) deadlineByDate[key] = [];
    deadlineByDate[key].push(d);
  });

  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const isJumpDay = (day) => jumpTarget &&
    jumpTarget.getDate()===day &&
    jumpTarget.getMonth()===month &&
    jumpTarget.getFullYear()===year;

  return (
    <>
      <div style={{background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)",overflow:"hidden",boxShadow:"var(--shadow-sm)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid var(--card-border)"}}>
          <button onClick={()=>setViewDate(new Date(year,month-1,1))} style={{width:30,height:30,borderRadius:7,border:"1px solid var(--card-border)",background:"var(--bg-tertiary)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}><IcoChevL/></button>
          <h3 style={{fontSize:15,fontWeight:700,color:"var(--text-primary)",margin:0}}>{monthName}</h3>
          <button onClick={()=>setViewDate(new Date(year,month+1,1))} style={{width:30,height:30,borderRadius:7,border:"1px solid var(--card-border)",background:"var(--bg-tertiary)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted)"}}><IcoChevR/></button>
        </div>

        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--card-border)"}}>
          {DAY_NAMES.map(d=>(
            <div key={d} style={{padding:"6px 2px",textAlign:"center",fontSize:10,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.3px"}}>
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((day,i) => {
            if (!day) return (
              <div key={`e${i}`} style={{minHeight:80,borderRight:"1px solid var(--border-color)",borderBottom:"1px solid var(--border-color)",background:"var(--bg-primary)",opacity:0.3}}/>
            );

            const dateObj = new Date(year, month, day);
            const dayName = DAY_FULL[dateObj.getDay()];
            const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday = today.getDate()===day && today.getMonth()===month && today.getFullYear()===year;
            const isPast  = dateObj < new Date(today.getFullYear(),today.getMonth(),today.getDate());
            const isJump  = isJumpDay(day);
            const classes = scheduleByDay[dayName] || [];
            const dues    = deadlineByDate[dateKey] || [];
            const total   = classes.length + dues.length;

            // Show max 1 chip + "+N more" to always fit
            const MAX_SHOW = 1;
            const overflow = total - MAX_SHOW;
            const showChips = [...classes.slice(0,MAX_SHOW)];

            return (
              <div key={day}
                onClick={() => total > 0 && setPopup({day, classes, dues})}
                style={{
                  minHeight:80,
                  borderRight:"1px solid var(--border-color)",
                  borderBottom:"1px solid var(--border-color)",
                  padding:"3px",
                  background: isJump ? "rgba(59,130,246,0.08)" : isToday ? "rgba(22,163,74,0.05)" : "transparent",
                  opacity: isPast ? 0.6 : 1,
                  cursor: total > 0 ? "pointer" : "default",
                  outline: isJump ? "2px solid #3b82f6" : "none",
                  outlineOffset: -1,
                  boxSizing: "border-box",
                }}
              >
                {/* Day number */}
                <div style={{
                  width:22,height:22,borderRadius:"50%",
                  background: isJump ? "#3b82f6" : isToday ? "var(--green-700)" : "transparent",
                  color: (isJump||isToday) ? "#fff" : "var(--text-muted)",
                  fontSize:11,fontWeight:(isToday||isJump)?700:400,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  marginBottom:2,flexShrink:0,
                }}>{day}</div>

                {/* Show first class chip */}
                {showChips.map((c,ci)=>(
                  <div key={ci} style={{
                    background:c.color,color:"#fff",
                    borderRadius:3,padding:"1px 4px",
                    fontSize:9,fontWeight:600,
                    marginBottom:1,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    lineHeight:1.5,
                  }}>
                    {c.course_name.length>10 ? c.course_name.slice(0,9)+"…" : c.course_name}
                  </div>
                ))}

                {/* Show deadline dot if any */}
                {dues.length>0 && classes.length===0 && (
                  <div style={{
                    background:"#fee2e2",color:"#dc2626",
                    borderRadius:3,padding:"1px 4px",
                    fontSize:9,fontWeight:600,
                    marginBottom:1,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    lineHeight:1.5,
                  }}>
                    📋 {dues[0].title.length>8 ? dues[0].title.slice(0,7)+"…" : dues[0].title}
                  </div>
                )}

                {/* +N more — always visible */}
                {total > MAX_SHOW && (
                  <div style={{
                    fontSize:9,fontWeight:700,
                    color:"var(--card-bg)",
                    background:"var(--text-muted)",
                    borderRadius:3,padding:"1px 4px",
                    lineHeight:1.5,
                    display:"inline-block",
                  }}>
                    +{total - MAX_SHOW} more
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{padding:"8px 12px",borderTop:"1px solid var(--card-border)",display:"flex",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"var(--text-muted)"}}>
            <div style={{width:8,height:8,borderRadius:2,background:"var(--green-600)"}}/> Class
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"var(--text-muted)"}}>
            <div style={{width:8,height:8,borderRadius:2,background:"#fee2e2",border:"1px solid #fecaca"}}/> Deadline
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"var(--text-muted)"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#3b82f6"}}/> Jumped to
          </div>
          <span style={{fontSize:10,color:"var(--text-muted)",marginLeft:"auto"}}>Tap a date to see details</span>
        </div>
      </div>

      {popup && (
        <DayPopup
          day={popup.day} month={month} year={year}
          classes={popup.classes} dues={popup.dues}
          onClose={()=>setPopup(null)}
        />
      )}
    </>
  );
}

// ── Activities Panel (below calendar) ─────────────────────────
function ActivitiesPanel({ overdueDue, upcomingDue, jumpToDate }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}} className="activities-panel">
      {/* Overdue */}
      <div style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid #fecaca",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #fecaca",display:"flex",alignItems:"center",gap:6}}>
          <IcoAlert/>
          <span style={{fontSize:12,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:"0.4px"}}>Overdue</span>
          {overdueDue.length>0&&<span style={{marginLeft:"auto",fontSize:10,fontWeight:700,background:"#dc2626",color:"#fff",borderRadius:99,padding:"1px 6px"}}>{overdueDue.length}</span>}
        </div>
        <div style={{maxHeight:220,overflowY:"auto"}}>
          {overdueDue.length===0?(
            <div style={{padding:"16px",textAlign:"center",color:"var(--text-muted)",fontSize:13}}>🎉 No overdue!</div>
          ):overdueDue.map((d,i)=>(
            <div key={i} onClick={()=>jumpToDate(d.dueDate)}
              style={{padding:"10px 14px",borderBottom:"1px solid var(--border-color)",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(220,38,38,0.04)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",marginBottom:1}}>{d.title}</div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:3}}>{d.courseName}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:10,color:"var(--text-faint)"}}>{fmtDate(d.dueDate)}</span>
                <span style={{fontSize:10,fontWeight:700,color:"#dc2626",background:"#fee2e2",padding:"1px 6px",borderRadius:99}}>{Math.abs(daysUntil(d.dueDate))}d overdue</span>
              </div>
              <span style={{fontSize:9.5,color:"#3b82f6",marginTop:2,display:"block"}}>📅 Tap to view on calendar</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div style={{background:"var(--card-bg)",borderRadius:14,border:"1px solid var(--card-border)",overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid var(--card-border)",display:"flex",alignItems:"center",gap:6}}>
          <IcoCalendar/>
          <span style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.4px"}}>Upcoming (14d)</span>
          {upcomingDue.length>0&&<span style={{marginLeft:"auto",fontSize:10,fontWeight:700,background:"var(--green-700)",color:"#fff",borderRadius:99,padding:"1px 6px"}}>{upcomingDue.length}</span>}
        </div>
        <div style={{maxHeight:220,overflowY:"auto"}}>
          {upcomingDue.length===0?(
            <div style={{padding:"16px",textAlign:"center",color:"var(--text-muted)",fontSize:13}}>🎉 All caught up!</div>
          ):upcomingDue.map((d,i)=>{
            const diff=daysUntil(d.dueDate);
            const color=diff===0?"#dc2626":diff<=2?"#d97706":"#16a34a";
            const label=diff===0?"Today":diff===1?"Tomorrow":`${diff}d left`;
            return(
              <div key={i} onClick={()=>jumpToDate(d.dueDate)}
                style={{padding:"10px 14px",borderBottom:"1px solid var(--border-color)",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(22,163,74,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{fontSize:12.5,fontWeight:600,color:"var(--text-primary)",marginBottom:1}}>{d.title}</div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:3}}>{d.courseName}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:10,color:"var(--text-faint)"}}>{fmtDate(d.dueDate)}</span>
                  <span style={{fontSize:10,fontWeight:700,color,background:color+"18",padding:"1px 6px",borderRadius:99}}>{label}</span>
                </div>
                <span style={{fontSize:9.5,color:"#3b82f6",marginTop:2,display:"block"}}>📅 Tap to view on calendar</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Schedule Page ─────────────────────────────────────────────
export default function Schedule() {
  const { user } = useAuth();
  const [schedules, setSchedules]   = useState([]);
  const [deadlines, setDeadlines]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("calendar");
  const [showModal, setShowModal]   = useState(false);
  const [editEntry, setEditEntry]   = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted]   = useState(null);
  const [error, setError]           = useState("");
  const [jumpTarget, setJumpTarget] = useState(null); // Date to highlight on calendar
  const fileRef = useRef(null);

  const todayName = DAYS[new Date().getDay()];

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
  useEffect(()=>{ load(); },[]);

  const nowMins = new Date().getHours()*60+new Date().getMinutes();
  const todayClasses = schedules.filter(s=>s.day_of_week===todayName).sort((a,b)=>timeToMins(a.start_time)-timeToMins(b.start_time));
  const currentClass = todayClasses.find(c=>timeToMins(c.start_time)<=nowMins&&timeToMins(c.end_time)>nowMins);
  const nextClass    = todayClasses.find(c=>timeToMins(c.start_time)>nowMins);
  const minsUntilNext = nextClass ? timeToMins(nextClass.start_time)-nowMins : null;

  const now = new Date();
  const overdueDue  = deadlines.filter(d=>daysUntil(d.dueDate)<0).sort((a,b)=>new Date(b.dueDate)-new Date(a.dueDate));
  const upcomingDue = deadlines.filter(d=>{ const diff=daysUntil(d.dueDate); return diff>=0&&diff<=14; }).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));

  // Jump to a deadline's date on the calendar
  const jumpToDate = (dueDate) => {
    setTab("calendar");
    setJumpTarget(new Date(dueDate));
    // Auto-clear highlight after 3s
    setTimeout(()=>setJumpTarget(null), 3000);
  };

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

  const renderWeek = () => (
    <div className="schedule-week-grid" style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,overflowX:"auto"}}>
      {DAYS.map(day=>{
        const dayClasses=schedules.filter(s=>s.day_of_week===day).sort((a,b)=>timeToMins(a.start_time)-timeToMins(b.start_time));
        const isToday=day===todayName;
        return(
          <div key={day} style={{minWidth:100}}>
            <div style={{padding:"8px 6px",borderRadius:"10px 10px 0 0",background:isToday?"var(--green-700)":"var(--bg-tertiary)",color:isToday?"#fff":"var(--text-muted)",fontSize:12,fontWeight:isToday?700:600,textAlign:"center",marginBottom:6}}>
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
    <div style={{animation:"fadeIn 0.3s ease",maxWidth:1000}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"var(--text-primary)",margin:0,display:"flex",alignItems:"center",gap:8}}><IcoCalendar/> My Schedule</h1>
          <p style={{fontSize:13,color:"var(--text-muted)",margin:"4px 0 0"}}>{schedules.length>0?`${schedules.length} class${schedules.length!==1?"es":""} scheduled`:"No schedule yet"}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{display:"none"}}/>
          <button onClick={()=>fileRef.current?.click()} disabled={uploading||extracting} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,border:"1.5px solid var(--card-border)",background:"var(--card-bg)",color:"var(--text-secondary)",fontSize:13,cursor:"pointer",opacity:uploading||extracting?0.7:1}}>
            <IcoUpload/> {uploading?"Uploading…":extracting?"Reading…":"Upload"}
          </button>
          <button onClick={()=>{setEditEntry(null);setShowModal(true);}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
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
        <div style={{background:todayClasses.length>0?"var(--green-700)":"var(--bg-tertiary)",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:todayClasses.length>0?"rgba(255,255,255,0.7)":"var(--text-muted)",marginBottom:2}}>{todayName} — Today</div>
            <div style={{fontSize:14,fontWeight:700,color:todayClasses.length>0?"#fff":"var(--text-secondary)"}}>
              {todayClasses.length===0?"🎉 No classes today":`${todayClasses.length} class${todayClasses.length!==1?"es":""} today`}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {currentClass&&(
              <div style={{background:"rgba(255,255,255,0.18)",borderRadius:9,padding:"6px 12px"}}>
                <div style={{fontSize:9.5,color:"rgba(255,255,255,0.7)",fontWeight:700,marginBottom:1}}>🟢 NOW</div>
                <div style={{fontSize:12,color:"#fff",fontWeight:700}}>{currentClass.course_name}</div>
                {currentClass.room&&<div style={{fontSize:10,color:"rgba(255,255,255,0.75)"}}>📍 {currentClass.room}</div>}
              </div>
            )}
            {nextClass&&(
              <div style={{background:"rgba(255,255,255,0.12)",borderRadius:9,padding:"6px 12px"}}>
                <div style={{fontSize:9.5,color:"rgba(255,255,255,0.65)",fontWeight:700,marginBottom:1}}>NEXT</div>
                <div style={{fontSize:12,color:"#fff",fontWeight:700}}>{nextClass.course_name}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.75)"}}>in {minsUntilNext>=60?`${Math.floor(minsUntilNext/60)}h ${minsUntilNext%60}m`:`${minsUntilNext}min`}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Extracted preview */}
      {extracted&&(
        <div style={{background:"var(--card-bg)",border:"2px solid var(--green-600)",borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>✨ Found {extracted.length} classes — review and save</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setExtracted(null)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--card-border)",background:"transparent",color:"var(--text-muted)",fontSize:12.5,cursor:"pointer"}}>Discard</button>
              <button onClick={saveExtracted} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"var(--green-700)",color:"#fff",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Save all</button>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:"1px solid var(--card-border)"}}>
                  {["Course","Day","Time","Room","Professor",""].map(h=>(
                    <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:10,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extracted.map((e,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid var(--border-color)",borderLeft:`3px solid ${e.color}`}}>
                    <td style={{padding:"8px 8px"}}>
                      <div style={{fontWeight:600,color:"var(--text-primary)"}}>{e.course_name}</div>
                      {e.course_code&&<div style={{fontSize:10,color:"var(--text-muted)"}}>{e.course_code}</div>}
                    </td>
                    <td style={{padding:"8px 8px",color:"var(--text-secondary)",fontWeight:500}}>{e.day_of_week}</td>
                    <td style={{padding:"8px 8px",color:"var(--text-secondary)",whiteSpace:"nowrap"}}>{fmtTime(e.start_time)} – {fmtTime(e.end_time)}</td>
                    <td style={{padding:"8px 8px",color:"var(--text-muted)"}}>{e.room||"—"}</td>
                    <td style={{padding:"8px 8px",color:"var(--text-muted)"}}>{e.professor||"—"}</td>
                    <td style={{padding:"8px 8px"}}><button onClick={()=>setExtracted(prev=>prev.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer"}}><IcoTrash/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {schedules.length === 0 && !loading ? (
        <div style={{textAlign:"center",padding:"60px 24px",background:"var(--card-bg)",borderRadius:16,border:"1px solid var(--card-border)"}}>
          <div style={{fontSize:48,marginBottom:12}}>📅</div>
          <h3 style={{fontSize:17,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>No schedule yet</h3>
          <p style={{fontSize:14,color:"var(--text-muted)",maxWidth:320,margin:"0 auto 20px"}}>Upload your schedule file or add classes manually.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>fileRef.current?.click()} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:10,border:"1.5px solid var(--card-border)",background:"var(--card-bg)",color:"var(--text-secondary)",fontSize:13.5,cursor:"pointer"}}><IcoUpload/> Upload file</button>
            <button onClick={()=>{setEditEntry(null);setShowModal(true);}} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:10,border:"none",background:"var(--green-700)",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer"}}><IcoPlus/> Add manually</button>
          </div>
        </div>
      ) : (
        <>
          {/* View tabs */}
          <div style={{display:"flex",gap:4,marginBottom:14,background:"var(--bg-tertiary)",borderRadius:10,padding:4,width:"fit-content"}}>
            {[["calendar","📅 Calendar"],["week","🗓 Weekly"]].map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer",background:tab===t?"var(--card-bg)":"transparent",color:tab===t?"var(--text-primary)":"var(--text-muted)",border:"none",boxShadow:tab===t?"var(--shadow-sm)":"none",transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{height:300,borderRadius:14,background:"var(--card-bg)",animation:"pulse-bg 1.5s ease infinite"}}/>
          ) : tab==="calendar" ? (
            <>
              {/* Full-width calendar */}
              <CalendarView schedules={schedules} deadlines={deadlines} onJumpToDate={jumpToDate} jumpTarget={jumpTarget}/>
              {/* Activities panel BELOW calendar */}
              <ActivitiesPanel overdueDue={overdueDue} upcomingDue={upcomingDue} jumpToDate={jumpToDate}/>
            </>
          ) : renderWeek()}
        </>
      )}

      {showModal&&<EntryModal entry={editEntry} onSave={handleSave} onClose={()=>{setShowModal(false);setEditEntry(null);}}/>}

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} }
        @keyframes pulse-bg { 0%,100%{opacity:1}50%{opacity:0.5} }
        @media (max-width: 600px) {
          .activities-panel { grid-template-columns: 1fr !important; }
          .schedule-week-grid { min-width: 700px; }
        }
      `}</style>
    </div>
  );
}
