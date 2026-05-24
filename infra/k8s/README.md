# FlowAct Kubernetes manifests

This directory contains the first Kubernetes deployment manifests for FlowAct.

## Structure

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

## Prerequisites

- Kubernetes cluster is already created.
- Ingress NGINX is installed if `ingress.yaml` is used.
- Docker images are available in GitHub Container Registry.
- If GHCR packages are private, create `ghcr-secret` and attach it to the `flowact-app` ServiceAccount.

## Secrets

`secrets.example.yaml` is committed only as an example. For real deployment, copy it to a local `secrets.yaml` file and replace placeholder values.

Do not commit real secrets.

## Apply

From the repository root:

```bash
kubectl apply -k infra/k8s/base
```

Check resources:

```bash
kubectl get all -n flowact
kubectl get pvc -n flowact
kubectl get ingress -n flowact
```

## Local access

For local testing without DNS, map `flowact.local` to the IP address of the Kubernetes ingress controller. For minikube, this is usually the value returned by:

```bash
minikube ip
```

## Notes

These manifests are an initial deployment baseline. They are suitable for coursework/demo infrastructure, not for production. Production deployment should use stronger secrets management, resource requests/limits, separate database management, backups, TLS and stricter network/security policies.
