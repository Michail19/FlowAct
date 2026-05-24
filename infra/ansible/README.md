# FlowAct Ansible infrastructure

This directory contains Ansible automation for preparing Ubuntu virtual machines for a Kubernetes cluster.

The playbook prepares nodes only. It does not run `kubeadm init` or `kubeadm join` yet.

## Structure

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

## Usage

1. Copy the inventory example:

```bash
cp inventory.ini.example inventory.ini
```

2. Edit node IP addresses and SSH user in `inventory.ini`.

3. Install required local Ansible collection:

```bash
ansible-galaxy collection install community.general
```

4. Check connectivity:

```bash
ansible all -m ping
```

5. Prepare all nodes:

```bash
ansible-playbook playbook.yml
```

## What the playbook does

- installs base packages;
- disables swap;
- loads `overlay` and `br_netfilter` kernel modules;
- configures Kubernetes sysctl parameters;
- installs and configures containerd;
- enables the systemd cgroup driver for containerd;
- adds the official Kubernetes apt repository;
- installs `kubelet`, `kubeadm` and `kubectl`;
- holds Kubernetes packages to avoid accidental version upgrades.

## Next steps

After all nodes are prepared, the cluster can be initialized with `kubeadm init` on the control-plane node and `kubeadm join` on worker nodes. This will be automated in a separate playbook later.
