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

Минимально нужны:

```env
DB_URL=jdbc:postgresql://localhost:5433/flowact_execution
DB_USERNAME=postgres
DB_PASSWORD=postgres
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

Также сервис поддерживает настройки ML-сервиса и LLM-провайдера. Реальные ключи и секреты нельзя хранить в репозитории.

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
