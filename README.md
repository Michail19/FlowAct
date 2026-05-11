# FlowAct

FlowAct — веб-приложение для визуального создания, настройки и запуска рабочих процессов. Проект развивается как аналог n8n: пользователь собирает workflow из блоков, соединяет их связями, запускает выполнение и анализирует результат через логи.

В текущей версии реализованы:

- визуальный frontend-редактор workflow;
- хранение notebook/workflow в PostgreSQL;
- ExecutionService для управления notebook, workflow и executions;
- WorkerService для выполнения workflow через Kafka-события;
- локальная dev-auth-заглушка до подключения UserService;
- подготовка под AI-рекомендации и AI-блоки.

## Архитектура

Текущий состав проекта:

```text
FlowAct/
├── Frontend/          # React + Vite frontend
├── ExecutionService/  # Spring Boot API для notebook/workflow/execution
├── WorkerService/     # Spring Boot worker для выполнения workflow
├── docker-compose.yml
└── README.md
```

Основные сервисы в Docker Compose:

| Сервис | Назначение | Порт |
| --- | --- | --- |
| frontend | Nginx + собранный React frontend | `3000` |
| execution-service | REST API для notebook, workflow и execution | `8082` |
| worker-service | Worker, который выполняет workflow по Kafka-событиям | внутренний |
| postgres | PostgreSQL 16 | `5433 -> 5432` |
| kafka | Apache Kafka | `9092`, внутри Docker `9093` |

`docker-compose.yml` поднимает PostgreSQL, Kafka, ExecutionService, WorkerService и Frontend. Frontend-прокси отправляет `/api/...` в `execution-service:8082`, а nginx временно добавляет `X-User-Id`, пока UserService/AuthService ещё не подключён.

## Требования

Для локального запуска нужны:

- Docker и Docker Compose;
- Node.js 22+ — если frontend запускается отдельно;
- Java 21 — если backend-сервисы запускаются отдельно;
- PostgreSQL 16 — если backend запускается без Docker;
- Kafka — если ExecutionService и WorkerService запускаются без Docker.

## Быстрый запуск через Docker Compose

Скопируйте пример окружения:

```bash
cp .env.example .env
```

Запустите проект:

```bash
docker compose up --build
```

После запуска будут доступны:

```text
Frontend:          http://localhost:3000
ExecutionService:  http://localhost:8082
Swagger UI:        http://localhost:8082/swagger-ui.html
Actuator health:   http://localhost:8082/actuator/health
PostgreSQL:        localhost:5433
Kafka:             localhost:9092
```

## Повторная сборка после изменений

Если менялся frontend:

```bash
docker compose build frontend
docker compose up -d frontend
```

Если менялся ExecutionService:

```bash
docker compose build execution-service
docker compose up -d execution-service
```

Если менялся WorkerService:

```bash
docker compose build worker-service
docker compose up -d worker-service
```

Полная пересборка:

```bash
docker compose down
docker compose build --no-cache
docker compose up
```

Если нужно пересоздать базу данных с нуля:

```bash
docker compose down -v
docker compose up --build
```

> Важно: команда `down -v` удаляет volume PostgreSQL и все локальные данные БД.

## Локальный frontend без Docker

```bash
cd Frontend
cp .env.example .env
npm install
npm run dev
```

По умолчанию frontend будет доступен на:

```text
http://localhost:5173
```

Если backend запущен через Docker Compose, в `Frontend/.env` удобно указать:

```env
VITE_API_BASE_URL=http://localhost:8082/api
VITE_DEV_AUTH_ENABLED=true
VITE_DEV_USER_ID=11111111-1111-1111-1111-111111111111
VITE_DEV_AUTH_TOKEN=dev-token
```

## Локальный ExecutionService без Docker

```bash
cd ExecutionService
cp .env.example .env
```

Для запуска вручную нужно передать переменные окружения из `.env.example`, после чего выполнить:

```bash
./gradlew bootRun
```

На Windows:

```powershell
.\gradlew.bat bootRun
```

## Локальный WorkerService без Docker

```bash
cd WorkerService
cp .env.example .env
```

Затем:

```bash
./gradlew bootRun
```

На Windows:

```powershell
.\gradlew.bat bootRun
```

WorkerService требует доступ к той же PostgreSQL-базе и Kafka, что и ExecutionService.

## Основные frontend-страницы

| Страница | Назначение |
| --- | --- |
| `/landing` | Лендинг FlowAct |
| `/home` | Список notebook |
| `/notebook/:notebookId` | Визуальный редактор workflow |
| `/my-account` | Будущая страница аккаунта, будет дорабатываться вместе с UserService |

## Основные API

Базовый путь API:

```text
/api/v1
```

Основные группы endpoint-ов:

```text
/api/v1/notebooks
/api/v1/notebooks/{notebookId}/workflows
/api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions
```

Пока UserService не подключён, ExecutionService ожидает заголовок:

```http
X-User-Id: 11111111-1111-1111-1111-111111111111
```

В Docker-режиме nginx добавляет fallback `X-User-Id` автоматически. При запуске frontend отдельно dev-auth добавляется через Vite-переменные.

## Миграции БД

ExecutionService использует Flyway:

```text
ExecutionService/src/main/resources/db/migration
```

В режиме `SPRING_PROFILES_ACTIVE=init` дополнительно подключается каталог:

```text
ExecutionService/src/main/resources/db/testdata
```

Hibernate работает в режиме:

```text
spring.jpa.hibernate.ddl-auto=validate
```

Это значит, что схема БД должна соответствовать Entity-классам. Если добавлено новое поле в Entity, нужно добавить SQL-миграцию.

## Проверка качества frontend

```bash
cd Frontend
npm run typecheck
npm run lint
npm run build
```

## Полезные команды Docker

Просмотр контейнеров:

```bash
docker compose ps
```

Логи всех сервисов:

```bash
docker compose logs -f
```

Логи ExecutionService:

```bash
docker compose logs -f execution-service
```

Логи WorkerService:

```bash
docker compose logs -f worker-service
```

Подключение к PostgreSQL:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Проверка таблицы workflows:

```sql
\d workflows
```

## Текущее состояние UserService

UserService/AuthService пока не реализован. До его подключения используется временная dev-auth-заглушка:

- frontend добавляет `Authorization` и `X-User-Id`;
- nginx в Docker-режиме добавляет fallback `X-User-Id`;
- backend использует `X-User-Id` как идентификатор текущего пользователя.

После разработки UserService этот слой нужно заменить на полноценную авторизацию через JWT.
