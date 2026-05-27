# Развёртывание FlowAct в Kubernetes

Этот документ описывает текущий Kubernetes-сценарий развёртывания FlowAct. Kubernetes-конфигурация находится в каталоге `infra/k8s`, а подготовка виртуальных машин под кластер вынесена в `infra/ansible`.

На данном этапе Kubernetes-деплой предназначен для учебного и демонстрационного стенда. Он переносит Compose-архитектуру проекта в Kubernetes и использует Docker-образы, опубликованные в GitHub Container Registry.

## Общая схема

Текущий сценарий развёртывания выглядит так:

```text
GitHub Actions
  ↓
сборка Docker-образов
  ↓
публикация образов в GitHub Container Registry
  ↓
Kubernetes-кластер
  ↓
загрузка образов из GHCR
  ↓
запуск Pod'ов FlowAct
```

Конфигурация приложения не встраивается в Docker-образы. Значения окружения передаются через Kubernetes `ConfigMap` и `Secret`.

## Состав Kubernetes-развёртывания

В Kubernetes разворачиваются следующие компоненты:

- `frontend` — клиентская часть приложения;
- `user-service` — сервис пользователей и авторизации;
- `execution-service` — сервис управления и запуска рабочих процессов;
- `worker-service` — сервис выполнения задач;
- `ml-service` — сервис ML-рекомендаций;
- `execution-db` — PostgreSQL для ExecutionService и WorkerService;
- `user-db` — PostgreSQL для UserService;
- `ml-db` — PostgreSQL для MLService;
- `kafka` — брокер сообщений для асинхронного взаимодействия;
- `ingress` — входная точка для frontend и API.

## Структура файлов

Основные Kubernetes-манифесты находятся в каталоге:

```text
infra/k8s/base/
```

Состав файлов:

```text
namespace.yaml         # namespace flowact и ServiceAccount
configmaps.yaml       # обычные настройки сервисов
secrets.example.yaml  # пример Secret без настоящих значений
databases.yaml        # PostgreSQL для сервисов
kafka.yaml            # Kafka broker
apps.yaml             # Deployments и Services приложения
ingress.yaml          # Ingress для flowact.local
kustomization.yaml    # объединение манифестов
```

## Предварительные требования

Перед применением манифестов нужно подготовить:

1. Kubernetes-кластер.
2. Настроенный `kubectl`.
3. Установленный Ingress NGINX, если используется `ingress.yaml`.
4. Опубликованные Docker-образы FlowAct в GHCR.
5. Secret для доступа к GHCR, если packages закрытые.
6. Secret с настройками приложения.

## Подготовка узлов через Ansible

Для подготовки виртуальных машин под Kubernetes используется каталог:

```text
infra/ansible/
```

Ansible-playbook выполняет базовую подготовку серверов:

- устанавливает системные пакеты;
- отключает swap;
- настраивает kernel modules;
- настраивает sysctl-параметры;
- устанавливает и настраивает containerd;
- устанавливает `kubelet`, `kubeadm` и `kubectl`.

Пример запуска:

```bash
cd infra/ansible
cp inventory.ini.example inventory.ini
ansible-galaxy collection install community.general
ansible all -m ping
ansible-playbook playbook.yml
```

После подготовки узлов можно создавать кластер через `kubeadm init` и подключать worker-узлы через `kubeadm join`.

## Docker-образы

Docker-образы собираются в GitHub Actions и публикуются в GitHub Container Registry.

Используемые образы:

```text
ghcr.io/michail19/flowact-user-service:feature-deployment
ghcr.io/michail19/flowact-execution-service:feature-deployment
ghcr.io/michail19/flowact-worker-service:feature-deployment
ghcr.io/michail19/flowact-ml-service:feature-deployment
ghcr.io/michail19/flowact-frontend:feature-deployment
```

Для Kubernetes важно, что образы не содержат индивидуальные `.env`-файлы. Один и тот же image может использоваться в разных окружениях, а настройки передаются отдельно через `ConfigMap` и `Secret`.

## Настройки и secrets

Обычные параметры конфигурации находятся в `configmaps.yaml`. К ним относятся:

- адреса внутренних сервисов;
- JDBC URL баз данных;
- адрес Kafka;
- CORS-настройки;
- порты сервисов;
- параметры логирования;
- режимы OpenAPI и Swagger UI.

Чувствительные параметры вынесены в `Secret`:

