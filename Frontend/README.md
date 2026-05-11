# FlowAct Frontend

Frontend FlowAct — SPA-приложение для визуального создания, редактирования и запуска workflow.

Стек:

- React;
- TypeScript;
- Vite;
- React Router;
- @xyflow/react для canvas-редактора;
- CSS Modules-like структура через обычные CSS-файлы.

## Основные возможности

В текущей версии реализованы:

- landing page;
- home page со списком notebook;
- визуальный редактор workflow;
- создание, редактирование и удаление блоков;
- соединение блоков связями;
- автосборка схемы;
- локальные AI-рекомендации;
- автодополнение несоединённых блоков;
- frontend-валидация workflow;
- backend-валидация workflow;
- запуск workflow через ExecutionService;
- просмотр логов выполнения;
- cancel / retry / resume для execution;
- локальный fallback через localStorage;
- синхронизация notebook/workflow с backend.

## Структура

```text
Frontend/
├── src/
│   ├── auth/                 # dev-auth и будущий session/auth слой
│   ├── components/notebook/  # редактор notebook/workflow
│   ├── hooks/                # React hooks
│   ├── pages/                # LandingPage, HomePage, NotebookPage
│   ├── services/             # API-клиенты и localStorage
│   └── styles/               # global.css, variables.css
├── Dockerfile
├── nginx.conf
├── package.json
├── .env.example
└── README.md
```

## Требования

- Node.js 22+;
- npm;
- backend ExecutionService, если нужна синхронизация с API.

## Установка

```bash
npm install
```

## Настройка окружения

Скопируйте пример env-файла:

```bash
cp .env.example .env
```

Для запуска frontend отдельно от Docker Compose обычно используется:

```env
VITE_API_BASE_URL=http://localhost:8082/api
VITE_DEV_AUTH_ENABLED=true
VITE_DEV_USER_ID=11111111-1111-1111-1111-111111111111
VITE_DEV_AUTH_TOKEN=dev-token
```

Если frontend запускается внутри Docker через nginx, используется:

```env
VITE_API_BASE_URL=/api
```

## Запуск в dev-режиме

```bash
npm run dev
```

Обычно Vite запускается на:

```text
http://localhost:5173
```

## Сборка

```bash
npm run build
```

Команда выполняет:

```bash
tsc --noEmit && vite build
```

То есть перед сборкой проверяются TypeScript-типы.

## Проверка типов

```bash
npm run typecheck
```

## Lint

```bash
npm run lint
```

## Preview production-сборки

```bash
npm run preview
```

## Docker

Сборка образа:

```bash
docker build -t flowact-frontend .
```

Запуск образа:

```bash
docker run --rm -p 3000:80 flowact-frontend
```

При запуске через корневой `docker-compose.yml` frontend доступен на:

```text
http://localhost:3000
```

## API proxy

В Docker-режиме frontend обслуживается через nginx.

`nginx.conf` делает две вещи:

1. отдаёт React SPA;
2. проксирует `/api/...` в `execution-service:8082`.

Также временно добавляется fallback-заголовок:

```http
X-User-Id: 00000000-0000-0000-0000-000000000001
```

Это нужно только до подключения UserService/AuthService.

## Dev-auth

Пока UserService не реализован, frontend использует dev-auth слой:

```text
src/auth/authStorage.ts
src/auth/authSession.ts
src/auth/authHeaders.ts
src/auth/devAuthStub.ts
```

Он добавляет:

```http
Authorization: Bearer dev-token
X-User-Id: 11111111-1111-1111-1111-111111111111
```

После подключения UserService этот слой нужно заменить на настоящую авторизацию и хранение JWT/refresh token.

## Основные страницы

| URL | Назначение |
| --- | --- |
| `/landing` | Лендинг продукта |
| `/home` | Список notebook |
| `/notebook/:notebookId` | Редактор workflow |
| `/my-account` | Будущая страница аккаунта |

## Работа с notebook

Frontend использует два уровня хранения:

1. backend API — основной источник notebook/workflow;
2. localStorage — fallback и локальный кэш.

Это позволяет открывать notebook быстрее и сохранять промежуточное состояние canvas.

## Команды package.json

```bash
npm run dev        # запуск Vite dev server
npm run build      # typecheck + production build
npm run typecheck  # проверка TypeScript
npm run lint       # ESLint
npm run preview    # preview production-сборки
```

## Частые проблемы

### API-запросы идут на неправильный адрес

Проверьте `VITE_API_BASE_URL`.

Для запуска frontend отдельно:

```env
VITE_API_BASE_URL=http://localhost:8082/api
```

Для Docker/nginx:

```env
VITE_API_BASE_URL=/api
```

### Backend возвращает 401/403 или notebook не видны

Проверьте dev-auth переменные:

```env
VITE_DEV_AUTH_ENABLED=true
VITE_DEV_USER_ID=11111111-1111-1111-1111-111111111111
VITE_DEV_AUTH_TOKEN=dev-token
```

### После изменения env ничего не поменялось

Vite читает env-переменные на старте dev server. Нужно перезапустить:

```bash
npm run dev
```

Для Docker нужно пересобрать frontend-образ.
