# FlowAct

FlowAct — веб-приложение для визуального создания, настройки и запуска рабочих процессов. Проект развивается как аналог n8n: пользователь собирает workflow из блоков, соединяет их связями, запускает выполнение и анализирует результат через логи.

В текущей версии реализованы:

- визуальный frontend-редактор workflow;
- landing page, home page, notebook editor и страница аккаунта;
- UserService с регистрацией, входом, JWT access token и refresh token;
- авторизация backend-запросов через `Authorization: Bearer <accessToken>`;
- хранение notebook/workflow в PostgreSQL;
- ExecutionService для управления notebook, workflow и executions;
- WorkerService для выполнения workflow через Kafka-события;
- отдельные базы данных для UserService и ExecutionService;
- подготовка под AI-рекомендации и AI-блоки;
- Docker Compose-окружение для запуска frontend, backend-сервисов, PostgreSQL, Kafka и Caddy.

## Архитектура

Текущий состав проекта:

```text
FlowAct/
├── Frontend/                    # React + Vite frontend, сборка отдаётся через nginx
├── UserService/                 # Spring Boot API для пользователей и авторизации
├── ExecutionService/            # Spring Boot API для notebook/workflow/execution
├── WorkerService/               # Spring Boot worker для выполнения workflow
├── docs/deployment/             # инструкции запуска и развёртывания
├── Caddyfile.example            # пример reverse proxy для домена
├── docker-compose.yml           # локальный/prod-like запуск сервисов
├── .env.example                 # пример переменных окружения
└── README.md
```

Основные сервисы:

| Сервис | Назначение |
| --- | --- |
| Frontend | SPA-интерфейс FlowAct, landing, home, account page и визуальный редактор workflow |
| UserService | Регистрация, вход, refresh/logout, профиль пользователя и выпуск JWT |
| ExecutionService | REST API для notebook, workflow, валидации и execution; проверяет JWT |
| WorkerService | Выполнение workflow по событиям из Kafka |
| PostgreSQL `postgres` | БД ExecutionService: notebook, workflow, blocks, connections, executions и logs |
| PostgreSQL `user-db` | БД UserService: users и refresh_tokens |
| Kafka | Очередь событий запуска, повтора, отмены и продолжения execution |
| Caddy | Reverse proxy для публикации frontend по домену и автоматического HTTPS |

Упрощённая схема запуска через Docker Compose:

```text
Browser
  -> frontend:80
      -> /api/v1/auth/**, /api/v1/users/** -> user-service:8083 -> user-db
      -> /api/v1/notebooks/**              -> execution-service:8082 -> postgres
      -> /api/v1/.../executions/**         -> execution-service:8082 -> Kafka
                                                        -> worker-service -> postgres
```

Если используется Caddy:

```text
Browser
  -> Caddy :80/:443
      -> frontend:80
```

## Авторизация

FlowAct использует JWT-авторизацию:

1. пользователь регистрируется или входит через `UserService`;
2. `UserService` возвращает `accessToken`, `refreshToken` и данные пользователя;
3. frontend хранит сессию и отправляет backend-запросы с заголовком:

```http
Authorization: Bearer <accessToken>
```

4. `ExecutionService` проверяет JWT и берёт `userId` из `sub` токена;
5. notebook, workflow и execution доступны только владельцу notebook.

`X-User-Id` больше не используется в обычном запуске проекта. Dev-auth оставлен только как legacy-код/аварийная заготовка и по умолчанию отключён.

## Быстрый запуск через Docker Compose

Для локального запуска из корня проекта:

```bash
cp .env.example .env
cp Caddyfile.example Caddyfile
```

На Windows важно, чтобы `Caddyfile` был именно файлом, а не папкой. Если случайно создана папка `Caddyfile`, удалите её и создайте файл заново.

Если запускаете проект локально без домена, frontend можно открыть напрямую на `http://localhost:3000`. В этом случае Caddy нужен не всегда, но файл `Caddyfile` всё равно должен существовать, если запускается полный `docker compose up`.

Запуск всех сервисов:

```bash
docker compose up --build
```

Запуск в фоне:

```bash
docker compose up -d --build
```

