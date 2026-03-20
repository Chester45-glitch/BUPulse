import { useState, useRef, useEffect } from "react";
import { useSharedChat } from "../hooks/useSharedChat";
import { ChatBubble, TypingIndicator, ChatInput } from "./ChatComponents";
import { useAuth } from "../context/AuthContext";

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconChat = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconExpand = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
  </svg>
);

const SUGGESTIONS = {
  student: ["What's due this week?", "Any overdue work?", "Summarize my announcements"],
  professor: ["List my classes", "Help me write an announcement", "How many students do I have?"],
  parent: ["How is my child doing?", "Any overdue assignments?", "Recent announcements?"],
};

export default function FloatingChatbot() {
  const { user } = useAuth();
  const { messages, loading, send, clearChat } = useSharedChat();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const role = user?.role || "student";
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.student;

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // Count new bot messages when closed
    if (!open && messages[messages.length - 1]?.role === "assistant") {
      setUnread((n) => n + 1);
    }
  }, [messages]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open PulsBot"
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 500, width: 54, height: 54, borderRadius: "50%", background: open ? "#6b7280" : "linear-gradient(135deg,#1a3320,#16a34a)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 20px rgba(22,163,74,0.45)", transition: "all 0.2s ease", transform: open ? "scale(0.92)" : "scale(1)" }}
      >
        {open ? <IconClose /> : <IconChat />}
        {!open && unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div style={{ position: "fixed", bottom: 90, right: 24, zIndex: 499, width: 360, maxHeight: "70vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid var(--card-border)", overflow: "hidden", transform: open ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)", transformOrigin: "bottom right" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1a3320,#1e4d1e)", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💬</div>
            <div>
              <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700 }}>PulsBot</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5 }}>Online</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href="/ask-pulsbot" title="Open full page" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 7, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
              <IconExpand />
            </a>
            <button onClick={clearChat} title="Clear chat" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 7, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.7)" }}>
              <IconTrash />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: 10, background: "var(--bg-tertiary)" }}>
          {messages.map((m, i) => <ChatBubble key={m.id || i} msg={m} />)}
          {loading && <TypingIndicator />}

          {/* Suggestions — only if just the greeting */}
          {messages.length <= 1 && !loading && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => send({ text: s })} style={{ padding: "5px 10px", borderRadius: 99, border: "1.5px solid var(--green-200)", background: "var(--green-50)", color: "var(--green-800)", fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ background: "var(--card-bg)", borderTop: "1px solid var(--card-border)", flexShrink: 0 }}>
          <ChatInput onSend={send} disabled={loading} compact />
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @media (max-width: 480px) { div[style*="360px"]{width:calc(100vw - 32px)!important;right:16px!important} }
      `}</style>
    </>
  );
}