- пароль PostgreSQL;
- логин и пароль подключения к БД;
- JWT secret;
- Django secret key;
- API key для OpenRouter;
- пароль SMTP.

Файл `secrets.example.yaml` содержит только пример. Для реального запуска нужно создать локальный файл:

```bash
cp infra/k8s/base/secrets.example.yaml infra/k8s/base/secrets.yaml
```

После этого нужно заменить placeholder-значения на реальные. Файл `secrets.yaml` добавлен в `.gitignore`, поэтому его нельзя случайно закоммитить.

Применить secret можно отдельно:

```bash
kubectl apply -f infra/k8s/base/secrets.yaml
```

Либо можно временно заменить в `kustomization.yaml` строку:

```yaml
- secrets.example.yaml
```

на:

```yaml
- secrets.yaml
```

## Доступ к GHCR из Kubernetes

Если packages в GHCR публичные, Kubernetes сможет скачать образы без дополнительной настройки.

Если packages закрытые, нужно создать Docker registry secret:

```bash
kubectl create secret docker-registry ghcr-secret \
  --namespace flowact \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --docker-email=<email>
```

После этого secret нужно подключить к ServiceAccount `flowact-app` в `namespace.yaml`:

```yaml
imagePullSecrets:
  - name: ghcr-secret
```

Для GitHub token достаточно права `read:packages`.

## Применение манифестов

Применить все базовые манифесты можно командой:

```bash
kubectl apply -k infra/k8s/base
```

Проверить состояние ресурсов:

```bash
kubectl get all -n flowact
kubectl get pvc -n flowact
kubectl get ingress -n flowact
```

Проверить состояние Pod'ов:

```bash
kubectl get pods -n flowact
kubectl describe pod <pod-name> -n flowact
kubectl logs <pod-name> -n flowact
```

Если Pod не запускается, сначала нужно смотреть:

```bash
kubectl describe pod <pod-name> -n flowact
```

Типовые причины ошибок:

- не скачался image из GHCR;
- не создан `flowact-secrets`;
- не поднялась база данных;
- сервис не может подключиться к Kafka;
- readiness probe получает ошибку;
- неверный URL внутреннего сервиса.

## Ingress и локальный доступ

Начальный Ingress использует домен:

```text
flowact.local
```

Для локальной проверки нужно сопоставить этот домен с IP-адресом Ingress Controller.

Для minikube IP можно получить так:

```bash
minikube ip
```

После этого IP нужно добавить в hosts-файл операционной системы.

Пример:

```text
192.168.49.2 flowact.local
```

После настройки приложение должно быть доступно по адресу:

```text
http://flowact.local
```

## Отличия от Docker Compose

В Docker Compose сервисы запускаются в одной compose-сети и часто используют `depends_on` для порядка запуска. В Kubernetes порядок запуска напрямую не задаётся. Вместо этого используются:

- `Service` для постоянного DNS-имени компонента;
- `readinessProbe` для определения готовности Pod'а;
- `livenessProbe` для проверки работоспособности Pod'а;
- повторные попытки подключения внутри приложений;
- `ConfigMap` и `Secret` для передачи настроек.

Поэтому при первом запуске часть Pod'ов может несколько раз перезапуститься, пока базы данных и Kafka не станут доступны.

## Текущие ограничения

Текущий Kubernetes-деплой является начальной версией. Он подходит для демонстрации DevOps-части проекта, но ещё не является production-ready.

Ограничения текущей версии:

- PostgreSQL разворачивается внутри кластера простыми Deployment-ами;
- Kafka разворачивается как один broker;
- нет TLS для Ingress;
- нет resource requests и limits;
- нет NetworkPolicy;
- нет автоматических backup баз данных;
- нет отдельных overlays для `local`, `dev` и `prod`;
- нет автоматического `kubeadm init` и `kubeadm join` через Ansible.

## Следующие шаги

План дальнейшей доработки:

1. Проверить запуск манифестов в minikube или kind.
2. Настроить `imagePullSecret`, если GHCR packages будут закрытыми.
3. Проверить Ingress-маршрутизацию frontend и API.
4. Добавить resource requests и limits.
5. Добавить Kubernetes-мониторинг через Prometheus и Grafana.
6. Подготовить overlays для разных окружений.
7. Автоматизировать создание кластера через Ansible.
8. При необходимости добавить Terraform для создания виртуальных машин.
