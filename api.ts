import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

export interface Document {
  id: string;
  filename: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "failed";
  num_chunks: number;
  created_at: string;
  error_message?: string | null;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface Citation {
  document_id: string;
  document_name: string;
  chunk_id: string;
  content: string;
  score: number;
}

export interface AskResponse {
  question: string;
  answer: string;
  citations: Citation[];
  used_llm: boolean;
  model?: string | null;
}

export interface Stats {
  total_documents: number;
  ready_documents: number;
  total_chunks: number;
  total_size_bytes: number;
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<Document>("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listDocuments(): Promise<Document[]> {
  const { data } = await api.get<Document[]>("/documents");
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}

export async function getStats(): Promise<Stats> {
  const { data } = await api.get<Stats>("/documents/stats");
  return data;
}

export async function semanticSearch(
  query: string,
  topK = 5,
  documentIds?: string[]
): Promise<{ query: string; results: SearchResult[]; total: number }> {
  const { data } = await api.post("/search", {
    query,
    top_k: topK,
    document_ids: documentIds,
  });
  return data;
}

export async function askQuestion(
  question: string,
  topK = 5,
  documentIds?: string[],
  useLlm = true
): Promise<AskResponse> {
  const { data } = await api.post<AskResponse>("/ask", {
    question,
    top_k: topK,
    document_ids: documentIds,
    use_llm: useLlm,
  });
  return data;
}

export async function healthCheck() {
  const { data } = await api.get("/health");
  return data;
}