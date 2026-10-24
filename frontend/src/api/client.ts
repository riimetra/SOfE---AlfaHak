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

export const ACTOR_LABELS: Record<string, string> = {
  client: "Клиент",
  system: "Система",
  underwriter: "Специалист банка",
};

export interface Company {
  id: string;
  inn: string;
  name: string;
  legal_form: string;
  okved: string | null;
  annual_revenue: string | null;
}

export interface User {
  id: string;
  login: string;
  full_name: string;
  position: string | null;
  role: "client" | "underwriter";
  company: Company | null;
}

export interface DemoAccount {
  login: string;
  password: string;
  role: string;
  full_name: string;
  position: string | null;
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

export interface Decision {
  amount?: number | null;
  term_months?: number | null;
  rate?: number | null;
  monthly_payment?: number | null;
  reason?: string;
  factors?: [string, number][];
  decided_by?: "system" | "underwriter";
  underwriter?: string;
}

export interface Application {
  id: string;
  company_id: string;
  company: { id: string; inn: string; name: string };
  product_code: string;
  product: { code: string; name: string };
  status: Status;
  amount: string;
  term_months: number;
  purpose: string;
  score: number | null;
  decision: Decision | null;
  created_at: string;
  updated_at: string;
  enrichment?: Record<string, Record<string, unknown>>;
  events?: AppEvent[];
}

export interface ApplicationInput {
  product_code: string;
  amount: number;
  term_months: number;
  purpose: string;
}

export interface UnderwriterDecisionInput {
  status: "APPROVED" | "COUNTER_OFFER" | "REJECTED" | "INFO_REQUESTED";
  comment?: string;
  amount?: number;
  term_months?: number;
  rate?: number;
}

const TOKEN_KEY = "credit.token";

export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* приватный режим браузера — токен живёт до перезагрузки */ }
  },
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function errorText(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string }) => (d.msg ?? "").replace(/^Value error, /, ""))
      .join("; ");
  }
  return `Ошибка ${status}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const resp = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    if (resp.status === 401 && token) {
      tokenStore.set(null);
      window.dispatchEvent(new Event("auth:logout"));
    }
    throw new ApiError(errorText(body.detail, resp.status), resp.status);
  }
  return resp.json();
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  login: (login: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST", body: json({ login, password }),
    }),
  me: () => request<User>("/auth/me"),
  demoAccounts: () => request<DemoAccount[]>("/auth/demo-accounts"),

  products: () => request<Product[]>("/products"),
  companies: () => request<Company[]>("/companies"),
  applications: (status?: Status) =>
    request<Application[]>(`/applications${status ? `?status=${status}` : ""}`),
  application: (id: string) => request<Application>(`/applications/${id}`),
  create: (body: ApplicationInput) =>
    request<Application>("/applications", { method: "POST", body: json(body) }),
  update: (id: string, body: Partial<ApplicationInput>) =>
    request<Application>(`/applications/${id}`, { method: "PATCH", body: json(body) }),
  action: (id: string, action: "submit" | "accept" | "sign" | "cancel") =>
    request<Application>(`/applications/${id}/${action}`, { method: "POST" }),
  underwriterDecision: (id: string, body: UnderwriterDecisionInput) =>
    request<Application>(`/applications/${id}/underwriter-decision`, {
      method: "POST", body: json(body),
    }),
};
