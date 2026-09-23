# Kubernetes Manifests

## Deployed and verified
- `shared-secrets.yaml` — shared Secret (JWT signing key, per-service DB connection strings)
- `postgres.yaml` — PersistentVolumeClaim, Deployment, Service
- `auth-service.yaml` — Deployment (with health probes, secrets, imagePullPolicy: Never), Service

## Remaining (follows the exact same pattern as auth-service.yaml)
- RabbitMQ (Deployment + Service, no persistent storage needed for local dev)
- student-service, course-service, attendance-service, notification-service, analytics-service
- api-gateway
- Ingress, for external access without manual `kubectl port-forward`

See docs/KUBERNETES.md for the full narrative, including real issues
encountered and resolved while building the reference pattern above.