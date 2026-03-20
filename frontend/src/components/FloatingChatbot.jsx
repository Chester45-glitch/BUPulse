import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// ── Icons ────────────────────────────────────────────────────────
const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconSend = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconChat = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconAttach = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── Quick suggestions per role ───────────────────────────────────
const SUGGESTIONS = {
  student: [
    "What assignments are due this week?",
    "Do I have any overdue work?",
    "Summarize my recent announcements",
    "Give me a study plan for my deadlines",
  ],
  professor: [
    "How many students are in my classes?",
    "What announcements have I posted recently?",
    "Help me write a class announcement",
    "List my active courses",
  ],
  parent: [
    "How is my child doing academically?",
    "Are there any overdue assignments?",
    "What are the upcoming deadlines?",
    "Any recent announcements I should know about?",
  ],
};

// ── Typing indicator ─────────────────────────────────────────────
const Typing = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#1a3320,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>💬</div>
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", display: "flex", gap: 5 }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-500)", animation: `pulse-dot 1.2s ease-in-out ${d}s infinite` }} />
      ))}
    </div>
  </div>
);

// ── Single message bubble ────────────────────────────────────────
function Bubble({ msg }) {
  const isBot = msg.role === "assistant";
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: isBot ? "flex-start" : "flex-end", animation: "fadeUp 0.2s ease" }}>
      {isBot && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#1a3320,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 }}>
          💬
        </div>
      )}
      <div style={{ maxWidth: "78%", background: isBot ? "var(--card-bg)" : "var(--green-800)", color: isBot ? "var(--text-primary)" : "#fff", borderRadius: isBot ? "4px 12px 12px 12px" : "12px 4px 12px 12px", padding: "10px 13px", fontSize: 13, lineHeight: 1.6, boxShadow: "var(--shadow-sm)", border: isBot ? "1px solid var(--card-border)" : "none", whiteSpace: "pre-wrap" }}>
        {msg.content}
        {msg.attachment && (
          <div style={{ marginTop: 6, padding: "5px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            📎 {msg.attachment}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Floating chatbot ─────────────────────────────────────────────
export default function FloatingChatbot() {
  const { user } = useAuth();
  const role = user?.role || "student";
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.student;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi ${user?.name?.split(" ")[0] || "there"}! 👋 I'm PulsBot.\n\nAsk me anything about your ${role === "professor" ? "classes and students" : role === "parent" ? "child's academic progress" : "assignments, deadlines, and announcements"}.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const fileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle file selection
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX) { alert("File too large. Max 5 MB."); return; }
    setPendingFile(file);
    e.target.value = "";
  };

  const send = async (text = input.trim()) => {
    if (!text && !pendingFile) return;
    if (loading) return;

    const userMsg = {
      role: "user",
      content: text || (pendingFile ? `[Attached: ${pendingFile.name}]` : ""),
      attachment: pendingFile?.name,
    };

    setInput("");
    const fileToSend = pendingFile;
    setPendingFile(null);

    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      let payload = { message: text || userMsg.content, conversationHistory: next.slice(0, -1) };

      // Attach file as base64 if present
      if (fileToSend) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(fileToSend);
        });
        payload.file = { name: fileToSend.name, type: fileToSend.type, data: base64 };
      }

      const res = await api.post("/chatbot/message", payload);
      const reply = { role: "assistant", content: res.data.message };
      setMessages((p) => [...p, reply]);

      // Increment unread badge if panel is closed
      if (!open) setUnread((n) => n + 1);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again! 😅" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    try { await api.delete("/chatbot/history"); } catch {}
    setMessages([{
      role: "assistant",
      content: "Chat cleared! How can I help you?",
    }]);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open PulsBot chat"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 500,
          width: 54, height: 54, borderRadius: "50%",
          background: open ? "#6b7280" : "linear-gradient(135deg,#1a3320,#16a34a)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          boxShadow: "0 4px 20px rgba(22,163,74,0.45)",
          transition: "all 0.2s ease",
          transform: open ? "scale(0.92)" : "scale(1)",
        }}
      >
        {open ? <IconClose /> : <IconChat />}
        {!open && unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div style={{
        position: "fixed", bottom: 90, right: 24, zIndex: 499,
        width: 360, maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        background: "var(--bg-primary)",
        borderRadius: 18, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        border: "1px solid var(--card-border)",
        overflow: "hidden",
        transform: open ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        transformOrigin: "bottom right",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1a3320,#1e4d1e)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💬</div>
            <div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>PulsBot</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 11 }}>Online</span>
              </div>
            </div>
          </div>
          <button onClick={clearChat} title="Clear chat" style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.7)" }}>
            <IconTrash />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-tertiary)" }}>
          {messages.map((m, i) => <Bubble key={i} msg={m} />)}
          {loading && <Typing />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only on first message) */}
        {messages.length <= 1 && !loading && (
          <div style={{ padding: "8px 12px", background: "var(--card-bg)", borderTop: "1px solid var(--card-border)", display: "flex", flexWrap: "wrap", gap: 5 }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} style={{ padding: "5px 10px", borderRadius: 99, border: "1.5px solid var(--green-200)", background: "var(--green-50)", color: "var(--green-800)", fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Pending file indicator */}
        {pendingFile && (
          <div style={{ padding: "6px 14px", background: "var(--card-bg)", borderTop: "1px solid var(--card-border)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--green-700)", flex: 1 }}>📎 {pendingFile.name}</span>
            <button onClick={() => setPendingFile(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
        )}

        {/* Input row */}
        <div style={{ padding: "10px 12px", background: "var(--card-bg)", borderTop: "1px solid var(--card-border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
          {/* File attach */}
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} title="Attach file" style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg-tertiary)", border: "1.5px solid var(--card-border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}>
            <IconAttach />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask PulsBot…"
            disabled={loading}
            rows={1}
            style={{ flex: 1, border: "1.5px solid var(--card-border)", borderRadius: 9, padding: "8px 12px", fontSize: 13, resize: "none", outline: "none", lineHeight: 1.5, maxHeight: 90, background: "var(--input-bg)", color: "var(--text-primary)", fontFamily: "var(--font-body)" }}
          />

          <button
            onClick={() => send()}
            disabled={(!input.trim() && !pendingFile) || loading}
            style={{ width: 36, height: 36, borderRadius: 9, background: (!input.trim() && !pendingFile) || loading ? "var(--bg-tertiary)" : "var(--green-800)", border: "none", cursor: (!input.trim() && !pendingFile) || loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}
          >
            {loading
              ? <div style={{ width: 14, height: 14, border: "2px solid #ccc", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              : <IconSend />
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @media (max-width: 480px) {
          /* On very small screens, chatbot panel full-width */
          div[style*="360px"] { width: calc(100vw - 32px) !important; right: 16px !important; }
        }
      `}</style>
    </>
  );
}
