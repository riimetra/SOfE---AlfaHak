# API

- Swagger UI: http://localhost:8000/docs
- OpenAPI: [`api/openapi.json`](api/openapi.json) (обновить: `make openapi`)
- Коллекция Postman: [`api/postman_collection.json`](api/postman_collection.json)

Базовый путь: `/api/v1`.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/products` | Каталог кредитных продуктов |
| GET | `/companies` | Тестовые клиенты (демо вместо авторизации) |
| GET | `/companies/{id}` | Карточка клиента |
| GET | `/applications?company_id=&status=` | Список заявок (клиента или очередь банка) |
| POST | `/applications` | Создать черновик |
| GET | `/applications/{id}` | Заявка с данными обогащения и историей |
| PATCH | `/applications/{id}` | Изменить (только `DRAFT`, `INFO_REQUESTED`) |
| POST | `/applications/{id}/submit` | Отправить в банк → запуск конвейера |
| POST | `/applications/{id}/accept` | Принять предложение → `SIGNING` |
| POST | `/applications/{id}/sign` | Подписать (симуляция) → `ISSUED` |
| POST | `/applications/{id}/cancel` | Отозвать |
| POST | `/applications/{id}/underwriter-decision` | Решение андеррайтера по `UNDERWRITING` |

Ошибки: `404` — не найдено, `409` — недопустимый переход статуса, `422` — невалидное тело.

## Моки внешних систем (`:8081`)

| Путь | Система |
|---|---|
| `GET /bki/reports/{inn}` | Бюро кредитных историй |
| `GET /egrul/companies/{inn}` | ЕГРЮЛ / ЕГРИП |
| `GET /fns/transparent-business/{inn}` | ФНС «Прозрачный бизнес» |
