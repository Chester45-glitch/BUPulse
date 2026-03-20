import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

// ── useSharedChat ─────────────────────────────────────────────────
// Single source of truth for chat state.
// Both FloatingChatbot and AskPulsBot page use this hook so they
// always show the same messages.
export function useSharedChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load history from Supabase on first mount
  useEffect(() => {
    if (!user || historyLoaded) return;
    api.get("/chatbot/history")
      .then((r) => {
        const hist = r.data.history || [];
        if (hist.length > 0) {
          setMessages(
            hist.map((m) => ({
              role: m.role,
              content: m.content,
              fileUrl: m.file_url,
              fileName: m.file_name,
              id: m.id,
            }))
          );
        } else {
          // Fresh start — show greeting
          setMessages([{
            role: "assistant",
            content: `Hi ${user?.name?.split(" ")[0] || "there"}! 👋 I'm PulsBot.\n\nAsk me anything about your ${
              user?.role === "professor"
                ? "classes and students. I can even post announcements for you!"
                : user?.role === "parent"
                ? "child's academic progress"
                : "assignments, deadlines, and class announcements"
            }`,
          }]);
        }
      })
      .catch(() => {
        setMessages([{
          role: "assistant",
          content: `Hi ${user?.name?.split(" ")[0] || "there"}! 👋 I'm PulsBot. How can I help you today?`,
        }]);
      })
      .finally(() => setHistoryLoaded(true));
  }, [user, historyLoaded]);

  const send = useCallback(
    async ({ text, fileUrl, fileName } = {}) => {
      const trimmed = text?.trim();
      if (!trimmed && !fileUrl) return;
      if (loading) return;

      const userMsg = {
        role: "user",
        content: trimmed || `[Attached: ${fileName}]`,
        fileUrl,
        fileName,
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await api.post("/chatbot/message", {
          message: trimmed || userMsg.content,
          fileUrl,
          fileName,
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.data.message },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I'm having trouble connecting. Please try again! 😅",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  const clearChat = useCallback(async () => {
    try { await api.delete("/chatbot/history"); } catch {}
    setHistoryLoaded(false);
    setMessages([{
      role: "assistant",
      content: "Chat cleared! How can I help you?",
    }]);
    setHistoryLoaded(true);
  }, []);

  return { messages, loading, send, clearChat, historyLoaded };
}
