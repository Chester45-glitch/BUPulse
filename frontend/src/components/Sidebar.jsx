import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to:"/dashboard", icon:"⊞", label:"Dashboard" },
  { to:"/announcements", icon:"📢", label:"Announcements" },
  { to:"/ask-pulsbot", icon:"💬", label:"Ask PulsBot" },
];

const initials = (name="") => {
  const p = name.trim().split(" ");
  return p.length>=2 ? `${p[0][0]}${p[p.length-1][0]}`.toUpperCase() : name.slice(0,2).toUpperCase();
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace:true });
  };

  return (
    <aside style={{ width:"var(--sidebar-width)", height:"100vh", position:"fixed", left:0, top:0, background:"var(--green-900)", display:"flex", flexDirection:"column", borderRight:"1px solid rgba(255,255,255,0.06)" }}>
      
      {/* Logo */}
      <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg, var(--accent-gold), var(--accent-amber))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>📚</div>
          <span style={{ fontFamily:"var(--font-display)", color:"var(--white)", fontSize:19 }}>BUPulse</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"16px 12px" }}>
        <p style={{ color:"rgba(168,197,160,0.5)", fontSize:10.5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", padding:"0 8px", marginBottom:8 }}>Navigation</p>

        {navItems.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} style={{ display:"block", marginBottom:2 }}>
            {({ isActive }) => (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:"var(--radius-md)", background:isActive?"rgba(255,255,255,0.1)":"transparent", color:isActive?"var(--white)":"var(--green-200)", fontSize:14, fontWeight:isActive?600:400, transition:"all 0.15s" }}>
                <span style={{ fontSize:15, width:20, textAlign:"center" }}>{icon}</span>
                {label}
              </div>
            )}
          </NavLink>
        ))}

        <p style={{ color:"rgba(168,197,160,0.5)", fontSize:10.5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", padding:"0 8px", margin:"20px 0 8px" }}>Account</p>

        <div onClick={handleLogout} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:"var(--radius-md)", color:"var(--green-200)", fontSize:14, cursor:"pointer" }}>
          <span style={{ fontSize:15, width:20, textAlign:"center" }}>🚪</span>
          Logout
        </div>
      </nav>

      {/* User */}
      <div style={{ padding:"14px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10 }}>
        {user?.picture
          ? <img src={user.picture} alt={user.name} style={{ width:34, height:34, borderRadius:"50%" }} />
          : <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg, var(--green-600), var(--green-700))", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--white)", fontSize:13, fontWeight:700 }}>{user ? initials(user.name) : "?"}</div>
        }
        <div>
          <div style={{ color:"var(--white)", fontSize:13, fontWeight:600 }}>{user?.name || "User"}</div>
          <div style={{ color:"var(--green-200)", fontSize:11 }}>Student</div>
        </div>
      </div>
    </aside>
  );
}
