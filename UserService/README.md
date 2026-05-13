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

Refresh token хранится в БД только в виде hash, не в открытом виде.

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
  "displayName": "New Name"
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

## Проверка

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

## Частые проблемы

### UserService не стартует из-за JWT_SECRET

Проверьте, что переменная `JWT_SECRET` задана. Для HS256 используйте достаточно длинное значение.

### ExecutionService возвращает 401 для токена от UserService

Проверьте, что UserService и ExecutionService используют одинаковый `JWT_SECRET` и совместимый `JWT_ISSUER`.

### Регистрация возвращает 409

Пользователь с таким email уже существует. Email уникален без учёта регистра.

### Refresh token не работает

Refresh token может быть:

- просрочен;
- уже отозван через logout;
- уже заменён при прошлой refresh-операции.

В таком случае пользователь должен войти заново.
