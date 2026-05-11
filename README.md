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
├── Frontend/                    # React + Vite frontend
├── ExecutionService/            # Spring Boot API для notebook/workflow/execution
├── WorkerService/               # Spring Boot worker для выполнения workflow
├── docs/deployment/             # инструкции запуска и развёртывания
├── docker-compose.yml
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

## Документация по запуску и развёртыванию

Инструкции запуска вынесены в отдельные документы:

| Вариант | Статус | Документация |
| --- | --- | --- |
| Docker Compose | основной локальный сценарий | [docs/deployment/docker-compose.md](docs/deployment/docker-compose.md) |
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

## Текущее состояние UserService

UserService/AuthService пока не реализован. До его подключения используется временная dev-auth-заглушка:

- frontend добавляет `Authorization` и `X-User-Id`;
- nginx в Docker-режиме добавляет fallback `X-User-Id`;
- backend использует `X-User-Id` как идентификатор текущего пользователя.

После разработки UserService этот слой нужно заменить на полноценную авторизацию через JWT.
