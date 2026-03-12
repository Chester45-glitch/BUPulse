import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const SUGGESTIONS = [
  "What assignments are due this week?",
  "Do I have any overdue work?",
  "Summarize my recent announcements",
  "Give me a study plan for my deadlines",
];

const Message = ({ msg }) => {
  const isBot = msg.role==="assistant";
  return (
    <div style={{ display:"flex", gap:10, justifyContent:isBot?"flex-start":"flex-end", animation:"fadeIn 0.25s ease" }}>
      {isBot && <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg, var(--green-800), var(--green-600))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💬</div>}
      <div style={{ maxWidth:"70%", background:isBot?"var(--white)":"var(--green-800)", color:isBot?"var(--gray-800)":"var(--white)", borderRadius:isBot?"4px 14px 14px 14px":"14px 4px 14px 14px", padding:"12px 16px", fontSize:14, lineHeight:1.65, boxShadow:"var(--shadow-sm)", border:isBot?"1px solid var(--gray-200)":"none", whiteSpace:"pre-wrap" }}>
        {msg.content}
      </div>
    </div>
  );
};

const Typing = () => (
  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
    <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg, var(--green-800), var(--green-600))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💬</div>
    <div style={{ background:"var(--white)", border:"1px solid var(--gray-200)", borderRadius:"4px 14px 14px 14px", padding:"12px 16px", display:"flex", gap:6 }}>
      {[0,0.2,0.4].map((d,i) => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"var(--green-400)", animation:`pulse-dot 1.2s ease-in-out ${d}s infinite` }} />)}
    </div>
  </div>
);

export default function AskPulsBot() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([{ role:"assistant", content:`Hi ${user?.name?.split(" ")[0]||"there"}! 👋 I'm PulsBot, your academic assistant.\n\nI can help you with your assignments, deadlines, and announcements from Google Classroom. What would you like to know?` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);

  const send = async (text=input.trim()) => {
    if (!text||loading) return;
    setInput("");
    const next = [...messages, { role:"user", content:text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await api.post("/chatbot/message", { message:text, conversationHistory:next.slice(0,-1) });
      setMessages(p => [...p, { role:"assistant", content:res.data.message }]);
    } catch {
      setMessages(p => [...p, { role:"assistant", content:"Sorry, I'm having trouble connecting. Please try again! 😅" }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - var(--header-height) - 56px)", animation:"fadeIn 0.4s ease" }}>

      {/* Header */}
      <div style={{ background:"var(--white)", borderRadius:"var(--radius-lg) var(--radius-lg) 0 0", border:"1px solid var(--gray-200)", borderBottom:"none", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:"50%", background:"linear-gradient(135deg, var(--green-800), var(--green-600))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>💬</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700 }}>PulsBot</div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e" }} />
              <span style={{ fontSize:12, color:"var(--gray-400)" }}>Online · Powered by Claude AI</span>
            </div>
          </div>
        </div>
        <button onClick={async()=>{ try{await api.delete("/chatbot/history")}catch{} setMessages([{role:"assistant",content:"Chat cleared! How can I help you?"}]); }} style={{ fontSize:12, color:"var(--gray-400)", padding:"6px 12px", borderRadius:"var(--radius-md)", border:"1px solid var(--gray-200)", cursor:"pointer" }}>Clear chat</button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 22px", background:"var(--green-bg)", border:"1px solid var(--gray-200)", borderTop:"none", borderBottom:"none", display:"flex", flexDirection:"column", gap:16 }}>
        {messages.map((m,i) => <Message key={i} msg={m} />)}
        {loading && <Typing />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length<=1 && !loading && (
        <div style={{ background:"var(--white)", padding:"12px 20px", border:"1px solid var(--gray-200)", borderTop:"none", borderBottom:"none", display:"flex", gap:8, flexWrap:"wrap" }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={()=>send(s)} style={{ padding:"7px 14px", borderRadius:99, border:"1.5px solid var(--green-200)", background:"var(--green-50)", color:"var(--green-800)", fontSize:12.5, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap" }}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ background:"var(--white)", borderRadius:"0 0 var(--radius-lg) var(--radius-lg)", border:"1px solid var(--gray-200)", padding:"14px 16px", display:"flex", gap:10, alignItems:"flex-end" }}>
        <textarea
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }}
          placeholder="Ask PulsBot about your deadlines, assignments..."
          disabled={loading} rows={1}
          style={{ flex:1, border:"1.5px solid var(--gray-200)", borderRadius:"var(--radius-md)", padding:"10px 14px", fontSize:14, resize:"none", outline:"none", lineHeight:1.5, maxHeight:120 }}
        />
        <button onClick={()=>send()} disabled={!input.trim()||loading} style={{ width:42, height:42, borderRadius:"var(--radius-md)", background:!input.trim()||loading?"var(--gray-100)":"var(--green-800)", border:"none", cursor:!input.trim()||loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {loading ? <div style={{ width:18, height:18, border:"2px solid #ccc", borderTopColor:"var(--green-600)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> : "➤"}
        </button>
      </div>
    </div>
  );
}
