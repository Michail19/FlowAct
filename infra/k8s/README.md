# Kubernetes-манифесты FlowAct

В этом каталоге находятся начальные Kubernetes-манифесты для развёртывания FlowAct.

Манифесты предназначены для учебного и демонстрационного стенда. Они позволяют перенести текущий Docker Compose-сценарий в Kubernetes и использовать Docker-образы, опубликованные в GitHub Container Registry.

## Структура

```text
infra/k8s/base/
  namespace.yaml
  configmaps.yaml
  secrets.example.yaml
  databases.yaml
  kafka.yaml
  apps.yaml
  ingress.yaml
  kustomization.yaml
```

## Состав манифестов

`namespace.yaml` создаёт namespace `flowact` и ServiceAccount `flowact-app`.

`configmaps.yaml` содержит обычные параметры конфигурации сервисов: адреса баз данных, адрес Kafka, порты, CORS-настройки, параметры логирования и URL внутренних сервисов.

`secrets.example.yaml` содержит пример Kubernetes Secret с placeholder-значениями. Реальные значения в репозиторий добавлять нельзя.

`databases.yaml` создаёт три PostgreSQL-экземпляра для сервисов:

- `execution-db`;
- `user-db`;
- `ml-db`.

Каждая база данных получает отдельный `PersistentVolumeClaim`.

`kafka.yaml` создаёт один Kafka broker для учебного стенда.

`apps.yaml` создаёт Deployment и Service для компонентов приложения:

- `user-service`;
- `execution-service`;
- `worker-service`;
- `ml-service`;
- `frontend`.

`ingress.yaml` содержит начальную конфигурацию Ingress для доступа к приложению через домен `flowact.local`.

`kustomization.yaml` объединяет все манифесты и позволяет применить их одной командой.

## Предварительные условия

Перед применением манифестов должны быть выполнены условия:

- Kubernetes-кластер уже создан;
- `kubectl` настроен на нужный кластер;
- в кластере установлен Ingress NGINX, если используется `ingress.yaml`;
- Docker-образы FlowAct опубликованы в GitHub Container Registry;
- если GHCR packages являются private, в кластере создан `imagePullSecret` для доступа к registry.

## Секреты

Файл `secrets.example.yaml` добавлен только как шаблон. Для реального запуска нужно создать локальный файл с настоящими значениями:

```bash
cp infra/k8s/base/secrets.example.yaml infra/k8s/base/secrets.yaml
```

После этого в `secrets.yaml` нужно заменить placeholder-значения на реальные. Файл `secrets.yaml` добавлен в `.gitignore`, поэтому он не должен попасть в репозиторий.

Есть два варианта применения secrets.

Первый вариант — применить secret вручную:

```bash
kubectl apply -f infra/k8s/base/secrets.yaml
```

Второй вариант — временно заменить в `kustomization.yaml` строку:

```yaml
- secrets.example.yaml
```

на:

```yaml
- secrets.yaml
```

и затем применить весь каталог через Kustomize.

## Применение манифестов

Из корня репозитория:

```bash
kubectl apply -k infra/k8s/base
```

Проверить созданные ресурсы:

```bash
kubectl get all -n flowact
kubectl get pvc -n flowact
kubectl get ingress -n flowact
```

Посмотреть состояние Pod'ов:

```bash
kubectl get pods -n flowact
kubectl describe pod <pod-name> -n flowact
kubectl logs <pod-name> -n flowact
```

## Доступ к приложению локально

Для локальной проверки без DNS нужно сопоставить домен `flowact.local` с IP-адресом Ingress Controller.

Для minikube IP можно получить командой:

```bash
minikube ip
```

После этого домен `flowact.local` нужно добавить в hosts-файл операционной системы.

## Работа с GHCR

В `apps.yaml` используются Docker-образы из GitHub Container Registry:

```text
ghcr.io/michail19/flowact-user-service:feature-deployment
ghcr.io/michail19/flowact-execution-service:feature-deployment
ghcr.io/michail19/flowact-worker-service:feature-deployment
ghcr.io/michail19/flowact-ml-service:feature-deployment
ghcr.io/michail19/flowact-frontend:feature-deployment
```

Если packages публичные, Kubernetes сможет скачать образы без дополнительной авторизации. Если packages закрытые, нужно создать secret для доступа к GHCR и подключить его к ServiceAccount `flowact-app`.

## Ограничения текущей версии

Текущие манифесты являются начальной базой для развёртывания. Они подходят для курсовой работы, локального стенда и демонстрации DevOps-подхода, но не являются production-ready конфигурацией.

Для production-развёртывания дополнительно потребуются:

- более строгая работа с secrets;
- resource requests и resource limits;
- TLS для Ingress;
- стратегия backup для баз данных;
- отдельная настройка Kafka;
- NetworkPolicy;
- разделение окружений на `local`, `dev` и `prod`;
- мониторинг состояния Kubernetes-ресурсов.
