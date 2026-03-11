import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TITLES = { "/dashboard":"Dashboard", "/announcements":"Announcements", "/ask-pulsbot":"Ask PulsBot" };

const initials = (name="") => {
  const p = name.trim().split(" ");
  return p.length>=2 ? `${p[0][0]}${p[p.length-1][0]}`.toUpperCase() : name.slice(0,2).toUpperCase();
};

export default function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <header style={{ height:"var(--header-height)", background:"var(--white)", borderBottom:"1px solid var(--gray-200)", display:"flex", alignItems:"center", padding:"0 32px", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
      <h1 style={{ fontSize:18, fontWeight:600 }}>{TITLES[pathname] || "BUPulse"}</h1>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px 6px 6px", borderRadius:"var(--radius-xl)", border:"1px solid var(--gray-200)", background:"var(--white)" }}>
          {user?.picture
            ? <img src={user.picture} alt={user.name} style={{ width:26, height:26, borderRadius:"50%" }} />
            : <div style={{ width:26, height:26, borderRadius:"50%", background:"var(--green-700)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--white)", fontSize:11, fontWeight:700 }}>{user ? initials(user.name) : "?"}</div>
          }
          <span style={{ fontSize:13, fontWeight:500, color:"var(--gray-700)" }}>{user?.name || "User"}</span>
        </div>
      </div>
    </header>
  );
}
