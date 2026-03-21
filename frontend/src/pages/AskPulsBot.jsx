import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useSharedChat } from "../hooks/useSharedChat";
import { ChatInput } from "../components/ChatComponents";

const SUGGESTIONS = {
  student: [
    "What assignments are due this week?",
    "Do I have any overdue work?",
    "Summarize my recent announcements",
    "Give me a study plan for my deadlines",
  ],
  professor: [
    "Post an announcement to my class",
    "Create a quiz for Test A due Friday",
    "List my classes and student counts",
    "Create an assignment with a deadline",
  ],
  parent: [
    "How is my child doing?",
    "Any overdue assignments?",
    "What are the upcoming deadlines?",
    "Show recent class announcements",
  ],
};

const IconBot = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
    <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/><line x1="8" y1="18" x2="8" y2="21"/><line x1="16" y1="18" x2="16" y2="21"/>
    <circle cx="9" cy="11" r="1" fill="currentColor"/><circle cx="15" cy="11" r="1" fill="currentColor"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── Markdown-lite renderer ────────────────────────────────────────
const renderContent = (text) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} style={{ background: "rgba(0,0,0,0.08)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
    if (part === "\n") return <br key={i} />;
    return part;
  });
};

// ── Single message bubble ─────────────────────────────────────────
const MessageBubble = ({ msg, isLast }) => {
  const isBot = msg.role === "assistant";

  if (isBot) {
    return (
      <div style={{ display: "flex", gap: 12, padding: "20px 0", borderBottom: "1px solid var(--card-border)" }}>
        {/* Bot avatar */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--green-800), var(--green-600))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0, marginTop: 2 }}>
          <IconBot />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>PulsBot</div>
          <div style={{ fontSize: 14.5, color: "var(--text-primary)", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {renderContent(msg.content)}
          </div>
          {msg.fileUrl && (
            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "5px 10px", background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, color: "var(--green-700)", textDecoration: "none", border: "1px solid var(--card-border)" }}>
              📎 {msg.fileName || "Attachment"}
            </a>
          )}
        </div>
      </div>
    );
  }

  // User message
  return (
    <div style={{ display: "flex", gap: 12, padding: "20px 0", borderBottom: "1px solid var(--card-border)", flexDirection: "row-reverse" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-tertiary)", border: "1px solid var(--card-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 2 }}>
        👤
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, textAlign: "right" }}>You</div>
        <div style={{ fontSize: 14.5, color: "var(--text-primary)", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" }}>
          {msg.content}
        </div>
        {msg.fileUrl && (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "5px 10px", background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", border: "1px solid var(--card-border)" }}>
            📎 {msg.fileName || "Attachment"}
          </a>
        )}
      </div>
    </div>
  );
};

// ── Typing indicator ──────────────────────────────────────────────
const TypingRow = () => (
  <div style={{ display: "flex", gap: 12, padding: "20px 0" }}>
    <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--green-800), var(--green-600))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
      <IconBot />
    </div>
    <div style={{ paddingTop: 8, display: "flex", gap: 5, alignItems: "center" }}>
      {[0, 0.18, 0.36].map((d, i) => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-muted)", animation: `pulse-dot 1.2s ease-in-out ${d}s infinite` }} />
      ))}
    </div>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────
const EmptyState = ({ user, suggestions, onSend }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 24px", textAlign: "center" }}>
    <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, var(--green-800), var(--green-600))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
        <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>
        <circle cx="9" cy="11" r="1" fill="#fff"/><circle cx="15" cy="11" r="1" fill="#fff"/>
      </svg>
    </div>
    <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
      Hey {user?.name?.split(" ")[0] || "there"}! 👋
    </h2>
    <p style={{ fontSize: 14.5, color: "var(--text-muted)", maxWidth: 400, lineHeight: 1.6, marginBottom: 32 }}>
      I'm PulsBot, your AI assistant for BUPulse. Ask me anything about your classes, deadlines, or announcements.
    </p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 560 }}>
      {suggestions.map((s) => (
        <button key={s} onClick={() => onSend({ text: s })}
          style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid var(--card-border)", background: "var(--card-bg)", color: "var(--text-secondary)", fontSize: 13.5, cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontWeight: 500 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green-600)"; e.currentTarget.style.color = "var(--green-700)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--card-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
          {s}
        </button>
      ))}
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────
export default function AskPulsBot() {
  const { user } = useAuth();
  const { messages, loading, send, clearChat, historyLoaded } = useSharedChat();
  const bottomRef = useRef(null);
  const role = user?.role || "student";
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.student;
  const isEmpty = historyLoaded && messages.length === 0;
  const showEmpty = messages.length <= 1 && messages[0]?.role === "assistant" && !loading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height))", background: "var(--bg-primary)", animation: "fadeIn 0.3s ease" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid var(--card-border)", background: "var(--card-bg)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, var(--green-800), var(--green-600))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <IconBot />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>PulsBot</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              Powered by Groq AI
            </div>
          </div>
        </div>
        <button onClick={clearChat}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--card-border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12.5, transition: "all 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-tertiary)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <IconTrash /> Clear chat
        </button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {showEmpty ? (
          <EmptyState user={user} suggestions={suggestions} onSend={send} />
        ) : (
          <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "0 24px", boxSizing: "border-box" }}>
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} isLast={i === messages.length - 1} />
            ))}
            {loading && <TypingRow />}
            <div ref={bottomRef} style={{ height: 24 }} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ borderTop: "1px solid var(--card-border)", background: "var(--card-bg)", padding: "12px 24px 20px", flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ border: "1.5px solid var(--card-border)", borderRadius: 14, background: "var(--bg-primary)", overflow: "hidden", boxShadow: "var(--shadow-md)", transition: "border-color 0.15s" }}
            onFocusCapture={e => e.currentTarget.style.borderColor = "var(--green-600)"}
            onBlurCapture={e => e.currentTarget.style.borderColor = "var(--card-border)"}>
            <ChatInput onSend={send} disabled={loading} compact={false} />
          </div>
          <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>
            PulsBot can make mistakes. Verify important information.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-dot { 0%,100% { opacity:.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
      `}</style>
    </div>
  );
}
