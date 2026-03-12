import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 40, display: "none",
          }}
          className="mobile-overlay"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{
        marginLeft: "var(--sidebar-width)",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }} className="main-content">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }} className="page-main">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-overlay { display: block !important; }
          .main-content { margin-left: 0 !important; }
          .page-main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
