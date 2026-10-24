import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Product, User } from "../api/client";
import Spinner from "../components/Spinner";
import { annuity, money } from "../utils";

/** Мастер подачи заявки: потребность → продукт и параметры → проверка и отправка. */
export default function NewApplication({ user }: { user: User }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [productCode, setProductCode] = useState("");
  const [amount, setAmount] = useState(0);
  const [term, setTerm] = useState(0);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.products().then(setProducts).catch((e) => setError(e.message));
  }, []);

  const needs = useMemo(() => {
    const map = new Map<string, Product[]>();
    products?.forEach((p) => p.purposes.forEach((x) => map.set(x, [...(map.get(x) ?? []), p])));
    return [...map.entries()];
  }, [products]);

  const candidates = needs.find(([n]) => n === purpose)?.[1] ?? [];
  const product = products?.find((p) => p.code === productCode);

  function chooseProduct(p: Product) {
    setProductCode(p.code);
    const min = Number(p.min_amount), max = Number(p.max_amount);
    setAmount((a) => (a >= min && a <= max ? a : Math.min(max, Math.max(min, 1_000_000))));
    setTerm((t) => (t >= p.min_term_months && t <= p.max_term_months ? t
      : Math.min(p.max_term_months, Math.max(p.min_term_months, 12))));
  }

  function chooseNeed(n: string, ps: Product[]) {
    setPurpose(n);
    if (ps.length === 1) chooseProduct(ps[0]);
    else setProductCode("");
  }

  const amountError = product && (amount < Number(product.min_amount) || amount > Number(product.max_amount))
    ? `Сумма от ${money(product.min_amount)} до ${money(product.max_amount)}` : "";
  const termError = product && (term < product.min_term_months || term > product.max_term_months)
    ? `Срок от ${product.min_term_months} до ${product.max_term_months} мес.` : "";
  const payment = product && !amountError && !termError
    ? annuity(amount, Number(product.base_rate), term) : 0;
  const revenue = Number(user.company?.annual_revenue ?? 0);

  async function finish(send: boolean) {
    if (!product) return;
    setBusy(true);
    setError("");
    try {
      const app = await api.create({ product_code: product.code, amount, term_months: term, purpose });
      // Если отправка не удалась, черновик уже сохранён — его можно отправить со страницы заявки
      if (send) await api.action(app.id, "submit").catch(() => undefined);
      navigate(`/applications/${app.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!products) return error ? <p className="error">{error}</p> : <Spinner />;

  return (
    <section>
      <h1>Получить кредит</h1>
      <ol className="wizard-steps">
        {["Потребность", "Условия", "Проверка и отправка"].map((t, i) => (
          <li key={t} className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""}>{i + 1}. {t}</li>
        ))}
      </ol>

      {step === 1 && (
        <div>
          <h2>На что нужны деньги?</h2>
          <p className="muted">Выберите задачу — мы подберём подходящий кредит.</p>
          <div className="grid">
            {needs.map(([n, ps]) => (
              <button key={n} className={`choice ${purpose === n ? "active" : ""}`} onClick={() => chooseNeed(n, ps)}>
                <b>{n}</b>
                <span className="muted small">{ps.map((p) => p.name).join(" или ")}</span>
              </button>
            ))}
          </div>

          {candidates.length > 0 && (
            <>
              <h2>Подходящие продукты</h2>
              <div className="grid">
                {candidates.map((p) => (
                  <button key={p.code} className={`choice ${productCode === p.code ? "active" : ""}`}
                    onClick={() => chooseProduct(p)}>
                    <b>{p.name}</b>
                    <span>{p.description}</span>
                    <span className="muted small">
                      от {Number(p.base_rate)}% годовых · {money(p.min_amount)} – {money(p.max_amount)} ·
                      {" "}{p.min_term_months}–{p.max_term_months} мес.
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="actions">
            <button disabled={!product} onClick={() => setStep(2)}>Далее</button>
          </div>
        </div>
      )}

      {step === 2 && product && (
        <div className="two-col">
          <div className="card">
            <h2>{product.name}</h2>
            <label>
              Сумма, ₽
              <input type="number" value={amount || ""} step={10000}
                onChange={(e) => setAmount(Number(e.target.value))} />
              <input type="range" min={Number(product.min_amount)} max={Number(product.max_amount)}
                step={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <span className={amountError ? "error small" : "muted small"}>
                {amountError || `от ${money(product.min_amount)} до ${money(product.max_amount)}`}
              </span>
            </label>
            <label>
              Срок, месяцев
              <input type="number" value={term || ""} onChange={(e) => setTerm(Number(e.target.value))} />
              <input type="range" min={product.min_term_months} max={product.max_term_months}
                value={term} onChange={(e) => setTerm(Number(e.target.value))} />
              <span className={termError ? "error small" : "muted small"}>
                {termError || `от ${product.min_term_months} до ${product.max_term_months} мес.`}
              </span>
            </label>
            <label>
              Цель
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {product.purposes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div className="card summary">
            <span className="muted small">Ежемесячный платёж (предварительно)</span>
            <div className="big-number">{payment ? money(payment) : "—"}</div>
            <span className="muted small">
              по ставке от {Number(product.base_rate)}% годовых. Точные условия банк сообщит после рассмотрения.
            </span>
            {revenue > 0 && payment > 0 && payment * 12 > revenue * 0.5 && (
              <p className="warn small">
                Платежи за год превышают половину годовой выручки — банк может предложить меньшую сумму.
              </p>
            )}
          </div>
          <div className="actions full">
            <button className="secondary" onClick={() => setStep(1)}>Назад</button>
            <button disabled={!!amountError || !!termError} onClick={() => setStep(3)}>Далее</button>
          </div>
        </div>
      )}

      {step === 3 && product && (
        <div>
          <div className="card">
            <h2>Проверьте заявку</h2>
            <dl className="kv">
              <dt>Продукт</dt><dd>{product.name}</dd>
              <dt>Сумма</dt><dd>{money(amount)}</dd>
              <dt>Срок</dt><dd>{term} мес.</dd>
              <dt>Цель</dt><dd>{purpose}</dd>
              <dt>Платёж в месяц</dt><dd>≈ {money(payment)}</dd>
            </dl>
          </div>
          {user.company && (
            <div className="card">
              <h2>Сведения о компании</h2>
              <p className="muted small">Данные взяты из профиля клиента — вводить их повторно не нужно.</p>
              <dl className="kv">
                <dt>Компания</dt><dd>{user.company.name}</dd>
                <dt>ИНН</dt><dd>{user.company.inn}</dd>
                <dt>ОКВЭД</dt><dd>{user.company.okved ?? "—"}</dd>
                <dt>Выручка за год</dt><dd>{money(user.company.annual_revenue)}</dd>
                <dt>Заявитель</dt><dd>{user.full_name}, {user.position}</dd>
              </dl>
            </div>
          )}
          <label className="checkbox">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Согласен на запрос сведений о компании в бюро кредитных историй, ЕГРЮЛ/ЕГРИП и ФНС
              для рассмотрения заявки
            </span>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="secondary" onClick={() => setStep(2)} disabled={busy}>Назад</button>
            <button className="secondary" onClick={() => finish(false)} disabled={busy}>Сохранить черновик</button>
            <button onClick={() => finish(true)} disabled={!consent || busy}>
              {busy ? "Отправляем…" : "Отправить в банк"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
