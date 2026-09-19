"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Send,
  Zap,
  BookOpen,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  Clock,
  Sparkles,
  Bot,
  User,
  Info,
} from "lucide-react";
import { DocumentRecord, Citation } from "@/lib/types/database";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  cacheHit?: boolean;
  latencyMs?: number;
  unanswered?: boolean;
}

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeSourceDrawer, setActiveSourceDrawer] = useState<Citation[] | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents and existing session history on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
        if (data.sessionId) setSessionId(data.sessionId);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      await fetchDocuments();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error uploading files");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document and all its indexed chunks?")) return;

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d._id?.toString() !== id));
        setSelectedDocIds((prev) => prev.filter((docId) => docId !== id));
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  }

  function toggleDocSelection(id: string) {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function toggleAllDocs() {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(
        documents.map((d) => d._id?.toString() || "").filter(Boolean)
      );
    }
  }

  async function handleSendMessage(queryText?: string) {
    const textToSend = queryText || input;
    if (!textToSend.trim() || streaming) return;

    const userMessageId = "user-" + Date.now();
    const assistantMessageId = "assistant-" + Date.now();

    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMessageId, role: "user", content: textToSend },
      { id: assistantMessageId, role: "assistant", content: "", citations: [] },
    ];

    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          documentIds: selectedDocIds,
        }),
      });

      if (!response.ok || !response.body) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || "Chat service failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "metadata") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        cacheHit: event.cacheHit,
                        citations: event.citations,
                        latencyMs: event.latencyMs,
                        unanswered: event.unanswered,
                      }
                    : msg
                )
              );
            } else if (event.type === "chunk") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + event.text }
                    : msg
                )
              );
            }
          } catch (parseErr) {
            console.warn("Could not parse NDJSON stream event:", parseErr);
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error streaming response.";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: `⚠️ Error: ${errMsg}` }
            : msg
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  const samplePrompts = [
    "What is Reciprocal Rank Fusion and why is it used for hybrid search?",
    "How does MongoDB Atlas Vector Search use HNSW indexing for ANN queries?",
    "How does DocMind's semantic cache reduce latency and LLM costs?",
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-3 sm:p-6 gap-6 h-[calc(100vh-4rem)] overflow-hidden">
      {/* LEFT SIDEBAR: Document Management & Scope */}
      <aside className="w-full md:w-80 lg:w-96 flex flex-col glass-panel rounded-2xl p-4 border border-slate-800/90 shadow-2xl flex-shrink-0 h-auto md:h-full overflow-hidden">
        {/* Header & Upload Dropzone */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">Knowledge Base</h2>
          </div>
          <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
            {documents.length} files
          </span>
        </div>

        {/* Upload Trigger Area */}
        <div className="my-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".pdf,.txt,.md"
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
              uploading
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-700/80 hover:border-emerald-500/60 bg-slate-900/40 hover:bg-slate-900/80"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-emerald-400">
                <Sparkles className="w-6 h-6 animate-spin" />
                <span className="text-xs font-medium">Extracting & Vectorizing...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 text-center">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                  <Upload className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-slate-200">
                  Upload PDF, TXT, or MD
                </span>
                <span className="text-[10px] text-slate-500">
                  Max 5MB each • Auto-chunked & embedded
                </span>
              </div>
            )}
          </label>

          {uploadError && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start gap-2 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Scope Controls */}
        <div className="flex items-center justify-between py-2 text-xs text-slate-400 border-t border-slate-800/80">
          <span>Search Scope:</span>
          <button
            onClick={toggleAllDocs}
            className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium flex items-center gap-1"
          >
            {selectedDocIds.length === documents.length && documents.length > 0 ? (
              <>
                <CheckSquare className="w-3.5 h-3.5" /> Selected All
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" /> Select All ({selectedDocIds.length}/{documents.length})
              </>
            )}
          </button>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
          {documents.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
              <BookOpen className="w-8 h-8 text-slate-600 mb-2 stroke-[1.5]" />
              <p>No documents uploaded yet.</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Upload files or run seed script to start chatting.
              </p>
            </div>
          ) : (
            documents.map((doc) => {
              const id = doc._id?.toString() || "";
              const isSelected = selectedDocIds.includes(id);

              return (
                <div
                  key={id}
                  onClick={() => toggleDocSelection(id)}
                  className={`group flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-950/20 border-emerald-500/40 shadow-sm"
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <div className="mt-0.5 text-slate-400">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-medium text-slate-200 truncate group-hover:text-emerald-300">
                        {doc.filename}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="capitalize">{doc.status}</span>
                        <span>•</span>
                        <span>{doc.chunkCount || 0} chunks</span>
                        <span>•</span>
                        <span>{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteDocument(id, e)}
                    className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800/80 transition-colors ml-1"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Session Metadata */}
        <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Session: {sessionId ? sessionId.slice(0, 8) + "..." : "Active"}</span>
          <span className="text-emerald-400/80 font-mono">Atlas Vector Search</span>
        </div>
      </aside>

      {/* RIGHT MAIN PANEL: Interactive RAG Chat & Sources */}
      <section className="flex-1 flex flex-col glass-panel rounded-2xl border border-slate-800/90 shadow-2xl overflow-hidden relative">
        {/* Chat Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <h1 className="text-sm font-semibold text-slate-200">Grounded Conversation</h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            {selectedDocIds.length > 0 ? (
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                Scoped to {selectedDocIds.length} file{selectedDocIds.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-300">
                Searching All Documents
              </span>
            )}
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Welcome to DocMind</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Ask questions over your documents with grounded answers, source citations,
                  sub-second semantic caching, and Reciprocal Rank Fusion hybrid retrieval.
                </p>
              </div>

              {/* Sample Starters */}
              <div className="w-full space-y-2 pt-2 text-left">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Suggested Questions:
                </p>
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(prompt)}
                    className="w-full text-left text-xs p-3 rounded-xl glass-panel-subtle hover:bg-slate-800/80 hover:border-emerald-500/40 transition-all text-slate-300 flex items-center justify-between group"
                  >
                    <span className="truncate mr-2">{prompt}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl flex flex-col ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm shadow-md"
                          : "glass-panel-subtle text-slate-100 rounded-bl-sm border border-slate-800"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Assistant Metadata Chips */}
                      {!isUser && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                          {msg.cacheHit && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold">
                              <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                              Cached Hit (Cosine &gt; 0.92)
                            </span>
                          )}

                          {msg.latencyMs !== undefined && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {msg.latencyMs}ms
                            </span>
                          )}

                          {msg.citations && msg.citations.length > 0 && (
                            <button
                              onClick={() => setActiveSourceDrawer(msg.citations || [])}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium transition-colors"
                            >
                              <BookOpen className="w-3 h-3" />
                              {msg.citations.length} Cited Sources
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Source citation pill previews */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.citations.map((c, i) => (
                          <span
                            key={i}
                            onClick={() => setActiveSourceDrawer([c])}
                            className="cursor-pointer text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-slate-700 transition-colors"
                          >
                            📄 {c.source} (p.{c.page})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                documents.length === 0
                  ? "Upload a document above to start chatting..."
                  : "Ask anything about your documents..."
              }
              disabled={streaming}
              className="flex-1 bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Sources & Cited Chunks Drawer */}
        {activeSourceDrawer && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-96 glass-panel border-l border-slate-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Cited Evidence ({activeSourceDrawer.length})
                </h3>
              </div>
              <button
                onClick={() => setActiveSourceDrawer(null)}
                className="text-xs text-slate-400 hover:text-slate-200 p-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeSourceDrawer.map((citation, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 truncate">
                      {citation.source}
                    </span>
                    <span className="text-slate-400 text-[11px]">Page {citation.page}</span>
                  </div>

                  {citation.score !== undefined && (
                    <div className="text-[10px] text-slate-400">
                      RRF Relevance Score:{" "}
                      <span className="text-emerald-400 font-mono font-medium">
                        {citation.score}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                    &ldquo;{citation.snippet || "Retrieved passage"}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
