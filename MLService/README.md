# FlowAct MLService

MLService — микросервис проекта FlowAct для формирования ML-рекомендаций в визуальном редакторе рабочих процессов.

На текущем этапе сервис используется frontend-частью напрямую: редактор отправляет текущее состояние workflow, MLService извлекает признаки, выполняет классификацию и возвращает рекомендуемый следующий блок. WorkerService пока не зависит от MLService и не использует его при выполнении workflow.

## Стек

- Python 3.11
- Django
- Django REST Framework
- django-cors-headers
- PostgreSQL
- scikit-learn
- pandas
- joblib
- Gunicorn
- Docker

## Общая схема

```text
Frontend -> Django MLService -> WorkflowFeatureExtractor -> RandomForestClassifier -> RecommendationResponseBuilder -> Frontend
```

Если обученная модель недоступна, сервис использует резервный rule-based классификатор.

## Структура

```text
MLService/
├── artifacts/                  # сохранённые ML-артефакты
├── ml_service/                 # настройки Django-проекта
├── recommendations/            # API, признаки, классификатор, сборка ответа
├── training/                   # подготовка данных и обучение модели
├── Dockerfile
├── manage.py
├── requirements.txt
└── README.md
```

## Переменные окружения

Пример локального `.env`:

```env
DJANGO_SECRET_KEY=change-this-dev-secret
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,ml-service
DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

DB_ENGINE=sqlite
DB_NAME=flowact_ml
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
```

В Docker Compose сервис работает с PostgreSQL:

```env
DB_ENGINE=postgresql
DB_NAME=flowact_ml
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_HOST=ml-db
DB_PORT=5432
```

## Локальный запуск

```bash
cd MLService
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\activate
```

Установка зависимостей и запуск:

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

Проверка:

```text
GET /api/v1/health/
```

Ожидаемый ответ содержит статус сервиса и признак доступности обученной модели:

```json
{
  "status": "UP",
  "service": "ml-service",
  "version": "0.1.0",
  "classifier": {
    "trainedModelAvailable": true
  }
}
```

## Подготовка данных

Исходные экспертные примеры находятся в файле:

```text
training/data/training_workflows.json
```

Каждый пример содержит:

- `caseId` — идентификатор учебного случая;
- `workflow` — состояние рабочего процесса;
- `targetBlockId` — блок, после которого нужна рекомендация;
- `recommendedBlockType` — правильный следующий тип блока.

Сгенерировать CSV-датасет:

```bash
python training/generate_dataset.py
```

Сгенерировать датасет только из ручных примеров:

```bash
python training/generate_dataset.py --manual-only
```

Увеличить количество синтетических вариаций:

```bash
python training/generate_dataset.py --synthetic-repeats 20
```

Результат сохраняется в:

```text
training/data/training_dataset.csv
```

## Обучение модели

```bash
python training/train_classifier.py
```

После обучения создаются файлы:

```text
artifacts/block_classifier.joblib
artifacts/label_encoder.joblib
artifacts/model_meta.json
```

Оценка модели:

```bash
python training/evaluate_classifier.py
```

Если датасет небольшой или оценка выполняется на тех же примерах, точность может быть завышенной. Для повышения качества нужны дополнительные синтетические и реальные примеры.

## Как работает классификация

MLService не передаёт сырой JSON workflow напрямую в модель. Сначала `WorkflowFeatureExtractor` преобразует workflow в табличные признаки:

- количество блоков и связей;
- наличие стартового и конечного блока;
- тип целевого, предыдущего и последнего блока;
- количество входящих и исходящих связей у целевого блока;
- число незавершённых входов и выходов;
- количество блоков каждого типа;
- признаки условий и линейной глубины workflow.

После этого `RandomForestClassifier` предсказывает тип следующего блока. Вероятность предсказания используется как `confidence`.

Модель возвращает только тип блока и уверенность. Полный ответ для frontend собирает `RecommendationResponseBuilder`: он добавляет `id`, `kind`, `source`, `reason`, `targetBlockId`, `targetBlockTitle` и `proposedConfig`.

## API

### Healthcheck

```http
GET /api/v1/health/
```

### Рекомендация следующего блока

```http
POST /api/v1/recommendations/next-block/
```

Минимальная структура запроса:

```json
{
  "workflow": {
    "blocks": [],
    "connections": []
  },
  "targetBlockId": null,
  "limit": 3
}
```

Структура ответа:

```json
{
  "recommendations": [
    {
      "id": "ml:next-block:workflow:start",
      "kind": "next-block",
      "source": "ai",
      "blockType": "start",
      "confidence": 96,
      "reason": "...",
      "proposedConfig": {}
    }
  ]
}
```

## Docker

Сборка образа:

```bash
docker build -t flowact-ml-service .
```

Запуск отдельного контейнера:

```bash
docker run --rm -p 8000:8000 flowact-ml-service
```

## Docker Compose

В составе проекта сервис запускается вместе с отдельной PostgreSQL БД `ml-db`.

Из корня проекта:

```bash
docker compose up --build ml-db ml-service
```

После запуска healthcheck доступен по пути:

```text
/api/v1/health/
```

## Интеграция с frontend

Frontend должен использовать переменную:

```env
VITE_ML_SERVICE_BASE_URL=http://localhost:8000
```

Схема:

```text
NotebookEditor -> mlRecommendationApi.ts -> MLService -> NotebookSuggestion
```

Если MLService недоступен, frontend должен использовать локальные правила рекомендаций как fallback.

## Текущие ограничения

- Датасет формируется из экспертных и синтетических примеров.
- Качество модели зависит от полноты обучающих данных.
- Пользовательские реакции на рекомендации пока не сохраняются.
- WorkerService пока не использует MLService при выполнении workflow.
- Runtime endpoint `/predict` для ML-блоков пока не является основной частью сервиса.

## Дальнейшее развитие

- подключить frontend к endpoint рекомендаций;
- расширить датасет реальными действиями пользователей;
- сохранять принятие или отклонение ML-рекомендаций;
- добавить переобучение модели на накопленных данных;
- подключить WorkerService к MLService для выполнения ML-блоков внутри workflow;
- добавить мониторинг качества рекомендаций.
