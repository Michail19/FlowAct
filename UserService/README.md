# FlowAct UserService

UserService — Spring Boot сервис FlowAct для пользователей и авторизации.

Он отвечает за:

- регистрацию пользователя;
- вход по email/password;
- выпуск JWT access token;
- выпуск и ротацию refresh token;
- logout через отзыв refresh token;
- получение текущего пользователя;
- обновление базовых данных профиля.

## Стек

- Java 21;
- Spring Boot;
- Spring Web;
- Spring Security;
- Spring OAuth2 Resource Server;
- Spring Data JPA;
- PostgreSQL;
- Flyway;
- BCrypt;
- Springdoc OpenAPI.

## Структура

```text
UserService/
├── src/main/java/com/ms/userservice/
│   ├── auth/          # auth controller, DTO, refresh token entity/service
│   ├── common/        # base entity, exceptions
│   ├── security/      # JWT/password/security config
│   ├── users/         # user entity, repository, service, controller
│   └── UserServiceApplication.java
├── src/main/resources/
│   ├── application.properties
│   └── db/migration/
├── Dockerfile
├── build.gradle
├── .env.example
└── README.md
```

## Роль в архитектуре FlowAct

UserService является источником пользовательской идентичности в проекте.

```text
Frontend
  -> /api/v1/auth/**  -> UserService
  -> /api/v1/users/** -> UserService

Frontend
  -> /api/v1/notebooks/**
  -> /api/v1/notebooks/{notebookId}/workflows/**
  -> /api/v1/notebooks/{notebookId}/workflows/{workflowId}/executions/**
      -> ExecutionService
```

UserService выпускает JWT, а ExecutionService проверяет этот JWT и берёт `userId` из claim `sub`.

```http
Authorization: Bearer <accessToken>
```

`X-User-Id` в актуальной JWT-схеме не используется.

## База данных

UserService использует отдельную PostgreSQL БД:

```text
flowact_users
```

В Docker Compose она поднимается отдельным контейнером:

```text
user-db
```

Локальный порт:

```text
localhost:5434 -> user-db:5432
```

Основные таблицы:

```text
users
refresh_tokens
```

### `users`

Назначение: хранение аккаунтов пользователей.

Ключевые поля:

| Поле | Назначение |
| --- | --- |
| `id` | UUID пользователя, используется в JWT `sub` |
| `email` | email для входа, уникален без учёта регистра |
| `username` | изменяемый username пользователя |
| `password_hash` | BCrypt-хеш пароля |
| `display_name` | отображаемое имя пользователя |
| `avatar_url` | ссылка на аватар или data URL загруженного изображения |
| `role` | роль пользователя: `USER`, `ADMIN` |
| `status` | статус аккаунта: `ACTIVE`, `BLOCKED`, `DELETED` |
| `last_login_at` | время последнего входа |
| `created_at`, `updated_at` | технические timestamps |

### `refresh_tokens`

Назначение: хранение refresh token для продления сессии.

Ключевые поля:

| Поле | Назначение |
| --- | --- |
| `id` | UUID refresh token записи |
| `user_id` | ссылка на пользователя |
| `token_hash` | SHA-256 hash refresh token |
| `expires_at` | срок действия |
| `revoked_at` | время отзыва token |
| `revoked_reason` | причина отзыва: например `LOGOUT` или `ROTATED` |
| `replaced_by_token_id` | новый token при ротации |
| `user_agent`, `ip_address` | техническая информация о клиенте |
| `created_at` | время создания |

Refresh token хранится в БД только в виде hash, не в открытом виде.

## Как сделать пользователя админом локально

Сначала зарегистрируйте пользователя через интерфейс или endpoint `/api/v1/auth/register`, затем обновите роль в БД UserService:

```bash
docker compose exec user-db psql -U postgres -d flowact_users -c "UPDATE users SET role = 'ADMIN' WHERE email = 'your-email@example.com';"
```

Проверка роли:

```bash
docker compose exec user-db psql -U postgres -d flowact_users -c "SELECT id, email, role, status FROM users ORDER BY created_at DESC;"
```

После изменения роли выйдите из аккаунта и войдите заново. Роль попадает в JWT, поэтому старый access token может ещё содержать `USER`.

Админ-панель frontend доступна по адресу:

```text
/admin
```

Если после изменения роли или миграций `/api/v1/users/me` отвечает `401`, значит браузер использует старую или недействительную сессию. Выйдите из аккаунта, очистите localStorage для `localhost:3000` и войдите заново.

## Переменные окружения

Пример находится в:

```text
UserService/.env.example
```

Основные переменные:

```env
SERVER_PORT=8083
SPRING_PROFILES_ACTIVE=init

DB_URL=jdbc:postgresql://localhost:5434/flowact_users
DB_USERNAME=postgres
DB_PASSWORD=postgres

JWT_SECRET=change-this-dev-secret-change-this-dev-secret
JWT_ISSUER=flowact-user-service
JWT_ACCESS_TOKEN_TTL_MINUTES=30
JWT_REFRESH_TOKEN_TTL_DAYS=14

BCRYPT_STRENGTH=12
```

В Docker Compose `DB_URL` указывает на внутренний контейнер:

```env
DB_URL=jdbc:postgresql://user-db:5432/flowact_users
```

`JWT_SECRET` должен совпадать с `JWT_SECRET` в ExecutionService, потому что UserService подписывает JWT, а ExecutionService проверяет его.

## API

Базовый путь:

```text
/api/v1
```

