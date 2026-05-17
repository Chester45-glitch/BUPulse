import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../utils/api";

const TITLES = {
  "/dashboard": "Dashboard", "/announcements": "Announcements",
  "/ask-pulsbot": "PulsBot", "/profile": "My Profile",
  "/enrolled-classes": "Enrolled Classes", "/pending-activities": "Pending Activities",
  "/schedule": "My Schedule", "/attendance": "Attendance",
  "/professor": "Dashboard", "/professor/announcements": "Announcements",
  "/professor/classes": "My Classes", "/professor/ask-pulsbot": "PulsBot",
  "/professor/profile": "My Profile", "/professor/schedule": "My Schedule",
  "/professor/attendance": "Attendance",
  "/parent": "Dashboard", "/parent/ask-pulsbot": "PulsBot", "/parent/profile": "My Profile",
};

const initials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length-1][0]}`.toUpperCase() : name.slice(0,2).toUpperCase();
};

const IcoProfile  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoClasses  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const IcoChat     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoClock    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoFeedback = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>;
const IcoLogout   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoMoon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
const IcoSun      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;

export default function Header({ onMenuClick, role = "student" }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const dropRef  = useRef(null);

  const [dropOpen,     setDropOpen]     = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbCategory,   setFbCategory]   = useState("general");
  const [fbMessage,    setFbMessage]    = useState("");
  const [fbSending,    setFbSending]    = useState(false);
  const [fbDone,       setFbDone]       = useState(false);
  const [fbError,      setFbError]      = useState("");

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => { setDropOpen(false); await logout(); navigate("/", { replace: true }); };

  const closeFeedback = () => {
    setShowFeedback(false); setFbError(""); setFbDone(false);
    setFbMessage(""); setFbCategory("general");
  };

  const handleFeedbackSubmit = async () => {
    if (!fbMessage.trim()) { setFbError("Please enter your feedback."); return; }
    setFbSending(true); setFbError("");
    try {
      await api.post("/feedback", { category: fbCategory, message: fbMessage.trim() });
      setFbDone(true);
      setTimeout(closeFeedback, 2800);
    } catch (err) {
      setFbError(err.response?.data?.error || "Failed to send. Please try again.");
    } finally { setFbSending(false); }
  };

  const menuItems = role === "professor"
    ? [
        { Icon: IcoProfile, label: "Profile",    path: "/professor/profile" },
        { Icon: IcoClasses, label: "My Classes", path: "/professor/classes" },
        { Icon: IcoChat,    label: "PulsBot",    path: "/professor/ask-pulsbot" },
      ]
    : role === "parent"
    ? [
        { Icon: IcoProfile, label: "Profile", path: "/parent/profile" },
        { Icon: IcoChat,    label: "PulsBot", path: "/parent/ask-pulsbot" },
      ]
    : [
        { Icon: IcoProfile, label: "Profile",            path: "/profile" },
        { Icon: IcoClasses, label: "Enrolled Classes",   path: "/enrolled-classes" },
        { Icon: IcoClock,   label: "Pending Activities", path: "/pending-activities" },
      ];

  const menuBtnStyle = {
    width: "100%", display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px", borderRadius: 8, color: "var(--text-secondary)",
    fontSize: 13.5, cursor: "pointer", background: "none", border: "none", textAlign: "left",
  };

  return (
    <>
      <header style={{
        height: "var(--header-height)", background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
        display: "flex", alignItems: "center", padding: "0 20px",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onMenuClick} className="hamburger" style={{ display: "none", flexDirection: "column", gap: 5, padding: 6, borderRadius: 6, background: "none", border: "none", cursor: "pointer" }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 20, height: 2, background: "var(--text-secondary)", borderRadius: 2 }} />)}
          </button>
          <div className="mobile-logo" style={{ display: "none", alignItems: "center", gap: 8 }}>
            <img src="/Logo.png" alt="BUPulse" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>BUPulse</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
            {TITLES[pathname] || "BUPulse"}
          </h1>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-tertiary)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {dark ? <IcoSun /> : <IcoMoon />}
          </button>

          <div ref={dropRef} style={{ position: "relative" }}>
            {/* Avatar button */}
            <button onClick={() => setDropOpen(p => !p)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 4px", borderRadius: 99, border: "1px solid var(--border-color)", background: "var(--card-bg)", cursor: "pointer" }}>
              {user?.picture
                ? <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
                : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--card-bg)", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{user ? initials(user.name) : "?"}</div>
              }
              <span className="user-name" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name?.split(" ")[0] || "User"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Dropdown */}
            {dropOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: 12, boxShadow: "var(--shadow-xl)", minWidth: 210, overflow: "hidden", animation: "dropIn 0.15s ease", zIndex: 100 }}>
                {/* User info */}
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {user?.picture
                      ? <img src={user.picture} alt={user.name} style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
                      : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--card-bg)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{user ? initials(user.name) : "?"}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "capitalize", marginTop: 1 }}>{role}</div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div style={{ padding: "4px" }}>
                  {menuItems.map(item => (
                    <button key={item.path} onClick={() => { navigate(item.path); setDropOpen(false); }}
                      style={menuBtnStyle}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-tertiary)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <span style={{ color: "var(--text-muted)", display: "flex" }}><item.Icon /></span>
                      {item.label}
                    </button>
                  ))}

                  <div style={{ height: 1, background: "var(--border-color)", margin: "4px 0" }} />

                  {/* Feedback */}
                  <button
                    onClick={() => { setDropOpen(false); setShowFeedback(true); }}
                    style={menuBtnStyle}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-tertiary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <span style={{ color: "var(--text-muted)", display: "flex" }}><IcoFeedback /></span>
                    Feedback
                  </button>

                  <div style={{ height: 1, background: "var(--border-color)", margin: "4px 0" }} />

                  {/* Logout */}
                  <button onClick={handleLogout}
                    style={{ ...menuBtnStyle, color: "#dc2626" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fff5f5"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <span style={{ display: "flex" }}><IcoLogout /></span>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes dropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
          @keyframes spin   { to { transform:rotate(360deg); } }
          @media (max-width: 768px) {
            .hamburger   { display: flex !important; }
            .mobile-logo { display: flex !important; }
            .page-title  { display: none !important; }
            .user-name   { display: none !important; }
          }
        `}</style>
      </header>

      {/* ── Feedback Modal ──────────────────────────────────────── */}
      {showFeedback && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:200,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"var(--card-bg)", borderRadius:18, padding:28, width:"100%", maxWidth:460,
            boxShadow:"0 24px 60px rgba(0,0,0,0.25)", animation:"dropIn 0.18s ease" }}>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <h3 style={{ fontSize:17, fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>Send Feedback</h3>
                <p style={{ fontSize:12.5, color:"var(--text-muted)" }}>Your message goes directly to the BUPulse developer</p>
              </div>
              <button onClick={closeFeedback} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:20, lineHeight:1, flexShrink:0, marginLeft:12 }}>✕</button>
            </div>

            {fbDone ? (
              <div style={{ textAlign:"center", padding:"28px 0" }}>
                <div style={{ fontSize:44, marginBottom:14 }}>🎉</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#16a34a", marginBottom:8 }}>Thank you!</div>
                <div style={{ fontSize:13.5, color:"var(--text-muted)", lineHeight:1.6 }}>
                  Your feedback has been sent to the BUPulse team. We appreciate you!
                </div>
              </div>
            ) : (
              <>
                {/* Category pills */}
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:8 }}>Category</label>
                  <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                    {[
                      { val:"bug",        label:"🐛 Bug Report" },
                      { val:"suggestion", label:"💡 Suggestion"  },
                      { val:"praise",     label:"🌟 Praise"      },
                      { val:"general",    label:"💬 General"     },
                    ].map(({ val, label }) => {
                      const active = fbCategory === val;
                      return (
                        <button key={val} onClick={() => setFbCategory(val)} style={{
                          padding:"5px 13px", borderRadius:99, fontSize:12.5, fontWeight:active?700:400,
                          border:`1.5px solid ${active?"#2563eb":"var(--border-color)"}`,
                          background:active?"rgba(37,99,235,0.1)":"transparent",
                          color:active?"#2563eb":"var(--text-muted)", cursor:"pointer", transition:"all 0.12s",
                        }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:8 }}>Your feedback *</label>
                  <textarea
                    value={fbMessage}
                    onChange={e => setFbMessage(e.target.value)}
                    placeholder="Describe your experience, report a bug, or share a suggestion…"
                    rows={5}
                    style={{ width:"100%", padding:"10px 12px", border:"1.5px solid var(--card-border)",
                      borderRadius:10, background:"var(--input-bg)", color:"var(--text-primary)",
                      fontSize:13.5, outline:"none", resize:"vertical", fontFamily:"inherit",
                      lineHeight:1.6, boxSizing:"border-box" }}
                  />
                </div>

                {fbError && <div style={{ color:"#dc2626", fontSize:12.5, marginBottom:12 }}>{fbError}</div>}

                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button onClick={closeFeedback} style={{ padding:"9px 18px", borderRadius:10, border:"1px solid var(--card-border)", background:"transparent", color:"var(--text-secondary)", fontSize:14, cursor:"pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleFeedbackSubmit} disabled={fbSending} style={{ padding:"9px 22px", borderRadius:10, border:"none", background:fbSending?"#9ca3af":"#2563eb", color:"#fff", fontWeight:600, fontSize:14, cursor:fbSending?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8 }}>
                    {fbSending && <div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.75s linear infinite" }}/>}
                    {fbSending ? "Sending…" : "Send Feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
