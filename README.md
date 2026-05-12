# FlowAct

FlowAct — веб-приложение для визуального создания, настройки и запуска рабочих процессов. Проект развивается как аналог n8n: пользователь собирает workflow из блоков, соединяет их связями, запускает выполнение и анализирует результат через логи.

В текущей версии реализованы:

- визуальный frontend-редактор workflow;
- хранение notebook/workflow в PostgreSQL;
- ExecutionService для управления notebook, workflow и executions;
- WorkerService для выполнения workflow через Kafka-события;
- локальная dev-auth-заглушка до подключения UserService;
- подготовка под AI-рекомендации и AI-блоки;
- Docker Compose-окружение для запуска frontend, backend-сервисов, PostgreSQL, Kafka и Caddy.

## Архитектура

Текущий состав проекта:

```text
FlowAct/
├── Frontend/                    # React + Vite frontend, сборка отдаётся через nginx
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
| Frontend | SPA-интерфейс FlowAct, landing, home и визуальный редактор workflow |
| ExecutionService | REST API для notebook, workflow, валидации и execution |
| WorkerService | Выполнение workflow по событиям из Kafka |
| PostgreSQL | Хранение notebook, workflow, blocks, connections, executions и logs |
| Kafka | Очередь событий запуска, повтора, отмены и продолжения execution |
| Caddy | Reverse proxy для публикации frontend по домену и автоматического HTTPS |

Упрощённая схема запуска через Docker Compose:

```text
Browser
  -> Caddy :80/:443
      -> frontend:80
          -> /api/* -> execution-service:8082
              -> PostgreSQL
              -> Kafka
                  -> worker-service
                      -> PostgreSQL
                      -> ML/LLM integrations
```

## Быстрый запуск через Docker Compose

Для локального запуска из корня проекта:

```bash
cp .env.example .env
cp Caddyfile.example Caddyfile
```

Если запускаете проект локально без домена, frontend можно открыть напрямую на `http://localhost:3000`. В этом случае Caddy нужен не всегда, но файл `Caddyfile` всё равно стоит создать, потому что `docker-compose.yml` монтирует его в сервис `caddy`.

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
Frontend:          http://localhost:3000
ExecutionService:  http://localhost:8082
Swagger UI:        http://localhost:8082/swagger-ui.html
Actuator health:   http://localhost:8082/actuator/health
PostgreSQL:        localhost:5433
Kafka:             localhost:9092
Caddy:             http://localhost или https://<ваш-домен>
```

Остановка:

```bash
docker compose down
```

Остановка с удалением volume PostgreSQL и Caddy:

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

Затем замените домен-заглушку в `Caddyfile`:

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

Если Caddy не нужен в локальной разработке, можно работать через `http://localhost:3000`, но для полного `docker compose up` файл `Caddyfile` всё равно должен существовать.

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
| ExecutionService | [ExecutionService/README.md](ExecutionService/README.md) |
| WorkerService | [WorkerService/README.md](WorkerService/README.md) |

## Основные frontend-страницы

| Страница | Назначение |
| --- | --- |
| `/landing` | Лендинг FlowAct |
| `/home` | Список notebook |
| `/notebook/:notebookId` | Визуальный редактор workflow |
| `/my-account` | Будущая страница аккаунта, будет дорабатываться вместе с UserService |

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

## Проверка frontend

```bash
cd Frontend
npm run typecheck
npm run lint
npm run build
```

## Проверка backend-сервисов

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

## Текущее состояние UserService

UserService/AuthService пока не реализован. До его подключения используется временная dev-auth-заглушка:

- frontend добавляет `Authorization` и `X-User-Id`;
- nginx в Docker-режиме добавляет fallback `X-User-Id`;
- backend использует `X-User-Id` как идентификатор текущего пользователя.

После разработки UserService этот слой нужно заменить на полноценную авторизацию через JWT.

## Частые команды

Логи всех сервисов:

```bash
docker compose logs -f
```

Логи frontend/nginx:

```bash
docker compose logs -f frontend
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

Подключиться к PostgreSQL:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Полная очистка локального окружения:

```bash
docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up
```
