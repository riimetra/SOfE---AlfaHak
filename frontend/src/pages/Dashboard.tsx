import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Application, User } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import Spinner from "../components/Spinner";
import { NEXT_STEP } from "../components/nextStep";
import { dateTime, money } from "../utils";

export default function Dashboard({ user }: { user: User }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.applications().then(setApps).catch((e) => setError(e.message));
  }, []);

  const c = user.company;
  return (
    <section>
      <div className="page-head">
        <h1>Мои заявки</h1>
        <Link to="/new" className="button">Получить кредит</Link>
      </div>

      {c && (
        <div className="card company">
          <div><span className="muted small">Компания</span><b>{c.name}</b></div>
          <div><span className="muted small">ИНН</span>{c.inn}</div>
          <div><span className="muted small">ОКВЭД</span>{c.okved ?? "—"}</div>
          <div><span className="muted small">Выручка за год</span>{money(c.annual_revenue)}</div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {!apps && !error && <Spinner />}
      {apps?.length === 0 && (
        <div className="card empty">
          <p>Заявок пока нет.</p>
          <p className="muted">Расскажите, на что нужны деньги, — подберём подходящий кредит.</p>
          <Link to="/new" className="button">Подобрать кредит</Link>
        </div>
      )}
      <ul className="cards">
        {apps?.map((a) => (
          <li key={a.id}>
            <Link to={`/applications/${a.id}`} className="app-card">
              <div className="app-card-main">
                <b>{a.product.name}</b>
                <span>{money(a.amount)} · {a.term_months} мес. · {a.purpose}</span>
                <span className="muted small">{NEXT_STEP[a.status]}</span>
              </div>
              <div className="app-card-side">
                <StatusBadge status={a.status} />
                <span className="muted small">{dateTime(a.updated_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
