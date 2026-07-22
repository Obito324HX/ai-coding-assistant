import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [code, setCode] = useState("<!-- Your generated code will appear here -->");
  const [previewCode, setPreviewCode] = useState("");
  const [isDebug, setIsDebug] = useState(false);
  const [errorInfo, setErrorInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitStatus, setLimitStatus] = useState("ok");
  const [editCount, setEditCount] = useState(0);
  const [activeTab, setActiveTab] = useState("editor");
  const [mobileScreen, setMobileScreen] = useState("chat"); // "chat" | "code"
  const [hasNewCode, setHasNewCode] = useState(false);
  const bottomRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (mobileScreen === "code" && activeTab === "editor") {
      const t = setTimeout(() => editorRef.current?.layout(), 50);
      return () => clearTimeout(t);
    }
  }, [mobileScreen, activeTab]);

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
      if (codeMatch) {
        const newCode = codeMatch[1];
        setCode(newCode);
        setPreviewCode(newCode);
        setActiveTab("preview");
        setHasNewCode(true);
      }
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
    setCode("<!-- Your generated code will appear here -->");
    setPreviewCode("");
    setEditCount(0);
    setLimitStatus("ok");
    setActiveTab("editor");
    setMobileScreen("chat");
    setHasNewCode(false);
  };

  const openCodeScreen = () => {
    setMobileScreen("code");
    setHasNewCode(false);
  };

  const handlePreviewTab = () => {
    setPreviewCode(code);
    setActiveTab("preview");
  };

  const segments = Array.from({ length: 20 }, (_, i) => i < editCount);

  return (
    <div className="app-shell" data-screen={mobileScreen}>
      <div className="chat-panel">
        <div className="header">
          <h2 className="wordmark">
            AI Coding Assistant<span className="cursor">▍</span>
          </h2>
          <div className="header-right">
            <div className="gauge-wrap">
              <div className="gauge-label"><strong>{editCount}</strong>/20 edits</div>
              <div className="gauge-track">
                {segments.map((filled, i) => (
                  <div
                    key={i}
                    className={`gauge-seg ${filled ? "filled" : ""} ${filled && i >= 16 ? "hot" : ""}`}
                  />
                ))}
              </div>
            </div>
            <button onClick={newSession} className="new-session-btn">New Session</button>
            <button onClick={openCodeScreen} className="view-code-btn">
              {"</>"} Code{hasNewCode && <span className="new-dot" />}
            </button>
          </div>
        </div>

        {limitStatus === "warning" && (
          <div className="banner warning">⚠ Approaching session limit — {editCount}/20 edits used</div>
        )}
        {limitStatus === "pause" && (
          <div className="banner error">⛔ Session limit reached. Start a new session to continue.</div>
        )}

        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-glyph">&gt;_</div>
            <p>Describe what you want to build, and I'll generate the code.<br />Toggle Debug to fix something that's broken.</p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "user" : "assistant"}`}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ))}
            {loading && <div className="msg assistant thinking">Generating…</div>}
            <div ref={bottomRef} />
          </div>
        )}

        {isDebug && (
          <input
            className="error-input"
            placeholder="Describe the error or bug..."
            value={errorInfo}
            onChange={(e) => setErrorInfo(e.target.value)}
          />
        )}

        <div className="input-row">
          <button
            onClick={() => setIsDebug(!isDebug)}
            className={`debug-btn ${isDebug ? "active" : ""}`}
          >
            {isDebug ? "Debug ON" : "Debug"}
          </button>
          <textarea
            className="chat-input"
            placeholder={isDebug ? "Describe what to fix..." : "Ask me to build something..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            rows={2}
          />
          <button onClick={sendMessage} className="send-btn" disabled={loading}>
            Send
          </button>
        </div>
      </div>

      <div className="right-panel">
        <div className="tab-bar">
          <button onClick={() => setMobileScreen("chat")} className="back-btn">
            ← Chat
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`tab ${activeTab === "editor" ? "active" : ""}`}
          >
            Code Editor
          </button>
          <button
            onClick={handlePreviewTab}
            className={`tab ${activeTab === "preview" ? "active" : ""}`}
          >
            Live Preview
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="copy-btn"
          >
            Copy
          </button>
        </div>

        <div className="panel-content">
          {activeTab === "editor" ? (
            <Editor
              height="100%"
              defaultLanguage="html"
              value={code}
              onChange={(val) => setCode(val || "")}
              onMount={(editor) => { editorRef.current = editor; }}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on" }}
            />
          ) : (
            <iframe
              srcDoc={previewCode}
              className="iframe-preview"
              title="Live Preview"
              sandbox="allow-scripts"
            />
          )}
        </div>
      </div>
    </div>
  );
}
