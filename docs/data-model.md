# Модель данных

Источник истины — `backend/app/models/entities.py`.

```mermaid
erDiagram
    COMPANIES ||--o{ APPLICATIONS : "подаёт"
    PRODUCTS ||--o{ APPLICATIONS : "по продукту"
    APPLICATIONS ||--o{ APPLICATION_EVENTS : "история"
    COMPANIES ||--o{ USERS : "представители"

    COMPANIES {
        string id PK
        string inn UK "ИНН (10 — ЮЛ, 12 — ИП)"
        string name
        string legal_form "OOO / IP"
        string okved
        decimal annual_revenue
        datetime created_at
    }
    PRODUCTS {
        string code PK "EXPRESS / INVEST / OVERDRAFT"
        string name
        text description
        decimal min_amount
        decimal max_amount
        int min_term_months
        int max_term_months
        decimal base_rate
        json purposes
    }
    APPLICATIONS {
        string id PK
        string company_id FK
        string product_code FK
        string status "см. state-diagram.md"
        decimal amount
        int term_months
        string purpose
        json enrichment "ответы БКИ, ЕГРЮЛ, ФНС"
        int score "0–1000"
        json decision "amount, term_months, rate, monthly_payment, reason, factors, decided_by"
        datetime created_at
        datetime updated_at
    }
    USERS {
        string id PK
        string login UK
        string password_hash "PBKDF2-SHA256 + соль"
        string full_name
        string position
        string role "client / underwriter"
        string company_id FK "null для сотрудника банка"
    }
    APPLICATION_EVENTS {
        int id PK
        string application_id FK
        string from_status
        string to_status
        string actor "client / system / underwriter"
        text comment
        datetime created_at
    }
```

## Синтетические данные

- `backend/app/seed_data/products.json` — каталог продуктов.
- `backend/app/seed_data/companies.json` — 4 тестовых клиента под разные исходы.
- `backend/app/seed_data/users.json` — тестовые учётные записи (пароль `demo`).
- `mocks/app/data/registry.json` — ответы внешних систем по ИНН.
