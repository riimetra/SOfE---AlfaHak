# API

- Swagger UI: http://localhost:8000/docs (кнопка **Authorize** — вставить токен из `/auth/login`)
- OpenAPI: [`api/openapi.json`](api/openapi.json) (обновить: `make openapi`)
- Коллекция Postman: [`api/postman_collection.json`](api/postman_collection.json) — запросы «Вход …» сами сохраняют токены

Базовый путь: `/api/v1`. Все методы, кроме входа, каталога и `demo-accounts`, требуют
заголовок `Authorization: Bearer <token>`.

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| POST | `/auth/login` | — | Вход: `{login, password}` → `{access_token, user}` |
| GET | `/auth/me` | любая | Текущий пользователь и его компания |
| GET | `/auth/demo-accounts` | — | Тестовые учётные записи (только при `DEMO_MODE=true`) |
| GET | `/products` | — | Каталог кредитных продуктов |
| GET | `/companies` | underwriter | Клиенты банка |
| GET | `/companies/{id}` | любая | Карточка клиента (клиенту — только своя) |
| GET | `/applications?status=&company_id=` | любая | Клиент — свои заявки, банк — все с фильтрами |
| POST | `/applications` | client | Создать черновик: `{product_code, amount, term_months, purpose}` |
| GET | `/applications/{id}` | любая | Заявка с данными обогащения, решением и историей |
| PATCH | `/applications/{id}` | client | Изменить (только `DRAFT`, `INFO_REQUESTED`) |
| POST | `/applications/{id}/submit` | client | Отправить / отправить повторно → конвейер до решения |
| POST | `/applications/{id}/accept` | client | Принять предложение → `SIGNING` |
| POST | `/applications/{id}/sign` | client | Подписать ПЭП (симуляция) → `ISSUED` |
| POST | `/applications/{id}/cancel` | client | Отозвать / отказаться от предложения |
| POST | `/applications/{id}/underwriter-decision` | underwriter | Решение по `UNDERWRITING` |

Тело решения андеррайтера:

```json
{ "status": "COUNTER_OFFER", "amount": 12000000, "term_months": 60, "rate": 20.5, "comment": "Залог — оборудование" }
```

`status`: `APPROVED` | `COUNTER_OFFER` | `INFO_REQUESTED` | `REJECTED`. Для `REJECTED` и `INFO_REQUESTED`
обязателен `comment` (он показывается клиенту). Для `APPROVED` условия можно не передавать — возьмутся
запрошенные клиентом и базовая ставка продукта.

Ошибки: `401` — нет / неверный токен, `403` — не та роль, `404` — не найдено или чужая заявка,
`409` — недопустимый переход статуса, `422` — невалидное тело, `503` — сбой обработки (заявка не изменилась).

## Моки внешних систем (`:8081`)

| Путь | Система | 404 означает |
|---|---|---|
| `GET /bki/reports/{inn}` | Бюро кредитных историй | нет кредитной истории |
| `GET /egrul/companies/{inn}` | ЕГРЮЛ / ЕГРИП | компания не найдена → отказ |
| `GET /fns/transparent-business/{inn}` | ФНС «Прозрачный бизнес» | нет сведений |
