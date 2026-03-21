import { useState, useRef, useEffect } from "react";
import { useSharedChat } from "../hooks/useSharedChat";
import { ChatInput } from "./ChatComponents";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const IconClose  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconChat   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconExpand = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>;
const IconTrash  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;
const IconBot    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/><circle cx="9" cy="11" r="1" fill="currentColor"/><circle cx="15" cy="11" r="1" fill="currentColor"/></svg>;

const SUGGESTIONS = {
  student:   ["What's due this week?", "Any overdue work?", "Summarize announcements"],
  professor: ["Post an announcement", "Create a quiz", "List my classes"],
  parent:    ["How is my child doing?", "Any overdue work?", "Recent announcements"],
};

const renderContent = (text) => {
  if (!text) return null;
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2,-2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ background:"rgba(0,0,0,0.08)", borderRadius:3, padding:"1px 4px", fontSize:"0.88em", fontFamily:"monospace" }}>{p.slice(1,-1)}</code>;
    if (p === "\n") return <br key={i} />;
    return p;
  });
};

export default function FloatingChatbot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, send, clearChat } = useSharedChat();
  const [open, setOpen]     = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);

  const role = user?.role || "student";
  const pulsbotPath = role === "professor" ? "/professor/ask-pulsbot" : role === "parent" ? "/parent/ask-pulsbot" : "/ask-pulsbot";
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.student;
  const showSuggestions = messages.length <= 1 && !loading;

  useEffect(() => { if (open) setUnread(0); }, [open]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!open && messages[messages.length - 1]?.role === "assistant") setUnread(n => n + 1);
  }, [messages]);

  return (
    <>
      {/* Floating window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, width: 380, height: 560,
          background: "var(--card-bg)", borderRadius: 18,
          border: "1px solid var(--card-border)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column", zIndex: 1000,
          animation: "floatUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--card-border)", background: "linear-gradient(135deg, var(--green-900), var(--green-800))", flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginRight: 10, flexShrink: 0 }}>
              <IconBot />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>PulsBot</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
                Online
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => navigate(pulsbotPath)} title="Open full page"
                style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconExpand />
              </button>
              <button onClick={clearChat} title="Clear chat"
                style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconTrash />
              </button>
              <button onClick={() => setOpen(false)} title="Close"
                style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconClose />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>

            {/* Suggestions */}
            {showSuggestions && (
              <div style={{ padding: "16px 0 8px" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textAlign: "center" }}>Try asking:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send({ text: s })}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: 12.5, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--green-600)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--card-border)"}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isBot = m.role === "assistant";
              return (
                <div key={i} style={{ display: "flex", gap: 8, padding: "8px 0", flexDirection: isBot ? "row" : "row-reverse" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: isBot ? "linear-gradient(135deg,var(--green-800),var(--green-600))" : "var(--bg-tertiary)", border: isBot ? "none" : "1px solid var(--card-border)", display: "flex", alignItems: "center", justifyContent: "center", color: isBot ? "#fff" : "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>
                    {isBot ? <IconBot /> : "👤"}
                  </div>
                  <div style={{ maxWidth: "82%", background: isBot ? "var(--bg-secondary)" : "var(--green-800)", color: isBot ? "var(--text-primary)" : "#fff", borderRadius: isBot ? "4px 12px 12px 12px" : "12px 4px 12px 12px", padding: "9px 12px", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", border: isBot ? "1px solid var(--card-border)" : "none" }}>
                    {renderContent(m.content)}
                    {m.fileUrl && (
                      <a href={m.fileUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, color: isBot ? "var(--green-700)" : "rgba(255,255,255,0.8)", textDecoration: "none" }}>
                        📎 {m.fileName || "Attachment"}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg,var(--green-800),var(--green-600))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                  <IconBot />
                </div>
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--card-border)", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", display: "flex", gap: 4 }}>
                  {[0, 0.18, 0.36].map((d, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", animation: `pulse-dot 1.2s ease-in-out ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: "1px solid var(--card-border)", flexShrink: 0 }}>
            <ChatInput onSend={send} disabled={loading} compact={true} />
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: open ? "var(--bg-tertiary)" : "linear-gradient(135deg, var(--green-800), var(--green-600))",
          border: open ? "1.5px solid var(--card-border)" : "none",
          boxShadow: open ? "var(--shadow-md)" : "0 8px 24px rgba(0,0,0,0.25)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: open ? "var(--text-muted)" : "#fff", zIndex: 1001,
          transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
        {open ? <IconClose /> : <IconChat />}
        {!open && unread > 0 && (
          <div style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "2px solid var(--bg-primary)", fontSize: 10, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread > 9 ? "9+" : unread}
          </div>
        )}
      </button>

      <style>{`
        @keyframes floatUp { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes pulse-dot { 0%,100% { opacity:.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.15); } }
      `}</style>
    </>
  );
}
