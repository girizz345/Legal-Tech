const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "advocate" | "admin";
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export async function register(payload: RegisterPayload): Promise<CurrentUser> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, role: "user" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "Login failed");
  }
  return res.json();
}

export async function getCurrentUser(token: string): Promise<CurrentUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// ── Token helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "legal_tech_token";
export function saveToken(token: string): void { localStorage.setItem(TOKEN_KEY, token); }
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken(): void { localStorage.removeItem(TOKEN_KEY); }

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function authedFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const isFormData = init.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  return res;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface TemplateSummary { id: string; key: string; name: string; version: number; }

export interface FieldSchema {
  id: string; label: string; type: "text" | "select" | "date" | "number";
  required?: boolean; options?: string[]; min?: number; max?: number;
  max_length?: number; help_text?: string;
}
export interface SectionSchema { id: string; title: string; }
export interface TemplateDetail extends TemplateSummary {
  schema_json: { fields: FieldSchema[]; sections: SectionSchema[]; };
}

export async function listTemplates(token: string): Promise<TemplateSummary[]> {
  return (await authedFetch("/templates/", token)).json();
}
export async function getTemplate(token: string, id: string): Promise<TemplateDetail> {
  return (await authedFetch(`/templates/${id}`, token)).json();
}

// ── Documents / Contracts ─────────────────────────────────────────────────────

export interface SectionDraft {
  section_id: string; title: string; variant_id: string; resolution: string;
  body_text: string; note_text: string; classifier_score: number;
}
export interface GenerateDocumentResponse {
  contract_id: string; status: string; sections: SectionDraft[];
}
export interface ContractDetail extends GenerateDocumentResponse {
  template_id: string; answers: Record<string, string>;
}
export interface ContractSummary {
  contract_id: string; source: "generated" | "uploaded"; status: string;
  template_id: string | null; created_at: string;
}

export async function listContracts(token: string): Promise<ContractSummary[]> {
  return (await authedFetch("/documents/", token)).json();
}
export async function generateDocument(
  token: string, templateId: string, answers: Record<string, unknown>
): Promise<GenerateDocumentResponse> {
  return (await authedFetch("/documents/generate", token, {
    method: "POST",
    body: JSON.stringify({ template_id: templateId, answers }),
  })).json();
}
export async function getContract(token: string, contractId: string): Promise<ContractDetail> {
  return (await authedFetch(`/documents/${contractId}`, token)).json();
}
export async function updateAnswers(
  token: string, contractId: string, answers: Record<string, unknown>
): Promise<GenerateDocumentResponse> {
  return (await authedFetch(`/documents/${contractId}/answers`, token, {
    method: "PUT",
    body: JSON.stringify({ answers }),
  })).json();
}
export async function downloadFile(token: string, contractId: string, format: "pdf" | "docx"): Promise<void> {
  const res = await authedFetch(`/documents/${contractId}/download?format=${format}`, token);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `contract.${format}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── Uploads ───────────────────────────────────────────────────────────────────

export interface ExtractedTerm { key: string; value: string | null; confidence: number; }
export interface UploadResult {
  upload_id: string; contract_id: string; status: string;
  filename: string; ocr_excerpt: string; extracted_terms: ExtractedTerm[];
}

export async function uploadContract(token: string, file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  return (await authedFetch("/uploads/contract", token, { method: "POST", body: fd })).json();
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export type ReviewState = "requested" | "assigned" | "in_review" | "returned" | "closed";

export interface ReviewSummary {
  id: string; contract_id: string | null; user_id: string;
  advocate_id: string | null; entity_id: string; state: ReviewState;
  requested_at: string; returned_at: string | null; note: string | null;
}

export async function createReview(token: string, contractId?: string): Promise<ReviewSummary> {
  return (await authedFetch("/reviews/", token, {
    method: "POST",
    body: JSON.stringify({ contract_id: contractId ?? null }),
  })).json();
}
export async function listReviews(token: string): Promise<ReviewSummary[]> {
  return (await authedFetch("/reviews/", token)).json();
}
export async function getReview(token: string, reviewId: string): Promise<ReviewSummary> {
  return (await authedFetch(`/reviews/${reviewId}`, token)).json();
}
export async function assignReview(token: string, reviewId: string, advocateId: string): Promise<ReviewSummary> {
  return (await authedFetch(`/reviews/${reviewId}/assign`, token, {
    method: "PATCH",
    body: JSON.stringify({ advocate_id: advocateId }),
  })).json();
}
export async function updateReviewState(
  token: string, reviewId: string, state: ReviewState, note?: string
): Promise<ReviewSummary> {
  return (await authedFetch(`/reviews/${reviewId}/state`, token, {
    method: "PATCH",
    body: JSON.stringify({ state, note: note ?? null }),
  })).json();
}
export async function uploadArtifact(
  token: string, reviewId: string, kind: "markup" | "answer",
  file?: File, content?: string
): Promise<unknown> {
  const fd = new FormData();
  fd.append("kind", kind);
  if (file) fd.append("file", file);
  if (content) fd.append("content", content);
  return (await authedFetch(`/reviews/${reviewId}/artifacts`, token, { method: "POST", body: fd })).json();
}
export async function listArtifacts(token: string, reviewId: string): Promise<unknown[]> {
  return (await authedFetch(`/reviews/${reviewId}/artifacts`, token)).json();
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export interface ObligationSummary {
  id: string; contract_id: string; type: string;
  due_date: string | null; notice_days: number | null;
  status: string; days_until_due: number | null;
}

export async function listReminders(token: string, lookaheadDays = 30): Promise<ObligationSummary[]> {
  return (await authedFetch(`/reminders/?lookahead_days=${lookaheadDays}`, token)).json();
}
export async function dismissObligation(token: string, obligationId: string): Promise<void> {
  await authedFetch(`/reminders/${obligationId}/dismiss`, token, { method: "PATCH" });
}
export async function createObligation(
  token: string, contractId: string, type: string, dueDate: string, noticeDays?: number
): Promise<ObligationSummary> {
  return (await authedFetch("/reminders/", token, {
    method: "POST",
    body: JSON.stringify({ contract_id: contractId, type, due_date: dueDate, notice_days: noticeDays }),
  })).json();
}

// ── Explainer chat ────────────────────────────────────────────────────────────

export interface ExplainResponse {
  decision: "answer" | "route_to_advocate";
  confidence: number;
  answer?: string;
  source_clause?: string;
  route_reason?: string;
}

export async function explainClause(
  token: string, question: string, contractId?: string, clauseText?: string
): Promise<ExplainResponse> {
  return (await authedFetch("/ai/explain", token, {
    method: "POST",
    body: JSON.stringify({ question, contract_id: contractId ?? null, clause_text: clauseText ?? null }),
  })).json();
}

// ── Entities ──────────────────────────────────────────────────────────────────

export interface EntitySummary { id: string; name: string; kind: "tech_co" | "firm"; created_at: string; }

export async function listEntities(token: string): Promise<EntitySummary[]> {
  return (await authedFetch("/entities/", token)).json();
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface Subscription { id: string; user_id: string; plan: string; status: string; }
export interface LegalFee { id: string; review_id: string; entity_id: string; amount: number; status: string; }

export async function listSubscriptions(token: string): Promise<Subscription[]> {
  return (await authedFetch("/billing/subscriptions/", token)).json();
}
export async function listFees(token: string): Promise<LegalFee[]> {
  return (await authedFetch("/billing/fees/", token)).json();
}
