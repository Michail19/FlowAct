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
- home page со списком notebook текущего пользователя;
- страница аккаунта `/my-account`;
- регистрация, вход, logout и восстановление access token через refresh token;
- защищённые маршруты через `ProtectedRoute`;
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
- localStorage-кэш notebook, разделённый по текущему пользователю;
- синхронизация notebook/workflow с backend.

## Структура

```text
Frontend/
├── src/
│   ├── auth/                 # JWT session/auth слой, AuthProvider, ProtectedRoute
│   ├── components/auth/      # UI входа и регистрации
│   ├── components/notebook/  # редактор notebook/workflow
│   ├── hooks/                # React hooks
│   ├── pages/                # LandingPage, HomePage, NotebookPage, AccountPage
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
- UserService, если нужна регистрация/вход;
- ExecutionService, если нужна работа с notebook/workflow/execution.

## Установка

```bash
npm install
```

## Настройка окружения

Скопируйте пример env-файла:

```bash
cp .env.example .env
```

Для запуска frontend отдельно через `npm run dev` обычно используется:

```env
VITE_API_BASE_URL=/api
VITE_DEV_USER_API_PROXY_TARGET=http://localhost:8083
VITE_DEV_EXECUTION_API_PROXY_TARGET=http://localhost:8082
VITE_DEV_AUTH_ENABLED=false
```

Vite proxy отправляет:

```text
/api/v1/auth/**  -> UserService на 8083
/api/v1/users/** -> UserService на 8083
/api/**          -> ExecutionService на 8082
```

Если frontend запускается внутри Docker через nginx, используется:

```env
VITE_API_BASE_URL=/api
```

## Авторизация

Frontend работает с настоящей JWT-сессией:

1. пользователь регистрируется или входит через `/api/v1/auth/register` или `/api/v1/auth/login`;
2. UserService возвращает `accessToken`, `refreshToken` и объект пользователя;
3. frontend сохраняет сессию через `authStorage`/`authSession`;
4. `apiClient` добавляет заголовок:

```http
Authorization: Bearer <accessToken>
```

5. при `401` `apiClient` один раз пытается обновить access token через `/api/v1/auth/refresh`;
6. если refresh token недействителен, сессия очищается.

Основные frontend-файлы auth-слоя:

```text
src/auth/AuthContext.ts
src/auth/AuthProvider.tsx
src/auth/useAuth.ts
src/auth/ProtectedRoute.tsx
src/auth/authStorage.ts
src/auth/authSession.ts
src/auth/authHeaders.ts
src/services/authApi.ts
src/services/apiClient.ts
```

Dev-auth через `X-User-Id` больше не используется в обычном запуске. Переменная `VITE_DEV_AUTH_ENABLED` должна оставаться `false`.

## Запуск в dev-режиме

Перед запуском backend-сервисы должны быть доступны на локальных портах:

```text
UserService:      http://localhost:8083
ExecutionService: http://localhost:8082
```

Запуск frontend:

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
2. проксирует auth/users запросы в `user-service:8083`;
3. проксирует остальные `/api/...` запросы в `execution-service:8082`.

Маршрутизация:

```text
/api/v1/auth/**      -> user-service:8083
/api/v1/users/**     -> user-service:8083
/api/v1/notebooks/** -> execution-service:8082
/api/v1/...          -> execution-service:8082
```

Nginx прокидывает `Authorization`, но не добавляет `X-User-Id`.

## Основные страницы

| URL | Назначение |
| --- | --- |
| `/landing` | Лендинг продукта, вход и регистрация |
| `/home` | Список notebook текущего пользователя |
| `/notebook/:notebookId` | Редактор workflow |
| `/my-account` | Страница аккаунта и настроек профиля |

Маршруты `/home`, `/notebook/:notebookId` и `/my-account` защищены через `ProtectedRoute`.

## Работа с notebook

Frontend использует два уровня хранения:

1. backend API — основной источник notebook/workflow;
2. localStorage — fallback и локальный кэш.

LocalStorage-кэш разделён по текущему пользователю:

```text
flowact-notebooks:<userId>
flowact-notebook:<userId>:<notebookId>
```

Это предотвращает отображение notebook одного аккаунта в другом аккаунте при работе в одном браузере.

Если после перехода с dev-auth остались старые локальные данные, можно очистить localStorage для `localhost`:

```js
localStorage.clear();
```

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

Проверьте `VITE_API_BASE_URL` и dev proxy targets:

```env
VITE_API_BASE_URL=/api
VITE_DEV_USER_API_PROXY_TARGET=http://localhost:8083
VITE_DEV_EXECUTION_API_PROXY_TARGET=http://localhost:8082
```

После изменения env нужно перезапустить dev server.

### Backend возвращает 401/403

Проверьте:

- пользователь вошёл в аккаунт;
- в localStorage есть access token;
- `VITE_DEV_AUTH_ENABLED=false`;
- UserService и ExecutionService используют один и тот же `JWT_SECRET`;
- запрос содержит `Authorization: Bearer <accessToken>`.

### Notebook не видны или видны старые notebook

После перехода с dev-auth могли остаться старые записи localStorage. Очистите localStorage для `localhost` и войдите заново.

### После изменения env ничего не поменялось

Vite читает env-переменные на старте dev server. Нужно перезапустить:

```bash
npm run dev
```

Для Docker нужно пересобрать frontend-образ.
