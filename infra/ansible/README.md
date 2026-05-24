# Ansible-инфраструктура FlowAct

В этом каталоге находится Ansible-автоматизация для подготовки виртуальных машин Ubuntu к развёртыванию Kubernetes-кластера.

Текущий playbook выполняет только базовую подготовку узлов. Он пока не запускает `kubeadm init` на управляющем узле и не выполняет `kubeadm join` на worker-узлах.

## Структура

```text
infra/ansible/
  ansible.cfg
  inventory.ini.example
  playbook.yml
  roles/
    common/
    containerd/
    kubernetes/
```

## Назначение

Ansible используется для того, чтобы все машины Kubernetes-кластера были настроены одинаково. Это снижает количество ручных действий перед созданием кластера и упрощает повторное развёртывание стенда.

Текущий набор ролей готовит серверы к установке Kubernetes:

- `common` — базовая подготовка ОС;
- `containerd` — установка и настройка container runtime;
- `kubernetes` — установка `kubelet`, `kubeadm` и `kubectl`.

## Использование

Перейти в каталог Ansible:

```bash
cd infra/ansible
```

Скопировать пример inventory-файла:

```bash
cp inventory.ini.example inventory.ini
```

В файле `inventory.ini` нужно заменить IP-адреса, имена узлов и SSH-пользователя на значения своего стенда:

```ini
[control_plane]
k8s-master ansible_host=192.168.1.10 ansible_user=ubuntu

[workers]
k8s-worker-1 ansible_host=192.168.1.11 ansible_user=ubuntu
k8s-worker-2 ansible_host=192.168.1.12 ansible_user=ubuntu
```

Установить локальную коллекцию Ansible, которая используется для загрузки kernel modules:

```bash
ansible-galaxy collection install community.general
```

Проверить подключение к узлам:

```bash
ansible all -m ping
```

Запустить подготовку всех узлов:

```bash
ansible-playbook playbook.yml
```

## Что делает playbook

Playbook выполняет следующие действия:

- устанавливает базовые системные пакеты;
- отключает swap в текущей сессии;
- отключает swap в `/etc/fstab`;
- загружает kernel modules `overlay` и `br_netfilter`;
- сохраняет список необходимых kernel modules в `/etc/modules-load.d/k8s.conf`;
- настраивает sysctl-параметры для Kubernetes;
- устанавливает `containerd`;
- включает systemd cgroup driver для `containerd`;
- добавляет официальный apt-репозиторий Kubernetes;
- устанавливает `kubelet`, `kubeadm` и `kubectl`;
- фиксирует версии Kubernetes-пакетов через `apt hold`, чтобы избежать случайного обновления.

## Ожидаемая среда

Текущий вариант рассчитан на Ubuntu/Debian-like серверы. Рекомендуемый вариант для учебного стенда:

- Ubuntu Server 22.04 или 24.04;
- доступ к узлам по SSH;
- пользователь с правами `sudo`;
- доступ машин к интернету для установки пакетов;
- минимум один управляющий узел и один worker-узел.

## Следующие шаги

После подготовки узлов нужно создать сам Kubernetes-кластер:

1. выполнить `kubeadm init` на control-plane узле;
2. настроить `kubectl` для администратора кластера;
3. установить CNI-плагин;
4. выполнить `kubeadm join` на worker-узлах;
5. проверить состояние узлов командой `kubectl get nodes`.

Эти действия будут вынесены в отдельные playbook-файлы на следующих этапах.
