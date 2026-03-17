import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout({ role }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const userRole = role || user?.role || "student";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar takes 64px collapsed, 220px expanded — but we always reserve 64px */}
      <div style={{ width: 64, flexShrink: 0 }} className="sidebar-spacer" />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        role={userRole}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header onMenuClick={() => setSidebarOpen(true)} role={userRole} />
        <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }} className="page-main">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-spacer { display: none !important; }
          .page-main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
