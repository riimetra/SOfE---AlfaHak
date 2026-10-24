# Диаграмма состояний заявки

Источник истины — `backend/app/services/state_machine.py`. Любой переход вне таблицы возвращает `409 Conflict`.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: клиент создаёт заявку
    DRAFT --> SUBMITTED: клиент отправляет
    DRAFT --> CANCELLED: клиент отзывает

    SUBMITTED --> VALIDATION: система
    VALIDATION --> INFO_REQUESTED: не хватает данных
    VALIDATION --> ENRICHMENT: данные корректны
    VALIDATION --> REJECTED: стоп-фактор
    INFO_REQUESTED --> VALIDATION: клиент уточнил данные
    INFO_REQUESTED --> CANCELLED

    ENRICHMENT --> SCORING: БКИ + ЕГРЮЛ + ФНС получены
    ENRICHMENT --> UNDERWRITING: внешний источник недоступен
    SCORING --> APPROVED: скор ≥ 600
    SCORING --> COUNTER_OFFER: 450 ≤ скор < 600
    SCORING --> REJECTED: скор < 450 или стоп-фактор (ЕГРЮЛ)
    SCORING --> UNDERWRITING: сумма ≥ 10 млн ₽

    UNDERWRITING --> APPROVED
    UNDERWRITING --> COUNTER_OFFER
    UNDERWRITING --> REJECTED
    UNDERWRITING --> INFO_REQUESTED

    APPROVED --> SIGNING: клиент принял
    COUNTER_OFFER --> SIGNING: клиент принял
    APPROVED --> CANCELLED
    COUNTER_OFFER --> CANCELLED
    SIGNING --> ISSUED: документы подписаны (симуляция)
    SIGNING --> CANCELLED

    REJECTED --> [*]
    ISSUED --> [*]
    CANCELLED --> [*]
```

| Статус | Кто действует | Что видит клиент |
|---|---|---|
| DRAFT | клиент | Черновик, можно редактировать |
| SUBMITTED / VALIDATION / ENRICHMENT / SCORING | система | «Заявка рассматривается», этап на таймлайне |
| INFO_REQUESTED | клиент | Что именно нужно уточнить |
| UNDERWRITING | андеррайтер | «Рассматривает специалист», статус обновляется автоматически |
| APPROVED / COUNTER_OFFER | клиент | Предложение: сумма, срок, ставка |
| SIGNING | клиент | Документы на подпись |
| ISSUED / REJECTED / CANCELLED | — | Итог |
