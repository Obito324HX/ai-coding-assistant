import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const API = "http://localhost:5000";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [code, setCode] = useState("// Your generated code will appear here");
  const [isDebug, setIsDebug] = useState(false);
  const [errorInfo, setErrorInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitStatus, setLimitStatus] = useState("ok");
  const [editCount, setEditCount] = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/chat`, {
        message: input,
        session_id: sessionId,
        is_debug: isDebug,
        broken_code: isDebug ? code : "",
        error_info: isDebug ? errorInfo : "",
      });
      const data = res.data;
      setSessionId(data.session_id);
      setLimitStatus(data.limit_status);
      setEditCount(data.edit_count);
      const assistantMsg = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);
      const codeMatch = data.reply.match(/```(?:html|css|js|javascript|python)?\n([\s\S]*?)```/);
      if (codeMatch) setCode(codeMatch[1]);
      setIsDebug(false);
      setErrorInfo("");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const newSession = async () => {
    const res = await axios.post(`${API}/new-session`);
    setSessionId(res.data.session_id);
    setMessages([]);
    setCode("// Your generated code will appear here");
    setEditCount(0);
    setLimitStatus("ok");
  };

  return (
    <div style={styles.container}>
      <div style={styles.chatPanel}>
        <div style={styles.header}>
          <h2 style={styles.title}>AI Coding Assistant</h2>
          <div style={styles.headerRight}>
            <span style={styles.editCount}>Edits: {editCount}/20</span>
            <button onClick={newSession} style={styles.newSessionBtn}>New Session</button>
          </div>
        </div>
        {limitStatus === "warning" && (
          <div style={styles.warning}>⚠️ Approaching session limit ({editCount}/20)</div>
        )}
        {limitStatus === "pause" && (
          <div style={styles.error}>🚫 Session limit reached. Start a new session.</div>
        )}
        <div style={styles.messages}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === "user" ? styles.userMsg : styles.assistantMsg}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          ))}
          {loading && <div style={styles.assistantMsg}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>
        {isDebug && (
          <input
            style={styles.errorInput}
            placeholder="Describe the error or bug..."
            value={errorInfo}
            onChange={(e) => setErrorInfo(e.target.value)}
          />
        )}
        <div style={styles.inputRow}>
          <button
            onClick={() => setIsDebug(!isDebug)}
            style={isDebug ? styles.debugActiveBtn : styles.debugBtn}
          >
            {isDebug ? "Debug ON" : "Debug"}
          </button>
          <textarea
            style={styles.input}
            placeholder={isDebug ? "Describe what to fix..." : "Ask me to build something..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            rows={2}
          />
          <button onClick={sendMessage} style={styles.sendBtn} disabled={loading}>
            Send
          </button>
        </div>
      </div>
      <div style={styles.editorPanel}>
        <div style={styles.editorHeader}>
          <span style={styles.editorTitle}>Code Editor</span>
          <button onClick={() => navigator.clipboard.writeText(code)} style={styles.copyBtn}>
            Copy
          </button>
        </div>
        <Editor
          height="100%"
          defaultLanguage="html"
          value={code}
          onChange={(val) => setCode(val)}
          theme="vs-dark"
          options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on" }}
        />
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", height: "100vh", background: "#0f0f0f", color: "#fff", fontFamily: "monospace" },
  chatPanel: { width: "40%", display: "flex", flexDirection: "column", borderRight: "1px solid #2a2a2a" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #2a2a2a", background: "#1a1a1a" },
  title: { margin: 0, fontSize: "16px", color: "#61dafb" },
  headerRight: { display: "flex", alignItems: "center", gap: "10px" },
  editCount: { fontSize: "12px", color: "#888" },
  newSessionBtn: { background: "#2a2a2a", color: "#fff", border: "1px solid #444", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  messages: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" },
  userMsg: { background: "#1e3a5f", padding: "10px 14px", borderRadius: "8px", alignSelf: "flex-end", maxWidth: "85%", fontSize: "13px" },
  assistantMsg: { background: "#1a1a1a", padding: "10px 14px", borderRadius: "8px", alignSelf: "flex-start", maxWidth: "95%", fontSize: "13px", border: "1px solid #2a2a2a" },
  warning: { background: "#3a2a00", color: "#ffaa00", padding: "8px 16px", fontSize: "12px" },
  error: { background: "#3a0000", color: "#ff4444", padding: "8px 16px", fontSize: "12px" },
  inputRow: { display: "flex", gap: "8px", padding: "12px", borderTop: "1px solid #2a2a2a", alignItems: "flex-end" },
  input: { flex: 1, background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: "6px", padding: "8px", fontSize: "13px", resize: "none", fontFamily: "monospace" },
  sendBtn: { background: "#61dafb", color: "#000", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" },
  debugBtn: { background: "#2a2a2a", color: "#888", border: "1px solid #444", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  debugActiveBtn: { background: "#3a1a00", color: "#ffaa00", border: "1px solid #ffaa00", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  errorInput: { margin: "0 12px", background: "#1a1a1a", color: "#fff", border: "1px solid #ffaa00", borderRadius: "6px", padding: "8px", fontSize: "12px", fontFamily: "monospace" },
  editorPanel: { flex: 1, display: "flex", flexDirection: "column" },
  editorHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" },
  editorTitle: { fontSize: "13px", color: "#888" },
  copyBtn: { background: "#2a2a2a", color: "#fff", border: "1px solid #444", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
};
