import { useState, useRef, useCallback } from "react";
import api from "../utils/api";

// ── File type icon ────────────────────────────────────────────────
const FileIcon = ({ type = "" }) => {
  const t = type.toLowerCase();
  if (t.includes("pdf"))   return <span style={{ fontSize: 16 }}>📄</span>;
  if (t.includes("image")) return <span style={{ fontSize: 16 }}>🖼️</span>;
  if (t.includes("word") || t.includes("document")) return <span style={{ fontSize: 16 }}>📝</span>;
  if (t.includes("sheet") || t.includes("excel"))   return <span style={{ fontSize: 16 }}>📊</span>;
  if (t.includes("presentation") || t.includes("powerpoint")) return <span style={{ fontSize: 16 }}>📑</span>;
  return <span style={{ fontSize: 16 }}>📎</span>;
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Class selector ────────────────────────────────────────────────
function ClassSelector({ courses, selectedIds, onChange }) {
  const allSelected = selectedIds.length === courses.length;
  const BANNERS = ["#2563eb","#16a34a","#7c3aed","#ea580c","#0d9488","#db2777","#0284c7","#65a30d"];
  const getBg = (n = "") => BANNERS[n.charCodeAt(0) % BANNERS.length];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          Post to * ({selectedIds.length} selected)
        </label>
        <button type="button" onClick={() => onChange(allSelected ? [] : courses.map((c) => c.id))} style={{ fontSize: 11.5, color: "var(--green-700)", fontWeight: 600, cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--green-200)", background: "var(--green-50)" }}>
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
        {courses.map((c) => {
          const checked = selectedIds.includes(c.id);
          return (
            <button key={c.id} type="button" onClick={() => onChange(checked ? selectedIds.filter((x) => x !== c.id) : [...selectedIds, c.id])} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, textAlign: "left", border: `1.5px solid ${checked ? "#16a34a" : "var(--card-border)"}`, background: checked ? "rgba(22,163,74,0.06)" : "var(--card-bg)", cursor: "pointer", transition: "all 0.13s" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: getBg(c.name), flexShrink: 0 }} />
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "#16a34a" : "var(--border-color)"}`, background: checked ? "#16a34a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                {c.section && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.section}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main AnnouncementForm ─────────────────────────────────────────
export default function AnnouncementForm({ courses = [], onSuccess }) {
  const [text, setText] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [files, setFiles] = useState([]); // [{ name, type, size, driveFileId, driveFileUrl, uploading, error }]
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  const uploadFile = async (file) => {
    const tempId = `${Date.now()}-${file.name}`;
    setFiles((prev) => [...prev, { tempId, name: file.name, type: file.type, size: file.size, uploading: true }]);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await api.post("/upload/drive", {
        fileName: file.name,
        fileType: file.type,
        fileData: base64,
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.tempId === tempId
            ? { ...f, uploading: false, driveFileId: res.data.driveFileId, driveFileUrl: res.data.driveFileUrl }
            : f
        )
      );
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Upload failed";
      setFiles((prev) =>
        prev.map((f) =>
          f.tempId === tempId ? { ...f, uploading: false, error: msg } : f
        )
      );
    }
  };

  const handleFiles = useCallback((fileList) => {
    const MAX = 10 * 1024 * 1024;
    Array.from(fileList).forEach((file) => {
      if (file.size > MAX) { alert(`${file.name} exceeds 10 MB.`); return; }
      uploadFile(file);
    });
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = async (tempId, driveFileId) => {
    setFiles((prev) => prev.filter((f) => f.tempId !== tempId));
    if (driveFileId) {
      await api.delete(`/upload/drive/${driveFileId}`).catch(() => {});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) return setError("Please select at least one class.");
    if (!text.trim()) return setError("Please write an announcement.");
    const stillUploading = files.some((f) => f.uploading);
    if (stillUploading) return setError("Please wait for all files to finish uploading.");

    setPosting(true);
    setError("");
    setSuccess("");

    try {
      const driveFiles = files
        .filter((f) => f.driveFileId)
        .map((f) => ({ driveFileId: f.driveFileId, driveFileUrl: f.driveFileUrl, fileName: f.name, fileType: f.type }));

      const res = await api.post("/professor/announcements", {
        courseIds: selectedIds,
        text: text.trim(),
        driveFiles,
      });

      setSuccess(res.data.message);
      setText("");
      setSelectedIds([]);
      setFiles([]);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const canPost = selectedIds.length > 0 && text.trim() && !posting && !files.some((f) => f.uploading);

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: 16, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>

      {/* GC-style header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--card-border)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--green-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📢</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Announcement</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Posts directly to Google Classroom</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Alerts */}
          {success && <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "10px 14px", color: "#16a34a", fontSize: 13.5 }}>{success}</div>}
          {error   && <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13.5 }}>⚠️ {error}</div>}

          {/* Class selector */}
          {courses.length > 0 && (
            <ClassSelector courses={courses} selectedIds={selectedIds} onChange={setSelectedIds} />
          )}

          {/* Text area */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Announcement *</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Announce something to your class…"
              rows={5}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--input-border)", background: "var(--input-bg)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "var(--font-body)", lineHeight: 1.65, transition: "border-color 0.15s" }}
              onFocus={(e) => (e.target.style.borderColor = "#16a34a")}
              onBlur={(e) => (e.target.style.borderColor = "var(--input-border)")}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 3 }}>{text.length} chars</div>
          </div>

          {/* File drop zone */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Attachments</label>
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? "#16a34a" : "var(--border-color)"}`, borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(22,163,74,0.04)" : "var(--bg-tertiary)", transition: "all 0.15s" }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>☁️</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Drag & drop files here, or <span style={{ color: "var(--green-700)", fontWeight: 600 }}>browse</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>PDF, images, docs, sheets — max 10 MB each</div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {files.map((f) => (
                  <div key={f.tempId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, background: f.error ? "#fee2e2" : "var(--card-bg)", border: `1px solid ${f.error ? "#fecaca" : "var(--card-border)"}` }}>
                    <FileIcon type={f.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: f.error ? "#dc2626" : "var(--text-muted)" }}>
                        {f.error ? f.error : f.uploading ? "Uploading…" : formatSize(f.size)}
                      </div>
                    </div>
                    {f.uploading
                      ? <div style={{ width: 16, height: 16, border: "2px solid #ccc", borderTopColor: "var(--green-600)", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                      : f.driveFileUrl
                        ? <a href={f.driveFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--green-700)", textDecoration: "none", flexShrink: 0 }}>View</a>
                        : null
                    }
                    <button type="button" onClick={() => removeFile(f.tempId, f.driveFileId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 15, lineHeight: 1, flexShrink: 0, padding: "2px 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions — GC style */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--card-border)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={() => { setText(""); setSelectedIds([]); setFiles([]); setError(""); setSuccess(""); }} style={{ padding: "9px 18px", borderRadius: 20, border: "none", background: "transparent", color: "var(--text-secondary)", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={!canPost} style={{ padding: "9px 22px", borderRadius: 20, border: "none", background: canPost ? "var(--green-800)" : "#9ca3af", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: canPost ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s" }}>
            {posting
              ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Posting…</>
              : `Post${selectedIds.length > 0 ? ` to ${selectedIds.length}` : ""}`
            }
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
