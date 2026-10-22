# Умный кредитный кабинет предпринимателя

Прототип цифрового кредитного конвейера для малого и микробизнеса (Альфа-Хак 2026).
Объединяет клиентский путь — от выбора продукта до получения средств — и внутреннюю
обработку заявки банком: валидацию, обогащение данными из БКИ / ЕГРЮЛ / ФНС, скоринг и кредитное решение.

> Статус: начальный каркас. Сквозной сценарий работает, многое помечено `TODO`.

## Архитектура

```
frontend (React, :3000) ──/api──▶ backend (FastAPI, :8000) ──▶ PostgreSQL
                                          │
                                          └──▶ mocks (:8081): БКИ, ЕГРЮЛ, ФНС
```

Подробно: [docs/architecture.md](docs/architecture.md).

| Документ | Что внутри |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Архитектурная схема, компоненты, слои |
| [docs/state-diagram.md](docs/state-diagram.md) | Диаграмма состояний заявки |
| [docs/data-model.md](docs/data-model.md) | Модель данных (ER) |
| [docs/api.md](docs/api.md) | Описание API |
| [docs/api/openapi.json](docs/api/openapi.json) | OpenAPI-спецификация |
| [docs/api/postman_collection.json](docs/api/postman_collection.json) | Коллекция запросов |
| [docs/scoring.md](docs/scoring.md) | Скоринговая модель и логика решения |
| [docs/test-scenarios.md](docs/test-scenarios.md) | Тестовые сценарии E2E |
| [docs/research/](docs/research/) | Исследование предметной области |

## Требования к окружению

- Docker 24+ и Docker Compose v2
- Для локальной разработки без Docker: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node.js 20

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

| Сервис | URL |
|---|---|
| Кабинет клиента | http://localhost:3000 |
| Swagger UI | http://localhost:8000/docs |
| Моки внешних систем | http://localhost:8081/docs |

### Локальная разработка

```bash
# моки
cd mocks && uv run uvicorn app.main:app --port 8081 --reload
# backend (SQLite по умолчанию)
cd backend && uv run uvicorn app.main:app --port 8000 --reload
# frontend (проксирует /api на :8000)
cd frontend && npm install && npm run dev
```

Тесты: `cd backend && uv run pytest`.

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `credit` | Параметры БД |
| `DATABASE_URL` | `sqlite:///./local.db` (вне Docker) | Строка подключения SQLAlchemy |
| `MOCKS_BASE_URL` | `http://localhost:8081` | Адрес сервиса моков |
| `CORS_ORIGINS` | `http://localhost:3000` | Разрешённые origin через запятую |
| `LOG_LEVEL` | `INFO` | Уровень логирования |
| `JWT_SECRET` | `change-me` | Секрет токенов (зарезервировано под авторизацию) |
| `MOCKS_LATENCY_MS` | `0` | Искусственная задержка ответов моков |

## Фиксация версий

- Python: `backend/uv.lock`, `mocks/uv.lock`, `requires-python = 3.12.*`
- Frontend: точные версии в `frontend/package.json`; `package-lock.json` генерируется `make lock`
- Образы Docker закреплены по тегам версий

## Тестовые данные

Вместо авторизации — выбор тестового клиента в шапке кабинета:

| Клиент | ИНН | Ожидаемый исход |
|---|---|---|
| ООО «Ромашка» | 7701000001 | Одобрение |
| ООО «Василёк» | 7701000002 | Отказ по скорингу |
| ИП Петров П. П. | 770100000003 | Молодой бизнес — пограничный случай |
| ООО «Лютик» | 7701000004 | Отказ: ликвидирована по ЕГРЮЛ |

## Сценарий проверки

1. Открыть http://localhost:3000, выбрать «ООО «Ромашка»».
2. «Новая заявка» → «Экспресс-кредит», 2 000 000 ₽, 24 мес. → «Создать черновик».
3. «Отправить в банк» — заявка проходит валидацию, обогащение, скоринг; статус «Одобрено».
4. «Принять предложение» → «Подписать документы» — статус «Средства выданы».
5. «Банк: очередь» — заявка видна со скором и статусом.

Остальные сценарии — [docs/test-scenarios.md](docs/test-scenarios.md).

## Допущения MVP

- Внешние системы (БКИ, ЕГРЮЛ, ФНС) — локальные моки с упрощёнными контрактами.
- Подписание документов и выдача средств смоделированы без реальных операций.
- Скоринг — прозрачная балльная модель, см. [docs/scoring.md](docs/scoring.md).
- Весь сценарий проходит внутри продукта, без email/SMS.

## Команда и ветки

Работа ведётся в личных ветках `nikita`, `slava`, `artem`, `kirill` с merge в `main` через Pull Request.
Правила — [CONTRIBUTING.md](CONTRIBUTING.md).
