import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { api, Company } from "./api/client";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationPage from "./pages/ApplicationPage";
import BankQueue from "./pages/BankQueue";

export default function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>(
    () => localStorage.getItem("companyId") ?? "",
  );

  useEffect(() => {
    api.companies().then((list) => {
      setCompanies(list);
      if (!companyId && list.length) setCompanyId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (companyId) localStorage.setItem("companyId", companyId);
  }, [companyId]);

  return (
    <div className="layout">
      <header>
        <Link to="/" className="logo">Кредитный кабинет</Link>
        <nav>
          <Link to="/">Мои заявки</Link>
          <Link to="/new">Новая заявка</Link>
          <Link to="/bank">Банк: очередь</Link>
        </nav>
        {/* Демо-режим: вместо авторизации — выбор тестового клиента */}
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard companyId={companyId} />} />
          <Route path="/new" element={<NewApplication companyId={companyId} />} />
          <Route path="/applications/:id" element={<ApplicationPage />} />
          <Route path="/bank" element={<BankQueue />} />
        </Routes>
      </main>
    </div>
  );
}
