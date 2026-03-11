import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Announcements from "./pages/Announcements";
import AskPulsBot from "./pages/AskPulsBot";
import AuthCallback from "./pages/AuthCallback";
import Layout from "./components/Layout";

const Spinner = () => (
  <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--green-900)", flexDirection:"column", gap:16 }}>
    <div style={{ width:48, height:48, border:"3px solid rgba(255,255,255,0.2)", borderTopColor:"var(--accent-gold)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    <p style={{ color:"var(--green-200)", fontFamily:"var(--font-body)" }}>Loading BUPulse...</p>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/" replace />;
};

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="ask-pulsbot" element={<AskPulsBot />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
