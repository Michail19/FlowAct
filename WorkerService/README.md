# FlowAct WorkerService

WorkerService — сервис выполнения workflow. Он получает события от ExecutionService, загружает workflow из PostgreSQL и выполняет блоки в заданном порядке.

## Назначение

WorkerService отвечает за:

- запуск workflow по событию выполнения;
- повторный запуск execution;
- отмену execution;
- продолжение execution из состояния ожидания;
- построение execution graph;
- выполнение блоков workflow;
- запись execution logs;
- обновление статуса execution;
- интеграцию с ML/LLM-блоками.

## Стек

- Java 21;
- Spring Boot;
- Spring Data JPA;
- PostgreSQL;
- Kafka;
- Gradle.

## Как работает выполнение

```text
Frontend
  -> ExecutionService
      -> PostgreSQL: создать execution
      -> Kafka: отправить событие запуска
          -> WorkerService
              -> PostgreSQL: загрузить workflow
              -> выполнить блоки
              -> PostgreSQL: сохранить логи и результат
```

## Основные события

WorkerService читает события выполнения:

- run requested;
- retry requested;
- resume requested;
- cancel requested.

Названия topic-ов и group id задаются через переменные окружения и описаны в `src/main/resources/application.properties`.

## Переменные окружения

Скопируйте пример окружения:

```bash
cp .env.example .env
```

Минимально для запуска WorkerService нужны настройки подключения к PostgreSQL и Kafka:

```bash
DB_URL=jdbc:postgresql://localhost:5433/flowact_execution
DB_USERNAME=postgres
DB_PASSWORD=postgres
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

### PostgreSQL

WorkerService использует ту же базу данных, что и ExecutionService. Это важно, потому что ExecutionService создаёт workflow и executions, а WorkerService читает их и обновляет результат выполнения.

```bash
DB_URL=jdbc:postgresql://localhost:5433/flowact_execution
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

При запуске через Docker Compose используется внутренний адрес контейнера PostgreSQL:

```bash
DB_URL=jdbc:postgresql://postgres:5432/flowact_execution
```

### Kafka

WorkerService читает события выполнения из Kafka. Для локального запуска без Docker обычно используется:

