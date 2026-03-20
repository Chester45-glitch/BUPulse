import { useRef, useEffect } from "react";
import { useSharedChat } from "../hooks/useSharedChat";
import { ChatBubble, TypingIndicator, ChatInput } from "../components/ChatComponents";
import { useAuth } from "../context/AuthContext";

const SUGGESTIONS = {
  student: [
    "What assignments are due this week?",
    "Do I have any overdue work?",
    "Summarize my recent announcements",
    "Give me a study plan for my deadlines",
  ],
  professor: [
    "List my active classes",
    "Help me write an announcement",
    "Post to all my classes: No class tomorrow",
    "How many students are in each of my classes?",
  ],
  parent: [
    "How is my child doing academically?",
    "Are there any overdue assignments?",
    "What are the upcoming deadlines?",
    "Any recent announcements I should know about?",
  ],
};

export default function AskPulsBot() {
  const { user } = useAuth();
  const { messages, loading, send, clearChat, historyLoaded } = useSharedChat();
  const bottomRef = useRef(null);
  const role = user?.role || "student";
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.student;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height) - 48px)", animation: "fadeIn 0.4s ease" }}>

      {/* Header bar */}
      <div style={{ background: "var(--card-bg)", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", border: "1px solid var(--card-border)", borderBottom: "none", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,var(--green-800),var(--green-600))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💬</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>PulsBot</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Online · Shared with floating chat</span>
            </div>
          </div>
        </div>
        <button
          onClick={clearChat}
          style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", cursor: "pointer", background: "var(--card-bg)" }}
        >
          Clear chat
        </button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", background: "var(--bg-tertiary)", border: "1px solid var(--card-border)", borderTop: "none", borderBottom: "none", display: "flex", flexDirection: "column", gap: 14 }}>
        {!historyLoaded ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40, color: "var(--text-muted)" }}>
            <div style={{ width: 24, height: 24, border: "3px solid var(--border-color)", borderTopColor: "var(--green-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            {messages.map((m, i) => <ChatBubble key={m.id || i} msg={m} />)}
            {loading && <TypingIndicator />}

            {/* Suggestions — only when fresh */}
            {messages.length <= 1 && !loading && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send({ text: s })} style={{ padding: "7px 14px", borderRadius: 99, border: "1.5px solid var(--green-200)", background: "var(--green-50)", color: "var(--green-800)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div style={{ background: "var(--card-bg)", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", border: "1px solid var(--card-border)", borderTop: "none", flexShrink: 0 }}>
        <ChatInput onSend={send} disabled={loading || !historyLoaded} />
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </div>
  );
}
