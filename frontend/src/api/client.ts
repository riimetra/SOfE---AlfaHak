export type Status =
  | "DRAFT" | "SUBMITTED" | "VALIDATION" | "INFO_REQUESTED" | "ENRICHMENT" | "SCORING"
  | "UNDERWRITING" | "APPROVED" | "COUNTER_OFFER" | "REJECTED" | "SIGNING" | "ISSUED"
  | "CANCELLED";

export const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлена",
  VALIDATION: "Проверка данных",
  INFO_REQUESTED: "Нужны уточнения",
  ENRICHMENT: "Сбор сведений",
  SCORING: "Оценка риска",
  UNDERWRITING: "Рассматривает специалист",
  APPROVED: "Одобрено",
  COUNTER_OFFER: "Одобрено на других условиях",
  REJECTED: "Отказ",
  SIGNING: "Подписание документов",
  ISSUED: "Средства выданы",
  CANCELLED: "Отозвана",
};

export interface Company {
  id: string;
  inn: string;
  name: string;
  legal_form: string;
  annual_revenue: string | null;
}

export interface Product {
  code: string;
  name: string;
  description: string;
  min_amount: string;
  max_amount: string;
  min_term_months: number;
  max_term_months: number;
  base_rate: string;
  purposes: string[];
}

export interface AppEvent {
  from_status: Status | null;
  to_status: Status;
  actor: string;
  comment: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  company_id: string;
  product_code: string;
  status: Status;
  amount: string;
  term_months: number;
  purpose: string;
  score: number | null;
  decision: { amount: number | null; term_months: number | null; rate: number | null; reason: string } | null;
  created_at: string;
  events?: AppEvent[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${resp.status}`);
  }
  return resp.json();
}

export const api = {
  companies: () => request<Company[]>("/companies"),
  products: () => request<Product[]>("/products"),
  applications: (companyId?: string) =>
    request<Application[]>(`/applications${companyId ? `?company_id=${companyId}` : ""}`),
  application: (id: string) => request<Application>(`/applications/${id}`),
  create: (body: Omit<Application, "id" | "status" | "score" | "decision" | "created_at">) =>
    request<Application>("/applications", { method: "POST", body: JSON.stringify(body) }),
  action: (id: string, action: "submit" | "accept" | "sign" | "cancel") =>
    request<Application>(`/applications/${id}/${action}`, { method: "POST" }),
};