```bash
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

При запуске внутри Docker Compose используется внутренний Kafka listener:

```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9093
```

Основные topic-ы:

```bash
FLOWACT_KAFKA_EXECUTION_RUN_REQUESTED_TOPIC=flowact.execution.run.requested
FLOWACT_KAFKA_EXECUTION_RETRY_REQUESTED_TOPIC=flowact.execution.retry.requested
FLOWACT_KAFKA_EXECUTION_RESUME_REQUESTED_TOPIC=flowact.execution.resume.requested
FLOWACT_KAFKA_EXECUTION_CANCEL_REQUESTED_TOPIC=flowact.execution.cancel.requested
```

Group id для consumer-ов:

```bash
FLOWACT_KAFKA_EXECUTION_RUN_REQUESTED_GROUP_ID=flowact-execution-worker
FLOWACT_KAFKA_EXECUTION_RETRY_REQUESTED_GROUP_ID=flowact-execution-worker
FLOWACT_KAFKA_EXECUTION_RESUME_REQUESTED_GROUP_ID=flowact-execution-worker
FLOWACT_KAFKA_EXECUTION_CANCEL_REQUESTED_GROUP_ID=flowact-execution-worker
```

### ML Service

Для ML-блоков WorkerService может обращаться к отдельному ML Service:

```bash
FLOWACT_ML_BASE_URL=http://localhost:8000
FLOWACT_ML_PREDICT_PATH=/predict
```

При запуске WorkerService внутри Docker, если ML Service запущен на хост-машине, удобно использовать:

```bash
FLOWACT_ML_BASE_URL=http://host.docker.internal:8000
```

### LLM / OpenRouter

AI-блоки используют внешний LLM-провайдер через OpenRouter-compatible API.

```bash
FLOWACT_LLM_OPENROUTER_BASE_URL=https://openrouter.ai
FLOWACT_LLM_OPENROUTER_CHAT_PATH=/api/v1/chat/completions
FLOWACT_LLM_OPENROUTER_API_KEY=
FLOWACT_LLM_OPENROUTER_DEFAULT_MODEL=openrouter/free
FLOWACT_LLM_OPENROUTER_ALLOW_PAID_MODELS=false
FLOWACT_LLM_OPENROUTER_SITE_URL=
FLOWACT_LLM_OPENROUTER_APP_NAME=FlowAct
```

Основные настройки находятся в `src/main/resources/application.properties` и могут быть переопределены через переменные окружения:

```env
FLOWACT_LLM_OPENROUTER_BASE_URL=https://openrouter.ai
FLOWACT_LLM_OPENROUTER_CHAT_PATH=/api/v1/chat/completions
FLOWACT_LLM_OPENROUTER_API_KEY=
FLOWACT_LLM_OPENROUTER_DEFAULT_MODEL=openrouter/free
FLOWACT_LLM_OPENROUTER_ALLOW_PAID_MODELS=false
FLOWACT_LLM_OPENROUTER_SITE_URL=
FLOWACT_LLM_OPENROUTER_APP_NAME=FlowAct
```

Назначение переменных:

| Переменная | Назначение |
| --- | --- |
| ``FLOWACT_LLM_OPENROUTER_BASE_URL`` | базовый URL LLM-провайдера |
| ``FLOWACT_LLM_OPENROUTER_CHAT_PATH`` | путь до chat completions endpoint |
| ``FLOWACT_LLM_OPENROUTER_API_KEY`` | ключ доступа к провайдеру |
| ``FLOWACT_LLM_OPENROUTER_DEFAULT_MODEL`` | модель по умолчанию |
| ``FLOWACT_LLM_OPENROUTER_ALLOW_PAID_MODELS`` | разрешение на использование платных моделей |
| ``FLOWACT_LLM_OPENROUTER_SITE_URL`` | optional site URL для заголовков/метаданных |
| ``FLOWACT_LLM_OPENROUTER_APP_NAME`` | название приложения |

Реальный API key нельзя хранить в репозитории. В ``.env`` поле должно быть пустым:

```bash
FLOWACT_LLM_OPENROUTER_API_KEY=
```

Для локальной разработки безопаснее использовать:

```bash
FLOWACT_LLM_OPENROUTER_ALLOW_PAID_MODELS=false
```

Если AI-блок не работает, проверьте:

1. задан ли API key;
2. доступен ли внешний LLM endpoint из контейнера WorkerService;
3. корректно ли указан ``FLOWACT_LLM_OPENROUTER_DEFAULT_MODEL``;
4. не заблокирована ли модель настройкой ``FLOWACT_LLM_OPENROUTER_ALLOW_PAID_MODELS=false``;
5. есть ли ошибка в логах WorkerService.

Логи WorkerService:

```bash
docker compose logs -f worker-service
```

## Пример `.env.example`

Для WorkerService можно использовать следующий `.env.example`:

```env
# =========================
# WorkerService env
# =========================

# =========================
# Datasource
# =========================

DB_URL=jdbc:postgresql://localhost:5433/flowact_execution
DB_USERNAME=postgres
DB_PASSWORD=postgres

# =========================
# Kafka
# =========================

KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP_ID=flowact-execution-worker
KAFKA_AUTO_OFFSET_RESET=earliest

FLOWACT_KAFKA_EXECUTION_RUN_REQUESTED_TOPIC=flowact.execution.run.requested
FLOWACT_KAFKA_EXECUTION_RUN_REQUESTED_GROUP_ID=flowact-execution-worker

FLOWACT_KAFKA_EXECUTION_RETRY_REQUESTED_TOPIC=flowact.execution.retry.requested
FLOWACT_KAFKA_EXECUTION_RETRY_REQUESTED_GROUP_ID=flowact-execution-worker

FLOWACT_KAFKA_EXECUTION_RESUME_REQUESTED_TOPIC=flowact.execution.resume.requested
FLOWACT_KAFKA_EXECUTION_RESUME_REQUESTED_GROUP_ID=flowact-execution-worker

FLOWACT_KAFKA_EXECUTION_CANCEL_REQUESTED_TOPIC=flowact.execution.cancel.requested
FLOWACT_KAFKA_EXECUTION_CANCEL_REQUESTED_GROUP_ID=flowact-execution-worker

