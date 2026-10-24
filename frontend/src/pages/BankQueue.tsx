import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Application, Status } from "../api/client";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { dateTime, money } from "../utils";

const TABS: { key: string; title: string; statuses: Status[] | null }[] = [
  { key: "review", title: "Требуют решения", statuses: ["UNDERWRITING"] },
  { key: "client", title: "Ждут клиента", statuses: ["INFO_REQUESTED", "APPROVED", "COUNTER_OFFER", "SIGNING", "DRAFT"] },
  { key: "done", title: "Завершённые", statuses: ["ISSUED", "REJECTED", "CANCELLED"] },
  { key: "all", title: "Все", statuses: null },
];

export default function BankQueue() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [tab, setTab] = useState("review");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => api.applications().then(setApps).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!apps) return error ? <p className="error">{error}</p> : <Spinner />;

  const count = (st: Status[] | null) => apps.filter((a) => !st || st.includes(a.status)).length;
  const current = TABS.find((t) => t.key === tab)!;
  const q = query.trim().toLowerCase();
  const rows = apps
    .filter((a) => !current.statuses || current.statuses.includes(a.status))
    .filter((a) => !q || a.company.name.toLowerCase().includes(q) || a.company.inn.includes(q));

  return (
    <section>
      <div className="page-head">
        <h1>Очередь заявок</h1>
        <input className="search" placeholder="Поиск по названию или ИНН" value={query}
          onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.title} <span className="count">{count(t.statuses)}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card empty"><p className="muted">
          {tab === "review" ? "Нет заявок на ручном разборе. Они появятся, когда клиент запросит от 10 млн ₽ или внешний источник будет недоступен." : "Заявок нет."}
        </p></div>
      ) : (
        <div className="table-wrap">
          <table className="clickable">
            <thead>
              <tr><th>Обновлена</th><th>Клиент</th><th>Продукт</th><th>Сумма</th><th>Скор</th><th>Статус</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} onClick={() => navigate(`/bank/applications/${a.id}`)} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/bank/applications/${a.id}`)}>
                  <td>{dateTime(a.updated_at)}</td>
                  <td><b>{a.company.name}</b><div className="muted small">ИНН {a.company.inn}</div></td>
                  <td>{a.product.name}</td>
                  <td>{money(a.amount)}<div className="muted small">{a.term_months} мес.</div></td>
                  <td>{a.score ?? "—"}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
