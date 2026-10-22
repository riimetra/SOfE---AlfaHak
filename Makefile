.PHONY: up down logs test-backend lock openapi

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

test-backend:
	cd backend && uv run pytest

lock:
	cd backend && uv lock
	cd mocks && uv lock
	cd frontend && npm install --package-lock-only

# Выгрузка OpenAPI-спеки из запущенного backend в docs/api/openapi.json
openapi:
	curl -s http://localhost:8000/openapi.json -o docs/api/openapi.json