# =========================
# ML service
# =========================

FLOWACT_ML_BASE_URL=http://localhost:8000
FLOWACT_ML_PREDICT_PATH=/predict

# =========================
# LLM / OpenRouter
# =========================

FLOWACT_LLM_OPENROUTER_BASE_URL=https://openrouter.ai
FLOWACT_LLM_OPENROUTER_CHAT_PATH=/api/v1/chat/completions

# Do not commit real API keys.
FLOWACT_LLM_OPENROUTER_API_KEY=

# Replace with a real model id when LLM integration is configured.
FLOWACT_LLM_OPENROUTER_DEFAULT_MODEL=openrouter/free

# Keep false to avoid accidental paid model calls.
FLOWACT_LLM_OPENROUTER_ALLOW_PAID_MODELS=false

FLOWACT_LLM_OPENROUTER_SITE_URL=
FLOWACT_LLM_OPENROUTER_APP_NAME=FlowAct
```

Для Docker Compose часть этих переменных уже задаётся в docker-compose.yml, но отдельный .env.example удобен для локального запуска WorkerService без Docker.

## Запуск через Docker Compose

Из корня проекта:

```bash
docker compose up --build worker-service
```

WorkerService не публикует пользовательский HTTP API наружу. Он работает как внутренний consumer событий.

## Локальный запуск без Docker

Нужны PostgreSQL и Kafka.

```bash
cd WorkerService
cp .env.example .env
./gradlew bootRun
```

На Windows:

```powershell
cd WorkerService
copy .env.example .env
.\gradlew.bat bootRun
```

Если IDE не подхватывает `.env`, переменные нужно указать в Run Configuration.

## Сборка

```bash
./gradlew clean build
```

Без тестов:

```bash
./gradlew clean bootJar -x test
```

## Docker

Сборка образа:

```bash
docker build -t flowact-worker-service .
```

При ручном запуске контейнера нужно передать настройки подключения к PostgreSQL и Kafka через переменные окружения.

## База данных

WorkerService использует ту же PostgreSQL-базу, что и ExecutionService.

Hibernate работает в режиме:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

Поэтому схема БД должна соответствовать Entity-классам. Если Entity изменилась, нужно добавить миграцию в ExecutionService и применить её к общей базе.

## Execution statuses

WorkerService обновляет execution status:

| Статус | Значение |
| --- | --- |
| `PENDING` | execution создан и ожидает обработки |
| `RUNNING` | workflow выполняется |
| `WAITING` | workflow ждёт внешнего resume-события |
| `SUCCESS` | workflow успешно завершён |
| `FAILED` | выполнение завершилось ошибкой |
| `CANCELLING` | получен запрос на отмену |
| `CANCELLED` | выполнение отменено |

## Cancel / Retry / Resume

### Cancel

ExecutionService переводит execution в `CANCELLING` или `CANCELLED`, затем WorkerService проверяет статус между блоками. Если workflow очень короткий, он может завершиться раньше отмены.

### Retry

ExecutionService создаёт новый execution на основе старого и отправляет событие повторного запуска. WorkerService обрабатывает его как новый run.

### Resume

Resume работает для execution в статусе `WAITING`. В текущей реализации resume передаёт payload продолжения, но полноценное восстановление всего ExecutionContext запланировано как дальнейшая доработка.

## Частые проблемы

### WorkerService падает на schema-validation

Проверьте, что миграции БД применены:

```bash
docker compose exec postgres psql -U postgres -d flowact_execution
```

Например:

```sql
\d workflows
```

Если данные не важны:

```bash
docker compose down -v
docker compose up --build
```

### WorkerService не получает события

Проверьте логи:

```bash
docker compose logs kafka
docker compose logs worker-service
```

Также проверьте, что ExecutionService и WorkerService используют одинаковые topic names.

### Retry/cancel не срабатывают

Проверьте:

- статус execution;
- логи ExecutionService;
- логи WorkerService;
- настройки Kafka;
- group id consumer-ов.

### AI/ML-блок не работает

Проверьте настройки ML/LLM-сервисов в переменных окружения WorkerService и убедитесь, что внешний сервис доступен из контейнера.