| Метод | Endpoint | Доступ | Назначение |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | публичный | регистрация пользователя |
| `POST` | `/api/v1/auth/login` | публичный | вход пользователя |
| `POST` | `/api/v1/auth/refresh` | публичный | ротация refresh token и выпуск нового access token |
| `POST` | `/api/v1/auth/logout` | публичный | отзыв refresh token |
| `GET` | `/api/v1/users/me` | JWT | получение текущего пользователя |
| `PATCH` | `/api/v1/users/me` | JWT | обновление профиля текущего пользователя |

### Регистрация

```http
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "User"
}
```

Ответ:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "user",
    "displayName": "User",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

### Вход

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Ответ аналогичен регистрации.

### Refresh token

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "..."
}
```

Ответ:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

Refresh token ротируется: старый token отзывается, новый сохраняется в БД.

### Logout

```http
POST /api/v1/auth/logout
Content-Type: application/json
```

```json
{
  "refreshToken": "..."
}
```

Успешный ответ:

```text
204 No Content
```

### Текущий пользователь

```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

Ответ:

```json
{
  "id": "...",
  "email": "user@example.com",
  "username": "user",
  "displayName": "User",
  "role": "USER",
  "status": "ACTIVE"
}
```

### Обновление профиля

```http
PATCH /api/v1/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "username": "new_username",
  "displayName": "New Name",
  "avatarUrl": null
}
```

## JWT

Access token содержит:

```json
{
  "sub": "userId",
  "email": "user@example.com",
  "role": "USER",
  "type": "access",
  "iss": "flowact-user-service",
  "iat": "...",
  "exp": "..."
}
```

`sub` используется другими сервисами как идентификатор текущего пользователя.

## Локальный запуск

Сначала поднимите PostgreSQL для UserService или используйте `docker compose` из корня проекта.

Через Docker Compose из корня проекта:

```bash
docker compose up -d --build user-db user-service
```

Проверка health:

```bash
curl http://localhost:8083/actuator/health
```

Swagger UI:

```text
http://localhost:8083/swagger-ui.html
```

## Запуск без Docker

Создайте `.env` на основе `.env.example` или задайте переменные окружения вручную.

На Windows PowerShell пример:

```powershell
$env:SERVER_PORT="8083"
$env:DB_URL="jdbc:postgresql://localhost:5434/flowact_users"
$env:DB_USERNAME="postgres"
$env:DB_PASSWORD="postgres"
$env:JWT_SECRET="change-this-dev-secret-change-this-dev-secret"
$env:JWT_ISSUER="flowact-user-service"
```

Запуск:

```powershell
.\gradlew.bat bootRun
```

Linux/macOS:

```bash
./gradlew bootRun
```

## Smoke-test через curl

Ниже команды для проверки сервиса через Docker Compose. Если запросы идут напрямую в UserService, используется порт `8083`. Если через frontend/nginx, можно заменить base URL на `http://localhost:3000`.

### 1. Healthcheck

```bash
curl http://localhost:8083/actuator/health
```

Ожидаемый ответ:

```json
{"status":"UP"}
```

### 2. Регистрация

Linux/macOS:

```bash
curl -X POST http://localhost:8083/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","displayName":"Test User"}'
```

Windows PowerShell:

```powershell
$registerResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8083/api/v1/auth/register" `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"password123","displayName":"Test User"}'

$accessToken = $registerResponse.accessToken
$refreshToken = $registerResponse.refreshToken
```

### 3. Получение текущего пользователя

Linux/macOS:

```bash
curl http://localhost:8083/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

Windows PowerShell:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8083/api/v1/users/me" `
  -Headers @{ Authorization = "Bearer $accessToken" }
```

### 4. Обновление профиля

Linux/macOS:

```bash
curl -X PATCH http://localhost:8083/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Updated User"}'
```

Windows PowerShell:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8083/api/v1/users/me" `
  -Headers @{ Authorization = "Bearer $accessToken" } `
  -ContentType "application/json" `
  -Body '{"displayName":"Updated User"}'
```

### 5. Refresh token

Linux/macOS:

```bash
curl -X POST http://localhost:8083/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

Windows PowerShell:

```powershell
$refreshResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8083/api/v1/auth/refresh" `
  -ContentType "application/json" `
  -Body "{`"refreshToken`":`"$refreshToken`"}"

$accessToken = $refreshResponse.accessToken
$refreshToken = $refreshResponse.refreshToken
```

После refresh старый refresh token становится недействительным.

### 6. Logout

Linux/macOS:

```bash
curl -i -X POST http://localhost:8083/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

Windows PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8083/api/v1/auth/logout" `
  -ContentType "application/json" `
  -Body "{`"refreshToken`":`"$refreshToken`"}"
```

После logout refresh token становится отозванным.

## Проверка БД

Подключиться к БД UserService:

```bash
docker compose exec user-db psql -U postgres -d flowact_users
```

Проверить пользователей:

```sql
SELECT id, email, username, display_name, role, status, last_login_at, created_at
FROM users
ORDER BY created_at DESC;
```

Проверить refresh token записи:

```sql
SELECT id, user_id, expires_at, revoked_at, revoked_reason, created_at
FROM refresh_tokens
ORDER BY created_at DESC;
```

Проверить Flyway-миграции:

```sql
SELECT * FROM flyway_schema_history ORDER BY installed_rank;
```

## Проверка сборки

```bash
./gradlew test
./gradlew build
```

На Windows:

```powershell
.\gradlew.bat test
.\gradlew.bat build
```

## Миграции

Flyway-миграции находятся в:

```text
src/main/resources/db/migration
```

Hibernate работает в режиме:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

При изменении entity нужно добавлять новую SQL-миграцию.