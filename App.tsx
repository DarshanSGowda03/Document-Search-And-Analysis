import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Upload,
  Search,
  MessageSquare,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
} from "lucide-react";
import type { Document, Stats, SearchResult, AskResponse } from "./api";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  getStats,
  semanticSearch,
  askQuestion,
  healthCheck,
} from "./api";

import "./App.css";

type Tab = "documents" | "search" | "ask";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Document["status"] }) {
  if (status === "ready")
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={12} /> Ready
      </span>
    );
  if (status === "processing")
    return (
      <span className="badge badge-warning">
        <Loader2 size={12} className="spin" /> Processing
      </span>
    );
  return (
    <span className="badge badge-error">
      <AlertCircle size={12} /> Failed
    </span>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("documents");
  const [docs, setDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [asking, setAsking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [d, s, h] = await Promise.all([
        listDocuments(),
        getStats(),
        healthCheck().catch(() => null),
      ]);
      setDocs(d);
      setStats(s);
      if (h) setLlmAvailable(!!h.llm_available);
    } catch (e: any) {
      setError(e?.message || "Failed to load data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      await uploadDocument(file);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this document and all its chunks?")) return;
    try {
      await deleteDocument(id);
      await refresh();
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  const onSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      setError(null);
      const res = await semanticSearch(searchQuery.trim(), 8);
      setSearchResults(res.results);
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const onAsk = async () => {
    if (!question.trim()) return;
    try {
      setAsking(true);
      setError(null);
      setAnswer(null);
      const res = await askQuestion(question.trim(), 6, undefined, true);
      setAnswer(res);
    } catch (err: any) {
      setError(err.message || "Ask failed");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Database size={28} />
          <div>
            <h1>Document Analysis & Search</h1>
            <p className="subtitle">
              RAG · Semantic Search · Enterprise API
              {llmAvailable ? (
                <span className="llm-on"> · LLM enabled</span>
              ) : (
                <span className="llm-off">
                  {" "}
                  · Extractive mode (set OPENAI_API_KEY for full answers)
                </span>
              )}
            </p>
          </div>
        </div>
        <nav className="tabs">
          <button
            className={tab === "documents" ? "active" : ""}
            onClick={() => setTab("documents")}
          >
            <FileText size={16} /> Documents
          </button>
          <button
            className={tab === "search" ? "active" : ""}
            onClick={() => setTab("search")}
          >
            <Search size={16} /> Search
          </button>
          <button
            className={tab === "ask" ? "active" : ""}
            onClick={() => setTab("ask")}
          >
            <MessageSquare size={16} /> Ask
          </button>
        </nav>
      </header>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <main className="main">
        {tab === "documents" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Your Documents</h2>
              <label className="btn btn-primary">
                {uploading ? (
                  <>
                    <Loader2 size={16} className="spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Upload PDF / DOCX / TXT
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.docx,.doc"
                  hidden
                  disabled={uploading}
                  onChange={onUpload}
                />
              </label>
            </div>

            {stats && (
              <div className="stats-grid">
                <div className="stat">
                  <span className="stat-value">{stats.total_documents}</span>
                  <span className="stat-label">Documents</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{stats.ready_documents}</span>
                  <span className="stat-label">Ready</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{stats.total_chunks}</span>
                  <span className="stat-label">Chunks</span>
                </div>
                <div className="stat">
                  <span className="stat-value">
                    {formatBytes(stats.total_size_bytes)}
                  </span>
                  <span className="stat-label">Total size</span>
                </div>
              </div>
            )}

            {loading && docs.length === 0 ? (
              <div className="empty">
                <Loader2 className="spin" size={32} /> Loading…
              </div>
            ) : docs.length === 0 ? (
              <div className="empty">
                <FileText size={48} strokeWidth={1} />
                <p>
                  No documents yet. Upload a PDF, Word file, or text document to
                  get started.
                </p>
              </div>
            ) : (
              <div className="doc-list">
                {docs.map((d) => (
                  <div key={d.id} className="doc-card">
                    <div className="doc-info">
                      <FileText size={20} />
                      <div>
                        <div className="doc-name">{d.original_name}</div>
                        <div className="doc-meta">
                          {formatBytes(d.size_bytes)} · {d.num_chunks} chunks ·{" "}
                          {new Date(d.created_at).toLocaleString()}
                        </div>
                        {d.error_message && (
                          <div className="doc-error">{d.error_message}</div>
                        )}
                      </div>
                    </div>
                    <div className="doc-actions">
                      <StatusBadge status={d.status} />
                      <button
                        className="btn-icon"
                        title="Delete"
                        onClick={() => onDelete(d.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "search" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Semantic Search</h2>
            </div>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search across all documents…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
              <button
                className="btn btn-primary"
                onClick={onSearch}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Search size={16} />
                )}
                Search
              </button>
            </div>

            <div className="results">
              {searchResults.length === 0 && !searching && (
                <div className="empty">
                  <Search size={40} strokeWidth={1} />
                  <p>
                    Enter a query to find relevant passages across your
                    documents.
                  </p>
                </div>
              )}
              {searchResults.map((r) => (
                <div key={r.chunk_id} className="result-card">
                  <div className="result-header">
                    <span className="result-doc">{r.document_name}</span>
                    <span className="result-score">
                      {(r.score * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="result-content">{r.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "ask" && (
          <section className="panel">
            <div className="panel-header">
              <h2>
                <Sparkles size={20} /> Ask your documents
              </h2>
            </div>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Ask a question about your documents…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAsk()}
              />
              <button
                className="btn btn-primary"
                onClick={onAsk}
                disabled={asking}
              >
                {asking ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <MessageSquare size={16} />
                )}
                Ask
              </button>
            </div>

            {answer && (
              <div className="answer-box">
                <div className="answer-meta">
                  {answer.used_llm ? (
                    <span className="badge badge-success">
                      Generated with {answer.model}
                    </span>
                  ) : (
                    <span className="badge badge-warning">
                      Extractive (no LLM key)
                    </span>
                  )}
                </div>
                <div className="answer-text">{answer.answer}</div>

                {answer.citations.length > 0 && (
                  <div className="citations">
                    <h3>Sources</h3>
                    {answer.citations.map((c) => (
                      <div key={c.chunk_id} className="citation">
                        <div className="citation-header">
                          <strong>{c.document_name}</strong>
                          <span>{(c.score * 100).toFixed(0)}%</span>
                        </div>
                        <p>
                          {c.content.slice(0, 300)}
                          {c.content.length > 300 ? "…" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!answer && !asking && (
              <div className="empty">
                <MessageSquare size={40} strokeWidth={1} />
                <p>
                  Ask natural language questions. With an OpenAI key the system
                  generates grounded answers; otherwise it returns the most
                  relevant excerpts.
                </p>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        Document Analysis & Search System · FastAPI + React · RAG with
        sentence-transformers + ChromaDB
      </footer>
    </div>
  );
}
