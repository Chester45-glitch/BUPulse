import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Announcements from "./pages/Announcements";
import AskPulsBot from "./pages/AskPulsBot";
import AuthCallback from "./pages/AuthCallback";
import Profile from "./pages/Profile";
import EnrolledClasses from "./pages/EnrolledClasses";
import PendingActivities from "./pages/PendingActivities";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import Schedule from "./pages/Schedule";
import Attendance from "./pages/Attendance";
import Layout from "./components/Layout";

const Spinner = () => (
  <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f2010", flexDirection: "column", gap: 16 }}>
    <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <p style={{ color: "#a8c5a0", fontFamily: "var(--font-body)" }}>Loading BUPulse...</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "professor") return <Navigate to="/professor" replace />;
    if (user.role === "parent")    return <Navigate to="/parent"    replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const RoleRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "professor") return <Navigate to="/professor" replace />;
  if (user.role === "parent")    return <Navigate to="/parent"    replace />;
  return <Navigate to="/dashboard" replace />;
};

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <RoleRedirect /> : <Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* ── Student routes ─────────────────────────────────────── */}
        <Route path="/" element={<PrivateRoute allowedRoles={["student"]}><Layout /></PrivateRoute>}>
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="announcements"      element={<Announcements />} />
          <Route path="ask-pulsbot"        element={<AskPulsBot />} />
          <Route path="profile"            element={<Profile />} />
          <Route path="enrolled-classes"   element={<EnrolledClasses />} />
          <Route path="pending-activities" element={<PendingActivities />} />
          <Route path="schedule"           element={<Schedule />} />
          <Route path="attendance"         element={<Attendance />} />
        </Route>

        {/* ── Professor routes ────────────────────────────────────── */}
        <Route path="/professor" element={<PrivateRoute allowedRoles={["professor"]}><Layout role="professor" /></PrivateRoute>}>
          <Route index                element={<ProfessorDashboard />} />
          <Route path="announcements" element={<Announcements role="professor" />} />
          <Route path="profile"       element={<Profile />} />
          <Route path="classes"       element={<ProfessorDashboard defaultTab="classes" />} />
          <Route path="ask-pulsbot"   element={<AskPulsBot />} />
          <Route path="schedule"      element={<Schedule />} />
          <Route path="attendance"    element={<Attendance />} />
        </Route>

        {/* ── Parent routes ───────────────────────────────────────── */}
        <Route path="/parent" element={<PrivateRoute allowedRoles={["parent"]}><Layout role="parent" /></PrivateRoute>}>
          <Route index              element={<ParentDashboard />} />
          <Route path="profile"     element={<Profile />} />
          <Route path="ask-pulsbot" element={<AskPulsBot />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
