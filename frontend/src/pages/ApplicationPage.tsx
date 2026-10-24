import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Application, Product } from "../api/client";
import Factors from "../components/Factors";
import { IN_PROGRESS, NEXT_STEP } from "../components/nextStep";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import Stepper from "../components/Stepper";
import Timeline from "../components/Timeline";
import { money, schedule } from "../utils";

type Action = "submit" | "accept" | "sign" | "cancel";

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.application(id!).then(setApp).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (app && !product) api.products().then((ps) => setProduct(ps.find((p) => p.code === app.product_code) ?? null));
  }, [app, product]);

  // Пока заявку обрабатывает банк — обновляем статус автоматически
  useEffect(() => {
    if (!app || !IN_PROGRESS.includes(app.status)) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [app, load]);

  async function act(action: Action) {
    if (action === "cancel" && !window.confirm("Отозвать заявку?")) return;
    setBusy(true);
    setError("");
    try {
      setApp(await api.action(id!, action));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!app) return error ? <p className="error">{error}</p> : <Spinner />;
  const s = app.status;
  const d = app.decision;
  const bankRequest = s === "INFO_REQUESTED" ? [...(app.events ?? [])].reverse().find((e) => e.to_status === "INFO_REQUESTED")?.comment : null;
  const hasOffer = d?.amount && d.term_months && d.rate;
  const showFactors = d?.factors && ["APPROVED", "COUNTER_OFFER", "REJECTED"].includes(s);

  return (
    <section>
      <p><Link to="/">← Мои заявки</Link></p>
      <div className="page-head">
        <h1>{app.product.name}</h1>
        <StatusBadge status={s} />
      </div>
      <Stepper status={s} />

      <div className={`card next next-${s.toLowerCase()}`}>
        <b>Что дальше</b>
        <p>{NEXT_STEP[s]}</p>
        {bankRequest && <p className="bank-request"><b>Банк просит:</b> {bankRequest}</p>}
        {d?.reason && ["REJECTED", "COUNTER_OFFER", "UNDERWRITING"].includes(s) && (
          <p><b>Комментарий банка:</b> {d.reason}</p>
        )}
      </div>

      {(s === "DRAFT" || s === "INFO_REQUESTED") && (
        <EditForm app={app} product={product} busy={busy} onSaved={setApp} onSubmit={() => act("submit")} />
      )}

      {hasOffer && ["APPROVED", "COUNTER_OFFER", "SIGNING", "ISSUED"].includes(s) && (
        <div className="card offer">
          <h2>{s === "ISSUED" ? "Условия кредита" : "Предложение банка"}</h2>
          <div className="offer-grid">
            <div><span className="muted small">Сумма</span><b>{money(d!.amount)}</b>
              {Number(app.amount) !== d!.amount && <span className="muted small">запрошено {money(app.amount)}</span>}</div>
            <div><span className="muted small">Срок</span><b>{d!.term_months} мес.</b></div>
            <div><span className="muted small">Ставка</span><b>{d!.rate}% годовых</b></div>
            <div><span className="muted small">Платёж в месяц</span><b>{money(d!.monthly_payment)}</b></div>
          </div>
          {d!.decided_by === "underwriter" && <p className="muted small">Решение принял кредитный специалист.</p>}
        </div>
      )}

      {s === "SIGNING" && hasOffer && <Signing app={app} busy={busy} onSign={() => act("sign")} />}
      {s === "ISSUED" && hasOffer && <Schedule amount={d!.amount!} rate={d!.rate!} term={d!.term_months!} />}

      <div className="actions">
        {(s === "APPROVED" || s === "COUNTER_OFFER") && (
          <button onClick={() => act("accept")} disabled={busy}>Принять предложение</button>
        )}
        {["DRAFT", "INFO_REQUESTED", "APPROVED", "COUNTER_OFFER", "SIGNING"].includes(s) && (
          <button className="secondary" onClick={() => act("cancel")} disabled={busy}>
            {s === "APPROVED" || s === "COUNTER_OFFER" ? "Отказаться" : "Отозвать заявку"}
          </button>
        )}
        {["REJECTED", "CANCELLED"].includes(s) && <Link to="/new" className="button">Подать новую заявку</Link>}
      </div>
      {error && <p className="error">{error}</p>}

      {showFactors && (
        <div className="card">
          <h2>Что повлияло на решение</h2>
          <Factors factors={d!.factors!} />
        </div>
      )}

      <div className="card">
        <h2>Ваш запрос</h2>
        <dl className="kv">
          <dt>Сумма</dt><dd>{money(app.amount)}</dd>
          <dt>Срок</dt><dd>{app.term_months} мес.</dd>
          <dt>Цель</dt><dd>{app.purpose}</dd>
          <dt>Номер заявки</dt><dd className="mono">{app.id.slice(0, 8)}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>История</h2>
        <Timeline events={app.events ?? []} />
      </div>
    </section>
  );
}

function EditForm({ app, product, busy, onSaved, onSubmit }: {
  app: Application; product: Product | null; busy: boolean;
  onSaved: (a: Application) => void; onSubmit: () => void;
}) {
  const [amount, setAmount] = useState(Number(app.amount));
  const [term, setTerm] = useState(app.term_months);
  const [purpose, setPurpose] = useState(app.purpose);
  const [error, setError] = useState("");
  const dirty = amount !== Number(app.amount) || term !== app.term_months || purpose !== app.purpose;

  async function save(thenSubmit: boolean) {
    setError("");
    try {
      if (dirty) onSaved(await api.update(app.id, { amount, term_months: term, purpose }));
      if (thenSubmit) onSubmit();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h2>{app.status === "INFO_REQUESTED" ? "Исправьте данные" : "Параметры заявки"}</h2>
      <div className="form-row">
        <label>
          Сумма, ₽
          <input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
          {product && <span className="muted small">от {money(product.min_amount)} до {money(product.max_amount)}</span>}
        </label>
        <label>
          Срок, мес.
          <input type="number" value={term || ""} onChange={(e) => setTerm(Number(e.target.value))} />
          {product && <span className="muted small">от {product.min_term_months} до {product.max_term_months}</span>}
        </label>
        <label>
          Цель
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {(product?.purposes ?? [app.purpose]).map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        {dirty && <button className="secondary" onClick={() => save(false)} disabled={busy}>Сохранить</button>}
        <button onClick={() => save(true)} disabled={busy}>
          {busy ? "Отправляем…" : app.status === "INFO_REQUESTED" ? "Отправить повторно" : "Отправить в банк"}
        </button>
      </div>
    </div>
  );
}

function Signing({ app, busy, onSign }: { app: Application; busy: boolean; onSign: () => void }) {
  const [read, setRead] = useState(false);
  const docs = ["Кредитный договор", "График платежей", "Заявление на выдачу кредита"];
  return (
    <div className="card">
      <h2>Документы на подпись</h2>
      <ul className="docs">
        {docs.map((doc) => <li key={doc}>📄 {doc} <span className="muted small">№ {app.id.slice(0, 8)}</span></li>)}
      </ul>
      <Schedule amount={app.decision!.amount!} rate={app.decision!.rate!} term={app.decision!.term_months!} compact />
      <label className="checkbox">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
        <span>Ознакомлен с условиями и подписываю документы простой электронной подписью</span>
      </label>
      <p className="muted small">Демо: подписание и выдача средств смоделированы, реальных операций не происходит.</p>
      <button onClick={onSign} disabled={!read || busy}>Подписать и получить деньги</button>
    </div>
  );
}

function Schedule({ amount, rate, term, compact }: { amount: number; rate: number; term: number; compact?: boolean }) {
  const [all, setAll] = useState(false);
  const rows = schedule(amount, rate, term);
  const total = rows.reduce((acc, r) => acc + r.payment, 0);
  const shown = all ? rows : rows.slice(0, compact ? 3 : 6);
  return (
    <div className={compact ? "" : "card"}>
      <h3>График платежей</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>№</th><th>Платёж</th><th>Проценты</th><th>Основной долг</th><th>Остаток</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.n}><td>{r.n}</td><td>{money(r.payment)}</td><td>{money(r.interest)}</td>
                <td>{money(r.principal)}</td><td>{money(r.rest)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">
        Всего выплат: <b>{money(total)}</b>, из них проценты: <b>{money(total - amount)}</b>
        {rows.length > shown.length && <> · <button className="link" onClick={() => setAll(true)}>показать все {rows.length}</button></>}
      </p>
    </div>
  );
}