После запуска доступны:

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
Caddy:                 http://localhost или https://<ваш-домен>
```

Остановка:

```bash
docker compose down
```

Остановка с удалением локальных данных:

```bash
docker compose down -v
```

> Важно: `down -v` удаляет локальные данные PostgreSQL и данные Caddy, включая полученные сертификаты.

## Настройка Caddy

В репозитории хранится только пример:

```text
Caddyfile.example
```

Для реального запуска создайте рабочий файл:

```bash
cp Caddyfile.example Caddyfile
```

Для локального reverse proxy без домена можно использовать минимальный файл:

```caddyfile
:80 {
    reverse_proxy frontend:80
}
```

Для домена замените заглушку в `Caddyfile`:

```caddyfile
example.ru, www.example.ru {
    reverse_proxy frontend:80
}
```

На сервере DNS-записи домена должны указывать на IP машины, где запущен Docker Compose. Caddy слушает внешние порты `80` и `443`, проксирует запросы во внутренний контейнер `frontend:80` и может автоматически получить HTTPS-сертификат для домена.

Минимальная проверка после запуска:

```bash
docker compose ps
docker compose logs -f caddy
```

## Документация по запуску и развёртыванию

Инструкции запуска вынесены в отдельные документы:

| Вариант | Статус | Документация |
| --- | --- | --- |
| Docker Compose | основной локальный и prod-like сценарий | [docs/deployment/docker-compose.md](docs/deployment/docker-compose.md) |
| Kubernetes | планируется позже | [docs/deployment/kubernetes.md](docs/deployment/kubernetes.md) |

Для текущей ветки используйте Docker Compose-инструкцию.

## Документация сервисов

| Сервис | Документация |
| --- | --- |
| Frontend | [Frontend/README.md](Frontend/README.md) |
| UserService | [UserService/README.md](UserService/README.md) |
| ExecutionService | [ExecutionService/README.md](ExecutionService/README.md) |
| WorkerService | [WorkerService/README.md](WorkerService/README.md) |

## Основные frontend-страницы

| Страница | Назначение |
| --- | --- |
| `/landing` | Лендинг FlowAct |
| `/home` | Список notebook текущего пользователя |
| `/notebook/:notebookId` | Визуальный редактор workflow |
| `/my-account` | Страница аккаунта и настроек профиля |

## Горячие клавиши редактора

В редакторе notebook доступны сочетания клавиш:

| Сочетание | Действие |
| --- | --- |
| `Ctrl+S` / `Cmd+S` | Сохранить notebook |
| `Ctrl+Z` / `Cmd+Z` | Отменить последнее действие на canvas |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Повторить отменённое действие |
| `Ctrl+Y` / `Cmd+Y` | Альтернативный redo |
| `Ctrl+Enter` / `Cmd+Enter` | Запустить workflow |
| `Ctrl+Shift+A` / `Cmd+Shift+A` | Автосборка схемы |
| `Ctrl+Shift+V` / `Cmd+Shift+V` | Проверить схему |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Открыть панель логов/результата |

Комбинации не перехватываются внутри полей ввода, textarea, select и contenteditable-элементов, чтобы не мешать редактированию текста.

## Основные API

Базовый путь API:

```text
/api/v1
```

Auth/User endpoint-ы:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/users/me
PATCH /api/v1/users/me
```

Notebook/workflow/execution endpoint-ы:

```text
/api/v1/notebooks
/api/v1/notebooks/{notebookId}/workflows
/api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions
```

Защищённые endpoint-ы требуют:

```http
Authorization: Bearer <accessToken>
```

## Миграции БД

UserService использует Flyway:

```text
UserService/src/main/resources/db/migration
```

ExecutionService использует Flyway:

```text
ExecutionService/src/main/resources/db/migration
```

Hibernate работает в режиме:

```text
spring.jpa.hibernate.ddl-auto=validate
```

Это значит, что схема БД должна соответствовать Entity-классам. Если добавлено новое поле в Entity, нужно добавить SQL-миграцию.

## Проверка frontend

```bash
cd Frontend
npm run typecheck
npm run lint
npm run build
```

## Проверка backend-сервисов

UserService:

```bash
cd UserService
./gradlew test
./gradlew build
```

ExecutionService:

```bash
cd ExecutionService
./gradlew test
./gradlew build
```

WorkerService:

```bash
cd WorkerService
./gradlew test
./gradlew build
```

На Windows можно использовать `gradlew.bat`:

```powershell
.\gradlew.bat test
.\gradlew.bat build
```

## Частые команды

Логи всех сервисов:

```bash
docker compose logs -f
```

Логи frontend/nginx:

```bash
docker compose logs -f frontend
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

Логи Caddy:

```bash
docker compose logs -f caddy
```

Подключиться к БД ExecutionService:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Подключиться к БД UserService:

```bash
docker compose exec user-db psql -U postgres -d flowact_users
```

Полная очистка локального окружения:

```bash
docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up
```
