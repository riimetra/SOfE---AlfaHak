import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Application } from "../api/client";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard({ companyId }: { companyId: string }) {
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => {
    if (companyId) api.applications(companyId).then(setApps);
  }, [companyId]);

  return (
    <section>
      <h1>Мои заявки</h1>
      {apps.length === 0 && (
        <p>Заявок пока нет. <Link to="/new">Подобрать кредит</Link></p>
      )}
      <ul className="cards">
        {apps.map((a) => (
          <li key={a.id}>
            <Link to={`/applications/${a.id}`}>
              <b>{a.product_code}</b> · {Number(a.amount).toLocaleString("ru")} ₽ · {a.term_months} мес.
            </Link>
            <StatusBadge status={a.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
