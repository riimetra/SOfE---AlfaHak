import { FormEvent, useEffect, useState } from "react";
import { api, DemoAccount, User, tokenStore } from "../api/client";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<DemoAccount[]>([]);

  useEffect(() => {
    api.demoAccounts().then(setDemo).catch(() => setDemo([]));
  }, []);

  async function doLogin(l: string, p: string) {
    setBusy(true);
    setError("");
    try {
      const res = await api.login(l, p);
      tokenStore.set(res.access_token);
      onLogin(res.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    doLogin(login, password);
  }

  return (
    <div className="login">
      <div className="card login-card">
        <div className="logo big">Кредитный кабинет</div>
        <p className="muted">Финансирование для малого бизнеса — от заявки до получения средств.</p>
        <form onSubmit={onSubmit}>
          <label>
            Логин
            <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Входим…" : "Войти"}</button>
        </form>
      </div>

      {demo.length > 0 && (
        <div className="card login-card">
          <h3>Тестовые учётные записи</h3>
          <p className="muted small">Демо-стенд: данные синтетические. Пароль у всех — <code>demo</code>.</p>
          <ul className="demo-list">
            {demo.map((d) => (
              <li key={d.login}>
                <button className="secondary wide" disabled={busy}
                  onClick={() => doLogin(d.login, d.password)}>
                  <b>{d.full_name}</b>
                  <span className="muted small">
                    {d.role === "underwriter" ? "Сотрудник банка" : d.position} · {d.login}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
