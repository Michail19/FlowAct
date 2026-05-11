# FlowAct ExecutionService

ExecutionService — основной backend API-сервис FlowAct. Он отвечает за notebook, workflow, executions, валидацию схемы и отправку событий выполнения в Kafka.

## Назначение

ExecutionService выполняет следующие задачи:

- управление notebook;
- управление workflow внутри notebook;
- сохранение блоков и связей workflow;
- frontend/backend-валидация workflow;
- активация и архивирование workflow;
- создание execution;
- получение execution history;
- получение execution logs;
- retry / resume / cancel execution;
- публикация Kafka-событий для WorkerService.

## Стек

- Java 21;
- Spring Boot;
- Spring Web;
- Spring Data JPA;
- Hibernate;
- PostgreSQL;
- Flyway;
- Kafka;
- Springdoc OpenAPI;
- Actuator;
- Gradle.

## Основные API

Базовый URL:

```text
/api/v1
```

Notebook:

```text
GET    /api/v1/notebooks
POST   /api/v1/notebooks
GET    /api/v1/notebooks/{notebookId}
PUT    /api/v1/notebooks/{notebookId}
DELETE /api/v1/notebooks/{notebookId}
```

Workflow:

```text
GET  /api/v1/notebooks/{notebookId}/workflows
POST /api/v1/notebooks/{notebookId}/workflows
GET  /api/v1/notebooks/{notebookId}/workflows/{workflowId}
PUT  /api/v1/notebooks/{notebookId}/workflows/{workflowId}
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/validate
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/activate
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/archive
```

Executions:

```text
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions
GET  /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions
GET  /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions/{executionId}
GET  /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions/{executionId}/logs
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions/{executionId}/retry
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions/{executionId}/resume
POST /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions/{executionId}/cancel
```

## Auth-заглушка

До подключения UserService сервис ожидает заголовок:

```http
X-User-Id: 11111111-1111-1111-1111-111111111111
```

Он используется как идентификатор текущего пользователя-владельца notebook.

После разработки UserService этот механизм нужно заменить на JWT-проверку через AuthService/API Gateway.

## Переменные окружения

Скопируйте пример:

```bash
cp .env.example .env
```

Основные переменные:

```env
SERVER_PORT=8082
DB_URL=jdbc:postgresql://localhost:5433/flowact_execution
DB_USERNAME=postgres
DB_PASSWORD=postgres
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
SPRING_PROFILES_ACTIVE=init
```

## Профили

Поддерживаются профили:

| Профиль | Назначение |
| --- | --- |
| `init` | локальная разработка, миграции + testdata |
| `prod` | production-like режим, без testdata, менее подробные логи |

В `application.properties` профиль по умолчанию задаётся через `SPRING_PROFILES_ACTIVE`, а в Docker Compose сервис запускается с `prod`, если переменная не переопределена.

## Запуск через Docker Compose

Из корня проекта:

```bash
docker compose up --build execution-service
```

Обычно сервис доступен на:

```text
http://localhost:8082
```

Swagger UI:

```text
http://localhost:8082/swagger-ui.html
```

Healthcheck:

```text
http://localhost:8082/actuator/health
```

## Локальный запуск без Docker

Нужны PostgreSQL и Kafka.

Пример запуска PostgreSQL и Kafka можно взять из корневого `docker-compose.yml`, затем запустить сервис локально:

```bash
cd ExecutionService
cp .env.example .env
./gradlew bootRun
```

На Windows:

```powershell
cd ExecutionService
copy .env.example .env
.\gradlew.bat bootRun
```

Если IDE не подхватывает `.env`, переменные нужно задать в Run Configuration.

## Сборка

```bash
./gradlew clean build
```

Без тестов:

```bash
./gradlew clean bootJar -x test
```

## Docker

Сборка:

```bash
docker build -t flowact-execution-service .
```

Запуск вручную:

```bash
docker run --rm -p 8082:8082 \
  -e SERVER_PORT=8082 \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5433/flowact_execution \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=postgres \
  -e KAFKA_BOOTSTRAP_SERVERS=host.docker.internal:9092 \
  flowact-execution-service
```

## База данных

Сервис использует PostgreSQL.

Схема управляется Flyway:

```text
src/main/resources/db/migration
```

В режиме `init` дополнительно подключается:

```text
src/main/resources/db/testdata
```

Hibernate работает в режиме:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

Это значит, что Hibernate не создаёт таблицы автоматически. Если Entity изменилась, нужно добавить новую миграцию Flyway.

## Kafka

ExecutionService публикует события:

```text
flowact.execution.run.requested
flowact.execution.retry.requested
flowact.execution.resume.requested
flowact.execution.cancel.requested
```

Эти события читает WorkerService.

## OpenAPI

OpenAPI включается переменными:

```env
OPENAPI_ENABLED=true
SWAGGER_UI_ENABLED=true
```

Swagger UI:

```text
/swagger-ui.html
```

OpenAPI JSON:

```text
/v3/api-docs
```

## Логи

Основные переменные:

```env
LOG_LEVEL_ROOT=INFO
LOG_LEVEL_WEB=INFO
LOG_LEVEL_SQL=INFO
LOG_LEVEL_BIND=INFO
LOG_LEVEL_APP=DEBUG
```

Для отладки SQL можно включить:

```env
LOG_LEVEL_SQL=DEBUG
LOG_LEVEL_BIND=TRACE
JPA_SHOW_SQL=true
```

## Частые проблемы

### Schema-validation: missing column

Причина: Entity изменилась, а миграция не применена.

Решение:

```bash
docker compose logs execution-service
docker compose exec postgres psql -U postgres -d flowact_execution
```

Проверить таблицу:

```sql
\d workflows
```

Если данные не важны:

```bash
docker compose down -v
docker compose up --build
```

### Workflow не запускается из-за DRAFT

Перед запуском workflow должен быть сохранён и активирован.

Frontend делает это автоматически через:

```text
save workflow -> validate -> activate -> run execution
```

### 500 на бизнес-ошибках

Проверьте `GlobalExceptionHandler`. Для `IllegalStateException` желательно возвращать `409 Conflict`, а не `500 Internal Server Error`.
