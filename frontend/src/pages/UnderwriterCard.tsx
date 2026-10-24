import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Application, Company, UnderwriterDecisionInput } from "../api/client";
import Factors from "../components/Factors";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import Timeline from "../components/Timeline";
import { annuity, money } from "../utils";

const LABELS: Record<string, string> = {
  found: "Найдено",
  closed_loans_count: "Закрытых кредитов",
  active_loans_count: "Действующих кредитов",
  current_debt: "Текущий долг, ₽",
  overdue_days_max: "Макс. просрочка, дней",
  status: "Статус",
  registration_date: "Дата регистрации",
  age_months: "Возраст бизнеса, мес.",
  director: "Руководитель",
  tax_debt: "Налоговая задолженность, ₽",
  employees: "Сотрудников",
  okved_main: "Основной ОКВЭД",
  mass_address: "Массовый адрес",
};
const SOURCES: [string, string][] = [["bki", "Бюро кредитных историй"], ["egrul", "ЕГРЮЛ / ЕГРИП"], ["fns", "ФНС «Прозрачный бизнес»"]];

function fmt(v: unknown): string {
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (typeof v === "number") return v.toLocaleString("ru-RU");
  return String(v ?? "—");
}

export default function UnderwriterCard() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.application(id!).then((a) => {
      setApp(a);
      api.companies().then((cs) => setCompany(cs.find((c) => c.id === a.company_id) ?? null)).catch(() => undefined);
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (!app) return error ? <p className="error">{error}</p> : <Spinner />;
  const d = app.decision;
  const e = app.enrichment ?? {};
  const revenue = Number(company?.annual_revenue ?? 0);
  const debt = Number((e.bki?.current_debt as number) ?? 0);
  const load_ = revenue ? (Number(app.amount) + debt) / revenue : null;

  return (
    <section>
      <p><Link to="/">← Очередь заявок</Link></p>
      <div className="page-head">
        <h1>{app.company.name}</h1>
        <StatusBadge status={app.status} />
      </div>

      <div className="two-col">
        <div className="card">
          <h2>Заявка</h2>
          <dl className="kv">
            <dt>Продукт</dt><dd>{app.product.name}</dd>
            <dt>Сумма</dt><dd>{money(app.amount)}</dd>
            <dt>Срок</dt><dd>{app.term_months} мес.</dd>
            <dt>Цель</dt><dd>{app.purpose}</dd>
            <dt>ИНН</dt><dd>{app.company.inn}</dd>
            <dt>ОКВЭД</dt><dd>{company?.okved ?? "—"}</dd>
            <dt>Выручка за год</dt><dd>{money(company?.annual_revenue)}</dd>
            <dt>Долговая нагрузка</dt>
            <dd>{load_ == null ? "—" : `${(load_ * 100).toFixed(0)}% выручки`} <span className="muted small">(сумма + текущий долг)</span></dd>
          </dl>
        </div>
        <div className="card">
          <h2>Скоринг</h2>
          <div className="big-number">{app.score ?? "—"} <span className="muted small">из 1000</span></div>
          <p className="muted small">Одобрение ≥ 600 · контрпредложение 450–599 · отказ &lt; 450</p>
          {d?.factors ? <Factors factors={d.factors} /> : <p className="muted">Скоринг не проводился.</p>}
          {d?.reason && <p><b>Причина:</b> {d.reason}</p>}
        </div>
      </div>

      <div className="card">
        <h2>Данные внешних источников</h2>
        {"error" in e && <p className="warn">{String(e.error)} — проверьте сведения вручную.</p>}
        <div className="sources">
          {SOURCES.map(([key, title]) => (
            <div key={key} className="source">
              <h3>{title}</h3>
              {e[key] ? (
                <dl className="kv small">
                  {Object.entries(e[key]).filter(([k]) => !["inn", "source"].includes(k)).map(([k, v]) => (
                    <Fragment key={k}><dt>{LABELS[k] ?? k}</dt><dd>{fmt(v)}</dd></Fragment>
                  ))}
                </dl>
              ) : <p className="muted small">Нет данных</p>}
            </div>
          ))}
        </div>
      </div>

      {app.status === "UNDERWRITING" && <DecisionForm app={app} onDone={setApp} />}
      {d?.decided_by === "underwriter" && app.status !== "UNDERWRITING" && (
        <div className="card"><b>Решение специалиста:</b> {d.underwriter}
          {d.amount && <> — {money(d.amount)}, {d.term_months} мес., {d.rate}%</>}
          {d.reason && <p>{d.reason}</p>}
        </div>
      )}

      <div className="card">
        <h2>История</h2>
        <Timeline events={app.events ?? []} />
      </div>
    </section>
  );
}

function DecisionForm({ app, onDone }: { app: Application; onDone: (a: Application) => void }) {
  const [status, setStatus] = useState<UnderwriterDecisionInput["status"]>("APPROVED");
  const [amount, setAmount] = useState(Number(app.amount));
  const [term, setTerm] = useState(app.term_months);
  const [rate, setRate] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.products().then((ps) => setRate(Number(ps.find((p) => p.code === app.product_code)?.base_rate ?? 0)));
  }, [app.product_code]);

  const withTerms = status === "APPROVED" || status === "COUNTER_OFFER";
  const needsComment = status === "REJECTED" || status === "INFO_REQUESTED";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: UnderwriterDecisionInput = { status, comment: comment || undefined };
      if (withTerms) Object.assign(body, { amount, term_months: term, rate });
      onDone(await api.underwriterDecision(app.id, body));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const options: [UnderwriterDecisionInput["status"], string][] = [
    ["APPROVED", "Одобрить"], ["COUNTER_OFFER", "Контрпредложение"],
    ["INFO_REQUESTED", "Запросить уточнения"], ["REJECTED", "Отказать"],
  ];

  return (
    <form className="card decision-form" onSubmit={submit}>
      <h2>Решение по заявке</h2>
      <div className="segmented">
        {options.map(([v, t]) => (
          <label key={v} className={status === v ? "active" : ""}>
            <input type="radio" name="decision" value={v} checked={status === v} onChange={() => setStatus(v)} />
            {t}
          </label>
        ))}
      </div>
      {withTerms && (
        <div className="form-row">
          <label>Сумма, ₽<input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></label>
          <label>Срок, мес.<input type="number" value={term || ""} onChange={(e) => setTerm(Number(e.target.value))} /></label>
          <label>Ставка, %<input type="number" step="0.1" value={rate || ""} onChange={(e) => setRate(Number(e.target.value))} /></label>
          <div className="muted small">Платёж: {money(annuity(amount, rate, term))} / мес.</div>
        </div>
      )}
      <label>
        Комментарий для клиента {needsComment ? "(обязательно)" : "(необязательно)"}
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} required={needsComment}
          placeholder={status === "INFO_REQUESTED" ? "Например: уменьшите сумму до 9 млн ₽ или укажите другую цель" : ""} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Принять решение"}</button>
    </form>
  );
}
