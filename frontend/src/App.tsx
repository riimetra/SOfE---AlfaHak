import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { api, tokenStore, User } from "./api/client";
import Spinner from "./components/Spinner";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationPage from "./pages/ApplicationPage";
import BankQueue from "./pages/BankQueue";
import UnderwriterCard from "./pages/UnderwriterCard";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setChecking(false);
      return;
    }
    api.me().then(setUser).catch(() => tokenStore.set(null)).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  function logout() {
    tokenStore.set(null);
    setUser(null);
  }

  if (checking) return <main><Spinner /></main>;
  if (!user) return <Login onLogin={setUser} />;

  const isBank = user.role === "underwriter";

  return (
    <div className="layout">
      <header>
        <Link to="/" className="logo">
          Кредитный кабинет{isBank && <span className="logo-tag">Банк</span>}
        </Link>
        <nav>
          {isBank ? (
            <NavLink to="/" end>Очередь заявок</NavLink>
          ) : (
            <>
              <NavLink to="/" end>Мои заявки</NavLink>
              <NavLink to="/new">Получить кредит</NavLink>
            </>
          )}
        </nav>
        <div className="user">
          <div>
            <b>{user.full_name}</b>
            <div className="muted small">{isBank ? user.position : user.company?.name}</div>
          </div>
          <button className="secondary" onClick={logout}>Выйти</button>
        </div>
      </header>
      <main>
        <Routes>
          {isBank ? (
            <>
              <Route path="/" element={<BankQueue />} />
              <Route path="/bank/applications/:id" element={<UnderwriterCard />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/new" element={<NewApplication user={user} />} />
              <Route path="/applications/:id" element={<ApplicationPage />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
