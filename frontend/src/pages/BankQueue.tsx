import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Application } from "../api/client";
import StatusBadge from "../components/StatusBadge";

// TODO: рабочее место андеррайтера — фильтры, карточка заявки с данными БКИ/ЕГРЮЛ/ФНС, решение
export default function BankQueue() {
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => {
    api.applications().then(setApps);
  }, []);

  return (
    <section>
      <h1>Очередь заявок (банк)</h1>
      <table>
        <thead>
          <tr><th>Создана</th><th>Продукт</th><th>Сумма</th><th>Скор</th><th>Статус</th></tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td><Link to={`/applications/${a.id}`}>{new Date(a.created_at).toLocaleString("ru")}</Link></td>
              <td>{a.product_code}</td>
              <td>{Number(a.amount).toLocaleString("ru")} ₽</td>
              <td>{a.score ?? "—"}</td>
              <td><StatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
