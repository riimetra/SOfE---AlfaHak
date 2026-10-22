# Как работаем

## Ветки

- `main` — стабильная версия, всегда запускается через `docker compose up`.
- `nikita`, `slava`, `artem`, `kirill` — личные ветки участников.

```bash
git checkout <имя>
git pull --rebase origin main   # подтянуть свежий main перед работой
# ... коммиты ...
git push origin <имя>
# открыть Pull Request <имя> → main
```

## Правила

- В `main` — только через Pull Request, после зелёного CI.
- Сообщения коммитов: `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`.
- Меняешь API — обнови `docs/api/openapi.json` (`make openapi`) и Postman-коллекцию.
- Меняешь статусы — обнови `docs/state-diagram.md`.
- Добавляешь зависимость — обнови lock-файл и `THIRD_PARTY_NOTICES`.
- Никаких реальных персональных данных и секретов в репозитории.
- Перед дедлайном фиксируем версию тегом (`git tag v1.0.0`).
