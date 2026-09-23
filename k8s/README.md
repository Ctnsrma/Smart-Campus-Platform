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

# Kubernetes Manifests

## Deployed and verified — full system, all seven services

- `shared-secrets.yaml` — shared Secret (JWT signing key, RabbitMQ URL, per-service DB connection strings)
- `postgres.yaml` — PersistentVolumeClaim, Deployment, Service
- `rabbitmq.yaml` — Deployment, Service
- `auth-service.yaml`, `student-service.yaml`, `course-service.yaml`,
  `attendance-service.yaml`, `notification-service.yaml`,
  `analytics-service.yaml`, `api-gateway.yaml` — one Deployment + Service
  each, following the shared reference pattern (health probes, Secret
  references, `imagePullPolicy: Never` for locally-imported images)

Every service's Drizzle migration has been run against this cluster's
Postgres (via a temporary `kubectl port-forward`), and a full end-to-end
flow (register → login → cross-service profile lookup, through the
Gateway) has been verified.

## Remaining
- Ingress, for external access without manual `kubectl port-forward`
  each time
- RBAC namespacing, resource limits/requests, and other production
  hardening — out of scope for this academic deployment's local cluster,
  but worth naming as a documented limitation

See docs/KUBERNETES.md for the full narrative, including every real issue
encountered and resolved while building this out.