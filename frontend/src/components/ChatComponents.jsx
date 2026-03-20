import { useState, useRef } from "react";
import api from "../utils/api";

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconAttach = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

export function ChatBubble({ msg }) {
  const isBot = msg.role === "assistant";
  return (
    <div style={{ display:"flex", gap:8, justifyContent:isBot?"flex-start":"flex-end", animation:"fadeUp 0.2s ease" }}>
      {isBot && (
        <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#1a3320,#16a34a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0, marginTop:2 }}>
          💬
        </div>
      )}
      <div style={{ maxWidth:"78%", background:isBot?"var(--card-bg)":"var(--green-800)", color:isBot?"var(--text-primary)":"#fff", borderRadius:isBot?"4px 14px 14px 14px":"14px 4px 14px 14px", padding:"10px 14px", fontSize:13.5, lineHeight:1.65, boxShadow:"var(--shadow-sm)", border:isBot?"1px solid var(--card-border)":"none", whiteSpace:"pre-wrap" }}>
        {msg.content}
        {msg.fileUrl && (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:5, marginTop:6, padding:"5px 8px", background:"rgba(255,255,255,0.12)", borderRadius:6, fontSize:11.5, color:isBot?"var(--green-700)":"#fff", textDecoration:"none" }}>
            📎 {msg.fileName || "Attachment"}
          </a>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
      <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#1a3320,#16a34a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>💬</div>
      <div style={{ background:"var(--card-bg)", border:"1px solid var(--card-border)", borderRadius:"4px 14px 14px 14px", padding:"10px 14px", display:"flex", gap:5 }}>
        {[0,0.2,0.4].map((d,i) => (
          <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"var(--green-500)", animation:`pulse-dot 1.2s ease-in-out ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

export function ChatInput({ onSend, disabled, compact = false }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Max file size is 10 MB."); return; }
    e.target.value = "";
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post("/upload/drive", { fileName: file.name, fileType: file.type, fileData: base64 });
      setPendingFile({ name: file.name, url: res.data.driveFileUrl });
    } catch { alert("Upload failed. Please try again."); }
    finally { setUploading(false); }
  };

  const submit = () => {
    if (disabled || uploading || (!text.trim() && !pendingFile)) return;
    onSend({ text, fileUrl: pendingFile?.url, fileName: pendingFile?.name });
    setText("");
    setPendingFile(null);
  };

  const pad = compact ? "8px 10px" : "12px 16px";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {pendingFile && (
        <div style={{ padding:"5px 12px 0", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:11.5, color:"var(--green-700)", flex:1 }}>📎 {pendingFile.name}</span>
          <button onClick={() => setPendingFile(null)} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:14 }}>✕</button>
        </div>
      )}
      <div style={{ display:"flex", gap:8, alignItems:"flex-end", padding:pad }}>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleFile} style={{ display:"none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Attach file"
          style={{ width:34, height:34, borderRadius:9, background:"var(--bg-tertiary)", border:"1.5px solid var(--card-border)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:uploading?"var(--green-600)":"var(--text-muted)", flexShrink:0 }}>
          {uploading ? <div style={{ width:13, height:13, border:"2px solid #ccc", borderTopColor:"var(--green-600)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> : <IconAttach />}
        </button>
        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Ask PulsBot…" disabled={disabled} rows={1}
          style={{ flex:1, border:"1.5px solid var(--card-border)", borderRadius:9, padding:"8px 12px", fontSize:13.5, resize:"none", outline:"none", lineHeight:1.5, maxHeight:100, background:"var(--input-bg)", color:"var(--text-primary)", fontFamily:"var(--font-body)" }} />
        <button onClick={submit} disabled={disabled || uploading || (!text.trim() && !pendingFile)}
          style={{ width:36, height:36, borderRadius:9, background:disabled||(!text.trim()&&!pendingFile)?"var(--bg-tertiary)":"var(--green-800)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 }}>
          {disabled ? <div style={{ width:14, height:14, border:"2px solid #ccc", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> : <IconSend />}
        </button>
      </div>
    </div>
  );
}
