import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Application, STATUS_LABELS } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.application(id!).then(setApp);
  }, [id]);

  useEffect(load, [load]);

  async function act(action: "submit" | "accept" | "sign" | "cancel") {
    setError("");
    try {
      await api.action(id!, action);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!app) return <p>Загрузка…</p>;
  const s = app.status;

  return (
    <section>
      <h1>Заявка · {app.product_code} <StatusBadge status={s} /></h1>
      <p>
        {Number(app.amount).toLocaleString("ru")} ₽ на {app.term_months} мес. — {app.purpose}
      </p>

      {app.decision && (
        <div className="decision">
          {app.decision.amount && (
            <p>
              Предложение банка: <b>{app.decision.amount.toLocaleString("ru")} ₽</b>,{" "}
              {app.decision.term_months} мес., ставка {app.decision.rate}%
            </p>
          )}
          {app.decision.reason && <p>{app.decision.reason}</p>}
        </div>
      )}

      <div className="actions">
        {(s === "DRAFT" || s === "INFO_REQUESTED") && (
          <button onClick={() => act("submit")}>Отправить в банк</button>
        )}
        {(s === "APPROVED" || s === "COUNTER_OFFER") && (
          <button onClick={() => act("accept")}>Принять предложение</button>
        )}
        {s === "SIGNING" && <button onClick={() => act("sign")}>Подписать документы</button>}
        {["DRAFT", "INFO_REQUESTED", "APPROVED", "COUNTER_OFFER", "SIGNING"].includes(s) && (
          <button className="secondary" onClick={() => act("cancel")}>Отозвать</button>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      <h2>История</h2>
      <ol className="timeline">
        {app.events?.map((e, i) => (
          <li key={i}>
            <time>{new Date(e.created_at).toLocaleString("ru")}</time>{" "}
            {STATUS_LABELS[e.to_status]}
            {e.comment && <small> — {e.comment}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}
