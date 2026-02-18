import { useState, useRef, useEffect } from "react";

// In Docker: Nginx proxies /api/* → backend:8000/*
// In local dev: Vite proxies /api/* → localhost:8000/*
const API_BASE = "/api";

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const SourceChip = ({ source }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "4px",
    background: "rgba(180,140,80,0.15)", border: "1px solid rgba(180,140,80,0.3)",
    color: "#b48c50", borderRadius: "4px", padding: "2px 8px",
    fontSize: "11px", fontFamily: "'DM Mono', monospace", marginRight: "6px", marginTop: "6px"
  }}>
    <FileIcon style={{ width: 10, height: 10 }} /> {source}
  </span>
);

export default function App() {
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! Upload some documents and I'll answer questions about them. I'll show you exactly which sources I used for each answer.",
      sources: []
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const bottomRef = useRef();

  useEffect(() => { fetchDocs(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {}
  };

  const handleUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append("files", f));
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      await fetchDocs();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `✓ Ingested ${data.count} chunk${data.count !== 1 ? "s" : ""} from: ${Array.from(files).map(f => f.name).join(", ")}. Ready to answer questions!`,
        sources: []
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Upload failed — make sure the backend container is running.",
        sources: []
      }]);
    }
    setUploading(false);
  };

  const deleteDoc = async (name) => {
    try {
      await fetch(`${API_BASE}/documents/${encodeURIComponent(name)}`, { method: "DELETE" });
      await fetchDocs();
    } catch {}
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources || [] }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error — is the backend running?", sources: [] }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{
      display: "flex", height: "100vh",
      fontFamily: "'Playfair Display', Georgia, serif",
      background: "#1a1714", color: "#e8dcc8"
    }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{
        width: "260px", minWidth: "260px", borderRight: "1px solid rgba(255,255,255,0.08)",
        background: "#15120f", display: "flex", flexDirection: "column"
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            fontSize: "10px", letterSpacing: "3px", color: "#b48c50",
            textTransform: "uppercase", marginBottom: "6px", fontFamily: "'DM Mono', monospace"
          }}>
            RAG Chat
          </div>
          <div style={{ fontSize: "20px", fontWeight: "bold", lineHeight: 1.25 }}>
            Your Document<br />Assistant
          </div>
        </div>

        {/* Upload Zone */}
        <div style={{ padding: "16px" }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? "#b48c50" : "rgba(255,255,255,0.12)"}`,
              borderRadius: "8px", padding: "20px 12px", textAlign: "center",
              cursor: "pointer", transition: "all 0.2s",
              background: dragOver ? "rgba(180,140,80,0.05)" : "transparent",
              color: "#9a8a72"
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📄</div>
            <div style={{ fontSize: "12px", lineHeight: 1.5 }}>
              {uploading
                ? "Uploading…"
                : <><span>Drop files here</span><br /><span style={{ color: "#b48c50", fontSize: "11px" }}>or click to browse</span></>
              }
            </div>
            <div style={{ fontSize: "10px", marginTop: "8px", opacity: 0.5 }}>PDF · TXT · MD</div>
          </div>
          <input
            ref={fileRef} type="file" multiple accept=".pdf,.txt,.md"
            style={{ display: "none" }} onChange={e => handleUpload(e.target.files)}
          />
        </div>

        {/* Document List */}
        <div style={{ padding: "0 16px", flex: 1, overflow: "auto" }}>
          <div style={{
            fontSize: "10px", letterSpacing: "2px", color: "#9a8a72",
            textTransform: "uppercase", marginBottom: "10px", fontFamily: "'DM Mono', monospace"
          }}>
            {docs.length} Document{docs.length !== 1 ? "s" : ""}
          </div>
          {docs.length === 0 && (
            <div style={{ fontSize: "12px", color: "#9a8a72", fontStyle: "italic" }}>No documents yet</div>
          )}
          {docs.map((doc, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "6px", marginBottom: "4px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              fontSize: "12px"
            }}>
              <span style={{ color: "#b48c50", flexShrink: 0 }}><FileIcon /></span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc}</span>
              <button
                onClick={() => deleteDoc(doc)}
                style={{
                  background: "none", border: "none", color: "#9a8a72",
                  cursor: "pointer", padding: "2px", borderRadius: "3px",
                  display: "flex", flexShrink: 0
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        <div style={{
          padding: "16px", borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: "10px", color: "#9a8a72", fontFamily: "'DM Mono', monospace"
        }}>
          Powered by Claude + ChromaDB
        </div>
      </div>

      {/* ── Main Chat ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Status bar */}
        <div style={{
          padding: "14px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "10px"
        }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: docs.length > 0 ? "#4caf82" : "#666", flexShrink: 0
          }} />
          <div style={{ fontSize: "13px", color: "#9a8a72", fontFamily: "'DM Mono', monospace" }}>
            {docs.length > 0
              ? `Searching across ${docs.length} document${docs.length !== 1 ? "s" : ""}`
              : "Upload documents to get started"
            }
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex", gap: "14px", alignItems: "flex-start",
              flexDirection: msg.role === "user" ? "row-reverse" : "row"
            }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                background: msg.role === "user" ? "rgba(180,140,80,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${msg.role === "user" ? "rgba(180,140,80,0.3)" : "rgba(255,255,255,0.08)"}`
              }}>
                {msg.role === "user" ? "👤" : "🤖"}
              </div>

              <div style={{ maxWidth: "680px" }}>
                <div style={{
                  padding: "14px 18px", fontSize: "15px", lineHeight: "1.65",
                  borderRadius: "12px", whiteSpace: "pre-wrap",
                  background: msg.role === "user" ? "rgba(180,140,80,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${msg.role === "user" ? "rgba(180,140,80,0.2)" : "rgba(255,255,255,0.08)"}`,
                  borderTopRightRadius: msg.role === "user" ? "4px" : "12px",
                  borderTopLeftRadius: msg.role === "assistant" ? "4px" : "12px",
                }}>
                  {msg.content}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: "8px", paddingLeft: "2px" }}>
                    <span style={{
                      fontSize: "10px", color: "#9a8a72", letterSpacing: "1px",
                      textTransform: "uppercase", fontFamily: "'DM Mono', monospace"
                    }}>
                      Sources —{" "}
                    </span>
                    {msg.sources.map((s, j) => <SourceChip key={j} source={s} />)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)"
              }}>🤖</div>
              <div style={{
                padding: "16px 20px", borderRadius: "12px", borderTopLeftRadius: "4px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", gap: "5px", alignItems: "center"
              }}>
                {[0, 1, 2].map(j => (
                  <span key={j} style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: "#9a8a72", display: "inline-block",
                    animation: `bounce 1s ${j * 0.15}s infinite`
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            display: "flex", gap: "12px", alignItems: "flex-end",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px", padding: "12px 16px"
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={docs.length === 0 ? "Upload a document first…" : "Ask anything about your documents…"}
              disabled={docs.length === 0 || loading}
              rows={1}
              style={{
                flex: 1, background: "none", border: "none", outline: "none", resize: "none",
                color: "#e8dcc8", fontSize: "15px", fontFamily: "'Playfair Display', Georgia, serif",
                lineHeight: "1.6", maxHeight: "120px", overflow: "auto"
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || docs.length === 0}
              style={{
                width: "38px", height: "38px", borderRadius: "8px", border: "none",
                background: input.trim() && !loading && docs.length > 0 ? "#b48c50" : "rgba(255,255,255,0.06)",
                cursor: input.trim() && !loading && docs.length > 0 ? "pointer" : "default",
                color: input.trim() && !loading && docs.length > 0 ? "#1a1714" : "#9a8a72",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", flexShrink: 0
              }}
            >
              <SendIcon />
            </button>
          </div>
          <div style={{
            textAlign: "center", marginTop: "10px",
            fontSize: "11px", color: "#9a8a72", fontFamily: "'DM Mono', monospace"
          }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        textarea::placeholder { color: #9a8a72; }
        textarea { caret-color: #b48c50; }
      `}</style>
    </div>
  );
}