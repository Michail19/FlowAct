# Запуск FlowAct через Docker Compose

Этот документ описывает основной локальный сценарий запуска FlowAct через Docker Compose.

## Что запускается

`docker-compose.yml` поднимает следующие сервисы:

| Сервис | Назначение | Порт |
| --- | --- | --- |
| `frontend` | Nginx + собранный React frontend | `3000 -> 80` |
| `user-service` | REST API для пользователей, регистрации, входа и JWT | `8083` |
| `execution-service` | REST API для notebook, workflow и execution | `8082` |
| `worker-service` | Worker для выполнения workflow | внутренний |
| `postgres` | PostgreSQL 16 для ExecutionService | `5433 -> 5432` |
| `user-db` | PostgreSQL 16 для UserService | `5434 -> 5432` |
| `kafka` | Apache Kafka | `9092`, внутри Docker `9093` |
| `caddy` | Reverse proxy для frontend | `80`, `443` |

Frontend/nginx проксирует запросы так:

```text
/api/v1/auth/**      -> user-service:8083
/api/v1/users/**     -> user-service:8083
/api/v1/notebooks/** -> execution-service:8082
/api/v1/...          -> execution-service:8082
```

`X-User-Id` больше не добавляется. Backend-запросы используют JWT:

```http
Authorization: Bearer <accessToken>
```

## Требования

Для запуска нужны:

- Docker;
- Docker Compose;
- свободные порты `3000`, `5433`, `5434`, `8082`, `8083`, `9092`;
- свободные порты `80` и `443`, если запускается Caddy.

## Настройка окружения

Из корня проекта скопируйте пример окружения:

```bash
cp .env.example .env
```

Важные переменные:

```env
JWT_SECRET=change-this-dev-secret-change-this-dev-secret
JWT_ISSUER=flowact-user-service
JWT_ACCESS_TOKEN_TTL_MINUTES=30
JWT_REFRESH_TOKEN_TTL_DAYS=14
BCRYPT_STRENGTH=12
```

`JWT_SECRET` должен быть одинаковым для `user-service` и `execution-service`. В `docker-compose.yml` это достигается использованием одной переменной окружения.

Если `.env.example` ещё не содержит всех переменных UserService, compose всё равно может запускаться с дефолтными значениями из `docker-compose.yml`.

## Caddyfile

Полный `docker compose up` запускает сервис `caddy`, который монтирует файл:

```text
./Caddyfile -> /etc/caddy/Caddyfile
```

Поэтому в корне проекта должен существовать именно файл `Caddyfile`, не папка.

Создать файл из примера:

```bash
cp Caddyfile.example Caddyfile
```

Минимальный локальный вариант:

```caddyfile
:80 {
    reverse_proxy frontend:80
}
```

На Windows, если случайно создана папка `Caddyfile`, удалите её и создайте файл:

```powershell
Remove-Item .\Caddyfile -Recurse -Force
Set-Content -Path .\Caddyfile -Value ":80 {`n    reverse_proxy frontend:80`n}"
```

Если Caddy в локальной разработке не нужен, можно запускать только основные сервисы:

```bash
docker compose up -d --build postgres user-db kafka user-service execution-service worker-service frontend
```

В этом случае приложение будет доступно на `http://localhost:3000`.

## Быстрый запуск

```bash
docker compose up --build
```

После запуска будут доступны:

```text
Frontend:              http://localhost:3000
UserService:           http://localhost:8083
UserService Swagger:   http://localhost:8083/swagger-ui.html
UserService health:    http://localhost:8083/actuator/health
ExecutionService:      http://localhost:8082
Execution Swagger:     http://localhost:8082/swagger-ui.html
Execution health:      http://localhost:8082/actuator/health
Execution PostgreSQL:  localhost:5433
User PostgreSQL:       localhost:5434
Kafka:                 localhost:9092
Caddy:                 http://localhost
```

## Запуск в фоне

```bash
docker compose up -d --build
```

Остановить сервисы:

```bash
docker compose down
```

Остановить сервисы и удалить volumes PostgreSQL/Caddy:

```bash
docker compose down -v
```

> Важно: `down -v` удаляет данные `postgres`, `user-db` и Caddy.

## Повторная сборка после изменений

Если менялся frontend:

```bash
docker compose build frontend
docker compose up -d frontend
```

Если менялся UserService:

```bash
docker compose build user-service
docker compose up -d user-service
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

Логи UserService:

```bash
docker compose logs -f user-service
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

Логи Caddy:

```bash
docker compose logs -f caddy
```

## Работа с PostgreSQL

Подключиться к базе ExecutionService:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Подключиться к базе UserService:

```bash
docker compose exec user-db psql -U postgres -d flowact_users
```

Показать таблицы:

```sql
\dt
```

Проверить применённые Flyway-миграции:

```sql
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
```

## Миграции

UserService использует Flyway. Миграции лежат в:

```text
UserService/src/main/resources/db/migration
```

ExecutionService использует Flyway. Миграции лежат в:

```text
ExecutionService/src/main/resources/db/migration
```

Hibernate работает в режиме:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

Поэтому при изменении Entity нужно добавить новую SQL-миграцию. Hibernate не будет менять схему автоматически.

Если миграции не применились, а данные не важны, можно пересоздать volumes:

```bash
docker compose down -v
docker compose up --build
```

## Проверка JWT-сценария

Регистрация через frontend/nginx:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'
```

Ответ должен содержать:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "test@example.com"
  }
}
```

Проверка защищённого endpoint-а без токена:

```bash
curl -i http://localhost:3000/api/v1/notebooks
```

Ожидается `401`.

Проверка с access token:

```bash
curl http://localhost:3000/api/v1/notebooks \
  -H "Authorization: Bearer <accessToken>"
```

Ожидается список notebook текущего пользователя.

## Частые проблемы

### Frontend открылся, но auth/API не работает

Проверьте, что `user-service` и `execution-service` здоровы:

```bash
docker compose ps
curl http://localhost:8083/actuator/health
curl http://localhost:8082/actuator/health
```

Также проверьте логи nginx/frontend:

```bash
docker compose logs -f frontend
```

### Запросы к notebook возвращают 401

Проверьте:

- пользователь вошёл в аккаунт;
- frontend отправляет `Authorization: Bearer <accessToken>`;
- `user-service` и `execution-service` используют одинаковый `JWT_SECRET`;
- access token не истёк;
- refresh token успешно обновляет access token.

### В одном аккаунте видны notebook другого аккаунта

Очистите старый localStorage браузера, если ранее использовалась dev-auth-заглушка:

```js
localStorage.clear();
```

После перехода на UserService frontend хранит локальный кэш notebook с ключами, разделёнными по `userId`.

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

### UserService падает на schema-validation

Проверьте БД `flowact_users`:

```bash
docker compose exec user-db psql -U postgres -d flowact_users
```

Например:

```sql
\d users
\d refresh_tokens
```

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

Эта команда удаляет контейнеры, volumes PostgreSQL/Caddy и пересобирает проект с нуля.
