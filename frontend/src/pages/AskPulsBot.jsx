import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSharedChat } from "../hooks/useSharedChat";
import { ChatInput } from "../components/ChatComponents";

const SUGGESTIONS = {
  student: [
    { text: "What assignments are due this week?", icon: "📅" },
    { text: "Do I have any overdue work?", icon: "⚠️" },
    { text: "Summarize my recent announcements", icon: "📢" },
    { text: "Give me a study plan for my deadlines", icon: "🧠" },
  ],
  professor: [
    { text: "Post an announcement to my class", icon: "📣" },
    { text: "Create a quiz for Test A due Friday", icon: "📝" },
    { text: "List my classes and student counts", icon: "👥" },
    { text: "Create an assignment with a deadline", icon: "📎" },
  ],
  parent: [
    { text: "How is my child doing?", icon: "📊" },
    { text: "Any overdue assignments?", icon: "🕒" },
    { text: "What are the upcoming deadlines?", icon: "📅" },
    { text: "Show recent class announcements", icon: "🔔" },
  ],
};

// ── Icons ────────────────────────────────────────────────────────
const IconBot = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
    <path d="M9 13v2"/><path d="M15 13v2"/><path d="M5 14v7"/><path d="M19 14v7"/><path d="M2 21h20"/>
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

// ── Advanced Formatter Component ────────────────────────────────
const FormattedMessage = ({ content }) => {
  if (!content) return null;

  // Split content by lines to handle bullets and spacing
  const lines = content.split('\n');

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {lines.map((line, idx) => {
        // Handle Bullet Points
        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('- ');
        const cleanLine = isBullet ? line.trim().substring(2) : line;

        // Process bold and code inline
        const parts = cleanLine.split(/(\*\*.*?\*\*|`.*?`)/g);
        const processedLine = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ fontWeight: 800, color: "inherit" }}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.9em', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} style={{ display: "flex", gap: "8px", paddingLeft: "4px" }}>
              <span style={{ color: "var(--green-700)", fontWeight: "bold" }}>•</span>
              <span style={{ flex: 1 }}>{processedLine}</span>
            </div>
          );
        }

        // Return regular line (or empty line for spacing)
        return line.trim() === "" ? <div key={idx} style={{ height: "4px" }} /> : <div key={idx}>{processedLine}</div>;
      })}
    </div>
  );
};

// ── Message Bubble ──────────────────────────────────────────────
const MessageBubble = ({ msg, isLast }) => {
  const isBot = msg.role === "assistant";
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: isBot ? "row" : "row-reverse", 
      gap: 12, 
      marginBottom: 24, 
      animation: isLast ? "fadeUp 0.4s ease" : "none" 
    }}>
      <div style={{ 
        width: 36, height: 36, borderRadius: 12, 
        background: isBot ? "var(--green-700)" : "var(--bg-tertiary)", 
        color: isBot ? "#fff" : "var(--text-muted)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        boxShadow: "var(--shadow-sm)"
      }}>
        {isBot ? <IconBot /> : <span style={{ fontWeight: 700, fontSize: 13 }}>U</span>}
      </div>
      <div style={{ 
        maxWidth: "85%", 
        background: isBot ? "var(--card-bg)" : "var(--green-800)", 
        color: isBot ? "var(--text-primary)" : "#fff",
        padding: "14px 18px", 
        borderRadius: isBot ? "2px 18px 18px 18px" : "18px 2px 18px 18px",
        border: isBot ? "1px solid var(--card-border)" : "none",
        fontSize: "14.5px",
        lineHeight: "1.6",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
      }}>
        {isBot ? <FormattedMessage content={msg.content} /> : msg.content}
        
        {msg.file_url && (
          <div style={{ marginTop: 12, padding: "10px", background: "rgba(0,0,0,0.05)", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            📎 <a href={msg.file_url} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: 700, textDecoration: "none" }}>{msg.file_name || "Attachment"}</a>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────
export default function AskPulsBot() {
  const { user } = useAuth();
  const { messages, loading, send, clearChat, historyLoaded } = useSharedChat();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to clear your chat history? This cannot be undone.")) return;
    try {
      await clearChat();
      // Forces a UI refresh to ensure local message state is truly empty
      window.location.reload(); 
    } catch (err) {
      alert("Failed to clear chat. Please try again.");
    }
  };

  const role = user?.role || "student";
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.student;
  
  // Logic to show empty state if history is empty OR only contains a system greeting
  const isEmpty = messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant" && !loading);

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", background: "var(--bg-primary)", borderRadius: 20, overflow: "hidden", border: "1px solid var(--card-border)", boxShadow: "var(--shadow-lg)" }}>
      
      {/* Header */}
      <header style={{ 
        padding: "16px 24px", background: "var(--card-bg)", borderBottom: "1px solid var(--card-border)", 
        display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10,
        backdropFilter: "blur(10px)", backgroundColor: "rgba(255,255,255,0.85)" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--green-700)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconBot />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>PulsBot</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Active</span>
            </div>
          </div>
        </div>
        <button onClick={handleClear} style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid var(--card-border)", background: "transparent", color: "var(--text-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "0.2s" }}>
          <IconTrash /> Clear Chat
        </button>
      </header>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {isEmpty && !loading ? (
          <div style={{ margin: "auto", maxWidth: 500, textAlign: "center", animation: "fadeIn 0.6s ease", paddingTop: "10vh" }}>
            <div style={{ fontSize: 50, marginBottom: 20 }}>🤖</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>Hello, {user?.name?.split(" ")[0]}!</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
              How can I help you manage your BUPulse activities today?
            </p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {suggestions.map((s, i) => (
                <button 
                  key={i} onClick={() => send({ text: s.text })}
                  style={{ 
                    padding: "16px", background: "var(--card-bg)", border: "1px solid var(--card-border)", 
                    borderRadius: 16, textAlign: "left", cursor: "pointer", transition: "0.2s",
                    boxShadow: "var(--shadow-sm)"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "var(--green-600)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--card-border)"; }}
                >
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4 }}>{s.text}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} isLast={i === messages.length - 1} />
            ))}
            {loading && (
               <div style={{ display: "flex", gap: 10, paddingLeft: 4, color: "var(--text-muted)", fontSize: 13, fontWeight: 500 }}>
                  <div className="pulse-dot" /> PulsBot is typing...
               </div>
            )}
            <div ref={bottomRef} style={{ height: 40 }} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <footer style={{ padding: "20px 24px 30px", background: "var(--card-bg)", borderTop: "1px solid var(--card-border)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ 
            borderRadius: 18, background: "var(--bg-primary)", border: "1.5px solid var(--card-border)", 
            boxShadow: "var(--shadow-md)", overflow: "hidden", transition: "border-color 0.2s" 
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = "var(--green-600)"}
            onBlurCapture={e => e.currentTarget.style.borderColor = "var(--card-border)"}
          >
            <ChatInput onSend={send} disabled={loading} compact={false} />
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green-700); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
      `}</style>
    </div>
  );
}