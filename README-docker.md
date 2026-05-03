# FlowAct Docker local run

Copy these files into the repository root preserving paths:

- `docker-compose.yml` -> repository root
- `.env.docker.example` -> repository root, optionally copy to `.env`
- `ExecutionService/Dockerfile`
- `ExecutionService/.dockerignore`
- `WorkerService/Dockerfile`
- `WorkerService/.dockerignore`
- `Frontend/Dockerfile`
- `Frontend/nginx.conf`
- `Frontend/.dockerignore`

Run:

```bash
cp .env.docker.example .env
# edit .env if needed
docker compose up --build
```

URLs:

- Frontend: http://localhost:3000
- ExecutionService API: http://localhost:8082
- Swagger UI: http://localhost:8082/swagger-ui.html
- PostgreSQL from host: localhost:5433, db/user/password = flowact_execution/postgres/postgres

Notes:

- `Frontend/nginx.conf` proxies `/api/...` to `execution-service:8082` and injects a fixed `X-User-Id` for local development, because the current branch has no Auth/API Gateway service but backend controllers require this header.
- `SPRING_PROFILES_ACTIVE=init` loads test data. Use `prod` if repeated startup fails because seed SQL is not idempotent, or reset volumes with `docker compose down -v`.
- If an ML service is added later, add it to Compose and update `ML_SERVICE_URL` / `FLOWACT_ML_BASE_URL`.
