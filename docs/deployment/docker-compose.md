# Запуск FlowAct через Docker Compose

Этот документ описывает основной локальный сценарий запуска FlowAct через Docker Compose.

## Что запускается

`docker-compose.yml` поднимает следующие сервисы:

| Сервис | Назначение | Порт |
| --- | --- | --- |
| `frontend` | Nginx + собранный React frontend | `3000` |
| `execution-service` | REST API для notebook, workflow и execution | `8082` |
| `worker-service` | Worker для выполнения workflow | внутренний |
| `postgres` | PostgreSQL 16 | `5433 -> 5432` |
| `kafka` | Apache Kafka | `9092`, внутри Docker `9093` |

Frontend-прокси отправляет `/api/...` в `execution-service:8082`. До подключения UserService/AuthService nginx временно добавляет fallback `X-User-Id`.

## Требования

Для запуска нужны:

- Docker;
- Docker Compose;
- свободные порты `3000`, `5433`, `8082`, `9092`.

## Настройка окружения

Из корня проекта скопируйте пример окружения:

```bash
cp .env.example .env
```

Если `.env.example` ещё не добавлен в корень проекта, можно запускать compose с дефолтными значениями из `docker-compose.yml`.

## Быстрый запуск

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

## Запуск в фоне

```bash
docker compose up -d --build
```

Остановить сервисы:

```bash
docker compose down
```

Остановить сервисы и удалить volume PostgreSQL:

```bash
docker compose down -v
```

> Важно: `down -v` удаляет данные PostgreSQL.

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

Полная пересборка без кэша:

```bash
docker compose down
docker compose build --no-cache
docker compose up
```

## Проверка состояния сервисов

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

Логи frontend/nginx:

```bash
docker compose logs -f frontend
```

## Работа с PostgreSQL

Подключиться к базе:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Показать таблицы:

```sql
\dt
```

Проверить таблицу workflows:

```sql
\d workflows
```

Проверить применённые Flyway-миграции:

```sql
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
```

## Миграции

ExecutionService использует Flyway. Миграции лежат в:

```text
ExecutionService/src/main/resources/db/migration
```

Hibernate работает в режиме:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

Поэтому при изменении Entity нужно добавить новую SQL-миграцию. Hibernate не будет менять схему автоматически.

Если миграции не применились, а данные не важны, можно пересоздать volume:

```bash
docker compose down -v
docker compose up --build
```

## Dev-auth

До подключения UserService используется временная dev-auth-заглушка.

Frontend в Docker собирается с аргументами:

```text
VITE_API_BASE_URL=/api
VITE_DEV_AUTH_ENABLED=true
VITE_DEV_USER_ID=11111111-1111-1111-1111-111111111111
VITE_DEV_AUTH_TOKEN=dev-token
```

Nginx дополнительно добавляет fallback `X-User-Id`, если запрос пришёл без него.

После разработки UserService/AuthService этот слой нужно заменить на полноценную авторизацию.

## Частые проблемы

### Frontend открылся, но API не работает

Проверьте, что `execution-service` здоров:

```bash
docker compose ps
curl http://localhost:8082/actuator/health
```

Также проверьте логи nginx/frontend:

```bash
docker compose logs -f frontend
```

### ExecutionService падает на schema-validation

Проверьте, есть ли нужный столбец/таблица в PostgreSQL:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Например:

```sql
\d workflows
```

Если схема устарела, добавьте миграцию или пересоздайте volume.

### WorkerService не получает execution events

Проверьте Kafka и WorkerService:

```bash
docker compose logs -f kafka
docker compose logs -f worker-service
```

Также убедитесь, что ExecutionService и WorkerService используют одинаковые topic names.

### Retry/cancel/resume не работают

Проверьте:

- статус execution;
- логи ExecutionService;
- логи WorkerService;
- доступность Kafka;
- совпадение topic names и group id.

## Полная очистка локального окружения

```bash
docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up
```

Эта команда удаляет контейнеры, volume PostgreSQL и пересобирает проект с нуля.
