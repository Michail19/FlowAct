# Развёртывание FlowAct в Kubernetes

Этот документ зарезервирован под будущую инструкцию развёртывания FlowAct в Kubernetes.

На текущем этапе основной поддерживаемый сценарий запуска — Docker Compose:

- [docker-compose.md](docker-compose.md)

## Планируемый состав Kubernetes-развёртывания

В будущем Kubernetes-вариант должен включать:

- Deployment для Frontend;
- Deployment для ExecutionService;
- Deployment для WorkerService;
- StatefulSet или внешний managed PostgreSQL;
- Kafka внутри кластера или внешний Kafka-compatible broker;
- Service для каждого внутреннего компонента;
- Ingress для frontend/API;
- ConfigMap для обычных настроек;
- Secret для чувствительных параметров;
- readiness/liveness probes;
- resource requests/limits;
- отдельные overlays для local/dev/prod.

## Предварительная структура манифестов

Возможная будущая структура:

```text
k8s/
├── base/
│   ├── frontend/
│   ├── execution-service/
│   ├── worker-service/
│   ├── postgres/
│   ├── kafka/
│   └── ingress/
└── overlays/
    ├── local/
    ├── dev/
    └── prod/
```

## Что нужно решить перед Kubernetes

Перед подготовкой полноценного Kubernetes-развёртывания нужно определить:

1. где будет жить PostgreSQL: внутри кластера или как внешний managed-сервис;
2. где будет жить Kafka: внутри кластера или как внешний broker;
3. будет ли отдельный API Gateway;
4. как будет подключён UserService/AuthService;
5. как хранить secrets;
6. какие лимиты ресурсов нужны сервисам;
7. какой ingress-controller будет использоваться;
8. какая стратегия обновления нужна для WorkerService.

## Текущий статус

Kubernetes-деплой пока не реализован. Документ будет расширен после стабилизации Docker Compose-сценария и появления UserService/AuthService.
