import { useState, useRef, useEffect } from "react";

const API_BASE = "/api";

// ── Icons ─────────────────────────────────────────────────────────────────────

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

const ShieldIcon = ({ on }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <triangle points="10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <path d="M12 9v4"/><path d="M12 17h.01"/>
  </svg>
);

// ── Small components ──────────────────────────────────────────────────────────

const SourceChip = ({ source, flagged }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "4px",
    background: flagged ? "rgba(220,60,60,0.15)" : "rgba(180,140,80,0.15)",
    border: `1px solid ${flagged ? "rgba(220,60,60,0.4)" : "rgba(180,140,80,0.3)"}`,
    color: flagged ? "#dc6060" : "#b48c50",
    borderRadius: "4px", padding: "2px 8px",
    fontSize: "11px", fontFamily: "'DM Mono', monospace", marginRight: "6px", marginTop: "6px"
  }}>
    {flagged ? "⚠ " : ""}{source}
  </span>
);

const ThreatReport = ({ report }) => {
  if (!report) return null;
  const blocked = report.flagged;
  const bg = blocked ? "rgba(220,60,60,0.08)" : "rgba(76,175,130,0.08)";
  const border = blocked ? "rgba(220,60,60,0.3)" : "rgba(76,175,130,0.3)";
  const accent = blocked ? "#dc6060" : "#4caf82";
  const judge = report.query_judge;

  return (
    <div style={{
      marginTop: "10px", padding: "12px 14px", borderRadius: "8px",
      background: bg, border: `1px solid ${border}`,
      fontFamily: "'DM Mono', monospace", fontSize: "11px", lineHeight: "1.7"
    }}>
      <div style={{ color: accent, fontWeight: "bold", marginBottom: "6px", letterSpacing: "1px" }}>
        {blocked ? "⚠  DEFENSE ANALYSIS — THREAT DETECTED" : "✓  DEFENSE ANALYSIS — CLEAN"}
      </div>

      {/* Layer 4 — LLM Judge */}
      {judge && (
        <div style={{
          marginBottom: "6px", padding: "6px 8px", borderRadius: "4px",
          background: judge.is_injection ? "rgba(220,60,60,0.1)" : "rgba(76,175,130,0.06)",
          border: `1px solid ${judge.is_injection ? "rgba(220,60,60,0.2)" : "rgba(76,175,130,0.15)"}`,
        }}>
          <div style={{ color: judge.is_injection ? "#dc6060" : "#4caf82" }}>
            Layer 4 — LLM Judge:{" "}
            {judge.is_injection
              ? <>
                  <span style={{ fontWeight: "bold" }}>INJECTION DETECTED</span>
                  {" "}({Math.round(judge.confidence * 100)}% confidence)
                  {judge.attack_type && <span style={{ color: "#9a8a72" }}> · {judge.attack_type}</span>}
                  {judge.blocked && <span style={{ color: "#dc6060" }}> · BLOCKED</span>}
                </>
              : <span>query appears legitimate ({Math.round(judge.confidence * 100)}% certainty)</span>
            }
          </div>
          {judge.reasoning && (
            <div style={{ color: "#9a8a72", fontSize: "10px", marginTop: "2px", fontStyle: "italic" }}>
              "{judge.reasoning}"
            </div>
          )}
          {judge.error && (
            <div style={{ color: "#9a8a72", fontSize: "10px" }}>Judge error: {judge.error}</div>
          )}
        </div>
      )}

      {blocked && (
        <>
          {report.patterns_found.length > 0 && (
            <div style={{ color: "#e8dcc8" }}>
              Layer 1 — Injection signatures: <span style={{ color: accent }}>{report.patterns_found.join(", ")}</span>
            </div>
          )}
          {report.low_trust_chunk_indices.length > 0 && (
            <div style={{ color: "#e8dcc8" }}>
              Layer 2 — Low-trust sources: <span style={{ color: accent }}>{report.low_trust_chunk_indices.length} chunk(s) from untrusted document(s)</span>
            </div>
          )}
          {report.anomalous_chunk_indices.length > 0 && (
            <div style={{ color: "#e8dcc8" }}>
              Layer 3 — Semantic anomalies: <span style={{ color: accent }}>{report.anomalous_chunk_indices.length} chunk(s) with abnormal retrieval distance</span>
            </div>
          )}
          {report.chunks_removed > 0 && (
            <div style={{ color: "#9a8a72", marginTop: "6px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "6px" }}>
              {report.chunks_removed} chunk(s) removed from LLM context — attack neutralized
            </div>
          )}
        </>
      )}
      {!blocked && !judge?.is_injection && (
        <div style={{ color: "#9a8a72" }}>
          {report.distances.length > 0 ? `All ${report.distances.length} chunks passed inspection — no threats found` : "Query blocked before retrieval."}
        </div>
      )}
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "RAG Poisoning Demo loaded. Upload legitimate docs from demo/legitimate/, then poison docs from demo/poison/ to see the attack. Toggle Defense Mode to activate the three-layer mitigation pipeline.",
      sources: [],
      threat_report: null,
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [defenseMode, setDefenseMode] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [injectingId, setInjectingId] = useState(null);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef();
  const bottomRef = useRef();

  useEffect(() => { fetchDocs(); fetchScenarios(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {}
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch(`${API_BASE}/demo/scenarios`);
      const data = await res.json();
      setScenarios(data.scenarios || []);
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

      const names = Array.from(files).map(f => f.name).join(", ");
      const hasWarnings = data.warnings && data.warnings.length > 0;
      const content = hasWarnings
        ? `⚠ Ingested ${data.count} chunk(s) from: ${names}\n\nLayer 1 — Input Filter detected injection patterns:\n${data.warnings.map(w => `  • ${w}`).join("\n")}\n\nDocument stored with reduced trust score (0.3). Defense mode will block its chunks at query time.`
        : `✓ Ingested ${data.count} chunk(s) from: ${names}. No injection patterns detected — trust score: 1.0`;

      setMessages(prev => [...prev, {
        role: "assistant",
        content,
        sources: [],
        threat_report: null,
        isWarning: hasWarnings,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Upload failed — make sure the backend is running.",
        sources: [],
        threat_report: null,
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

  const handleInjectScenario = async (scenario) => {
    setInjectingId(scenario.id);
    try {
      const res = await fetch(`${API_BASE}/demo/inject/${scenario.id}`, { method: "POST" });
      const data = await res.json();
      await fetchDocs();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚡ Attack injected: "${scenario.name}"\n\nPayload bypassed the upload filter (simulates DB-level compromise).\nSource: ${data.source_name} | Chunks: ${data.chunks_injected} | Trust: 1.0 (full)\n\nTry asking: "${data.trigger_query}"`,
        sources: [],
        threat_report: null,
        isWarning: true,
        triggerQuery: data.trigger_query,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant", content: "Injection failed — is the backend running?", sources: [], threat_report: null
      }]);
    }
    setInjectingId(null);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/demo/reset`, { method: "DELETE" });
      const data = await res.json();
      await fetchDocs();
      setMessages([{
        role: "assistant",
        content: `✓ Demo reset complete. ${data.message}\n\nUpload fresh documents to start a new demo run.`,
        sources: [],
        threat_report: null,
      }]);
    } catch {}
    setResetting(false);
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setMessages(prev => [...prev, { role: "user", content: q, sources: [], threat_report: null }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, defense_mode: defenseMode })
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        threat_report: data.threat_report || null,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant", content: "Connection error — is the backend running?", sources: [], threat_report: null
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const useQuery = (q) => { setInput(q); };

  return (
    <div style={{
      display: "flex", height: "100vh",
      fontFamily: "'Playfair Display', Georgia, serif",
      background: "#1a1714", color: "#e8dcc8"
    }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{
        width: "280px", minWidth: "280px", borderRight: "1px solid rgba(255,255,255,0.08)",
        background: "#15120f", display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{
            fontSize: "10px", letterSpacing: "3px", color: "#b48c50",
            textTransform: "uppercase", marginBottom: "4px", fontFamily: "'DM Mono', monospace"
          }}>
            RAG Security
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", lineHeight: 1.25 }}>
            Poisoning Demo<br />
            <span style={{ fontSize: "13px", fontWeight: "normal", color: "#9a8a72" }}>Attack + Defense</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          {/* Upload Zone */}
          <div style={{ padding: "14px 16px 0" }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragOver ? "#b48c50" : "rgba(255,255,255,0.12)"}`,
                borderRadius: "8px", padding: "14px 12px", textAlign: "center",
                cursor: "pointer", transition: "all 0.2s",
                background: dragOver ? "rgba(180,140,80,0.05)" : "transparent",
                color: "#9a8a72"
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "6px" }}>📄</div>
              <div style={{ fontSize: "12px", lineHeight: 1.5 }}>
                {uploading ? "Scanning + uploading…" : (
                  <><span>Drop docs here</span><br />
                  <span style={{ color: "#b48c50", fontSize: "11px" }}>or click to browse</span></>
                )}
              </div>
              <div style={{ fontSize: "10px", marginTop: "6px", opacity: 0.5 }}>PDF · TXT · MD</div>
            </div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md"
              style={{ display: "none" }} onChange={e => handleUpload(e.target.files)} />
          </div>

          {/* Document List */}
          <div style={{ padding: "12px 16px 0" }}>
            <div style={{
              fontSize: "10px", letterSpacing: "2px", color: "#9a8a72",
              textTransform: "uppercase", marginBottom: "8px", fontFamily: "'DM Mono', monospace"
            }}>
              {docs.length} Document{docs.length !== 1 ? "s" : ""}
            </div>
            {docs.length === 0 && (
              <div style={{ fontSize: "12px", color: "#9a8a72", fontStyle: "italic", marginBottom: "8px" }}>
                No documents yet
              </div>
            )}
            {docs.map((doc, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 10px", borderRadius: "6px", marginBottom: "3px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                fontSize: "11px"
              }}>
                <span style={{ color: "#b48c50", flexShrink: 0 }}><FileIcon /></span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc}</span>
                <button onClick={() => deleteDoc(doc)} style={{
                  background: "none", border: "none", color: "#9a8a72",
                  cursor: "pointer", padding: "2px", borderRadius: "3px", display: "flex", flexShrink: 0
                }}>
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>

          {/* Attack Scenarios */}
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{
              fontSize: "10px", letterSpacing: "2px", color: "#9a8a72",
              textTransform: "uppercase", marginBottom: "8px", fontFamily: "'DM Mono', monospace"
            }}>
              Attack Scenarios
            </div>
            {scenarios.map(s => (
              <div key={s.id} style={{
                padding: "10px", borderRadius: "6px", marginBottom: "6px",
                background: "rgba(220,60,60,0.06)", border: "1px solid rgba(220,60,60,0.2)",
                fontSize: "11px"
              }}>
                <div style={{ color: "#dc6060", fontWeight: "bold", marginBottom: "3px", fontFamily: "'DM Mono', monospace" }}>
                  {s.name}
                </div>
                <div style={{ color: "#9a8a72", fontSize: "10px", marginBottom: "6px", lineHeight: 1.4 }}>
                  {s.attack_class}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleInjectScenario(s)}
                    disabled={injectingId === s.id}
                    style={{
                      flex: 1, padding: "5px 8px", borderRadius: "4px", border: "1px solid rgba(220,60,60,0.4)",
                      background: injectingId === s.id ? "rgba(220,60,60,0.05)" : "rgba(220,60,60,0.1)",
                      color: "#dc6060", cursor: "pointer", fontSize: "10px", fontFamily: "'DM Mono', monospace"
                    }}
                  >
                    {injectingId === s.id ? "Injecting…" : "⚡ Inject"}
                  </button>
                  <button
                    onClick={() => useQuery(s.trigger_query)}
                    style={{
                      flex: 1, padding: "5px 8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.04)", color: "#9a8a72",
                      cursor: "pointer", fontSize: "10px", fontFamily: "'DM Mono', monospace"
                    }}
                  >
                    Try query
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Reset */}
          <div style={{ padding: "10px 16px 16px" }}>
            <button
              onClick={handleReset}
              disabled={resetting}
              style={{
                width: "100%", padding: "8px", borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                color: "#9a8a72", cursor: "pointer", fontSize: "11px",
                fontFamily: "'DM Mono', monospace"
              }}
            >
              {resetting ? "Resetting…" : "↺ Reset Demo"}
            </button>
          </div>
        </div>

        <div style={{
          padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: "10px", color: "#9a8a72", fontFamily: "'DM Mono', monospace", flexShrink: 0
        }}>
          Claude + ChromaDB + three-layer defense
        </div>
      </div>

      {/* ── Main Chat ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Status bar with defense toggle */}
        <div style={{
          padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: "12px"
        }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: docs.length > 0 ? "#4caf82" : "#666", flexShrink: 0
          }} />
          <div style={{ fontSize: "13px", color: "#9a8a72", fontFamily: "'DM Mono', monospace", flex: 1 }}>
            {docs.length > 0
              ? `${docs.length} document${docs.length !== 1 ? "s" : ""} in vector store`
              : "Upload documents to begin"}
          </div>

          {/* Defense mode toggle */}
          <button
            onClick={() => setDefenseMode(d => !d)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
              background: defenseMode ? "rgba(76,175,130,0.2)" : "rgba(220,60,60,0.15)",
              color: defenseMode ? "#4caf82" : "#dc6060",
              fontSize: "11px", fontFamily: "'DM Mono', monospace",
              transition: "all 0.2s", fontWeight: "bold", letterSpacing: "0.5px"
            }}
          >
            <ShieldIcon on={defenseMode} />
            DEFENSE: {defenseMode ? "ON" : "OFF"}
          </button>
        </div>

        {/* Defense mode banner */}
        {defenseMode && (
          <div style={{
            padding: "8px 28px", background: "rgba(76,175,130,0.08)",
            borderBottom: "1px solid rgba(76,175,130,0.2)",
            fontSize: "11px", color: "#4caf82", fontFamily: "'DM Mono', monospace"
          }}>
            Defense active — Layer 1 (injection scan) · Layer 2 (trust validation) · Layer 3 (semantic anomaly) · Layer 4 (LLM judge)
          </div>
        )}
        {!defenseMode && docs.length > 0 && (
          <div style={{
            padding: "8px 28px", background: "rgba(220,60,60,0.06)",
            borderBottom: "1px solid rgba(220,60,60,0.15)",
            fontSize: "11px", color: "#dc6060", fontFamily: "'DM Mono', monospace"
          }}>
            No defense active — RAG pipeline is unprotected. Poison documents will influence answers.
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>
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

              <div style={{ maxWidth: "700px" }}>
                <div style={{
                  padding: "13px 17px", fontSize: "14px", lineHeight: "1.65",
                  borderRadius: "12px", whiteSpace: "pre-wrap",
                  background: msg.role === "user"
                    ? "rgba(180,140,80,0.12)"
                    : msg.isWarning
                      ? "rgba(220,60,60,0.07)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${msg.role === "user"
                    ? "rgba(180,140,80,0.2)"
                    : msg.isWarning
                      ? "rgba(220,60,60,0.25)"
                      : "rgba(255,255,255,0.08)"}`,
                  borderTopRightRadius: msg.role === "user" ? "4px" : "12px",
                  borderTopLeftRadius: msg.role === "assistant" ? "4px" : "12px",
                }}>
                  {msg.content}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: "8px", paddingLeft: "2px" }}>
                    <span style={{
                      fontSize: "10px", color: "#9a8a72", letterSpacing: "1px",
                      textTransform: "uppercase", fontFamily: "'DM Mono', monospace"
                    }}>
                      Sources —{" "}
                    </span>
                    {msg.sources.map((s, j) => (
                      <SourceChip key={j} source={s} flagged={false} />
                    ))}
                  </div>
                )}

                {/* Trigger query shortcut */}
                {msg.triggerQuery && (
                  <button
                    onClick={() => useQuery(msg.triggerQuery)}
                    style={{
                      marginTop: "8px", padding: "5px 12px", borderRadius: "4px",
                      border: "1px solid rgba(220,60,60,0.3)",
                      background: "rgba(220,60,60,0.08)",
                      color: "#dc6060", cursor: "pointer",
                      fontSize: "11px", fontFamily: "'DM Mono', monospace"
                    }}
                  >
                    → Use trigger query
                  </button>
                )}

                {/* Defense analysis report */}
                <ThreatReport report={msg.threat_report} />
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
                    width: "6px", height: "6px", borderRadius: "50%", background: "#9a8a72",
                    display: "inline-block", animation: `bounce 1s ${j * 0.15}s infinite`
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "14px 28px 22px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{
            display: "flex", gap: "12px", alignItems: "flex-end",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${defenseMode ? "rgba(76,175,130,0.2)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "12px", padding: "12px 16px", transition: "border-color 0.2s"
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
            textAlign: "center", marginTop: "8px",
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
