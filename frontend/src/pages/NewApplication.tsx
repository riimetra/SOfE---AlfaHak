import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Product } from "../api/client";

// TODO: мастер подбора продукта по потребности (цель → продукт), а не ручной выбор
export default function NewApplication({ companyId }: { companyId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productCode, setProductCode] = useState("");
  const [amount, setAmount] = useState(1_000_000);
  const [term, setTerm] = useState(12);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.products().then((list) => {
      setProducts(list);
      if (list.length) {
        setProductCode(list[0].code);
        setPurpose(list[0].purposes[0] ?? "");
      }
    });
  }, []);

  const product = products.find((p) => p.code === productCode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const app = await api.create({
        company_id: companyId,
        product_code: productCode,
        amount: String(amount),
        term_months: term,
        purpose,
      });
      navigate(`/applications/${app.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Новая заявка</h1>
      <div className="cards">
        {products.map((p) => (
          <label key={p.code} className={`product ${p.code === productCode ? "active" : ""}`}>
            <input
              type="radio"
              name="product"
              checked={p.code === productCode}
              onChange={() => { setProductCode(p.code); setPurpose(p.purposes[0] ?? ""); }}
            />
            <b>{p.name}</b> — от {p.base_rate}%
            <small>{p.description}</small>
          </label>
        ))}
      </div>
      {product && (
        <form onSubmit={onSubmit}>
          <label>
            Сумма, ₽ ({Number(product.min_amount).toLocaleString("ru")}–
            {Number(product.max_amount).toLocaleString("ru")})
            <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} />
          </label>
          <label>
            Срок, мес. ({product.min_term_months}–{product.max_term_months})
            <input type="number" value={term} onChange={(e) => setTerm(+e.target.value)} />
          </label>
          <label>
            Цель
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {product.purposes.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Создать черновик</button>
        </form>
      )}
    </section>
  );
}
