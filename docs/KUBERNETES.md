# Kubernetes — Implementation Documentation

## Cluster

A local k3s cluster (via k3d, which runs k3s nodes as Docker containers)
named `smart-campus`, single node. k3d was chosen over Docker Desktop's
built-in Kubernetes or Minikube per the original architecture document's
Phase 1 decision: genuinely full Kubernetes semantics, lightweight enough
for a single development machine, and directly analogous to the real k3s
deployment planned for the AWS phase.

## Status: Reference Pattern Established, Full Rollout In Progress

`auth-service` and `postgres` are fully deployed, correctly configured,
and verified end-to-end. This pair establishes the complete, correct
pattern (image handling, secrets, health probes, persistent storage) that
the remaining five services will follow. The remaining services,
RabbitMQ, and external access (Ingress) are sequenced as a direct
continuation of this same pattern.

## Notable Engineering Challenges Resolved

### 1. `kubectl` misconfigured to use `host.docker.internal` instead of `localhost`

**Symptom:** `kubectl cluster-info` failed with a connection timeout to
`host.docker.internal`, despite the cluster's containers running
correctly (confirmed via `docker ps`).

**Root cause:** a known k3d behaviour on Windows/Docker Desktop: the
generated kubeconfig pointed `kubectl` (running directly on the host) at
`host.docker.internal` - a hostname meant to be resolved from *inside* a
container to reach the host, not the reverse. Since the cluster's API
server port was published directly to the host, `localhost` was the
correct address.

**Resolution:** `kubectl config set-cluster k3d-smart-campus --server=https://localhost:<port>`,
directly correcting the misconfigured server address.

### 2. Locally-built images are invisible to the k3d cluster by default

**Symptom:** Pods failed with `ErrImagePull` / `ImagePullBackOff`, with
the underlying error revealing Kubernetes was attempting to pull the
image from Docker Hub (`docker.io`) and failing, since no such public
repository exists for a locally-built image name.

**Root cause:** k3d's cluster runs its own separate container runtime,
isolated from the regular Docker Desktop image store - even though the
image existed locally (built by Docker Compose), the cluster had no
access to it. Additionally, Kubernetes' default `imagePullPolicy` for an
image tagged `:latest` is `Always`, meaning it attempts a remote pull
even when a matching image might already be available locally.

**Resolution:** `k3d image import <image> -c <cluster>` to explicitly
copy the image into the cluster's runtime, combined with
`imagePullPolicy: Never` on the container spec, telling Kubernetes to
only ever use locally-available images. Documented as a local-development-specific
technique; the planned AWS deployment phase will use a real registry
(Amazon ECR) with normal pull policies instead.

### 3. Two distinct port-forwarding conflicts produced a false-positive test result

**Symptom:** an initial end-to-end test (`kubectl port-forward` to
`auth-service`, then a real registration request) appeared to succeed,
but a later, more careful re-test of the same scenario failed with a
database error claiming the target database did not exist.

**Root cause:** the Docker Compose stack (with real, previously-migrated
data) was still running in the background and had already bound host
port 3001 before `kubectl port-forward` attempted to bind the same port;
the test had silently reached the Compose stack's `auth-service`, not the
Kubernetes one. A second, related issue then surfaced: a stale `kubectl
port-forward` process from an earlier session had never been terminated
cleanly and continued holding port 3001 even after the relevant terminal
was closed, blocking a legitimate subsequent port-forward attempt.

**Resolution:** `docker compose down` to eliminate the first ambiguity;
`Get-Process`/`Stop-Process` (via the PID reported by `netstat -ano`) to
identify and terminate the leftover `kubectl` process for the second.
Both cases reinforce a recurring lesson from this project: an apparently
successful test result must be verified against the intended target
system with certainty, not accepted at face value, especially when
multiple similar systems (Compose, Kubernetes) can occupy the same local
ports.

## Configuration Patterns Established

- **Secrets**: a single shared `Secret` (`shared-secrets`) holds values
  needed identically across multiple services (`JWT_ACCESS_SECRET`) and
  per-service connection strings (`AUTH_DATABASE_URL`, etc.), referenced
  via `secretKeyRef` rather than plain-text `value:` fields - avoiding
  the need to hunt across multiple manifests when a shared value like the
  JWT secret needs rotation.
- **Health probes**: `readinessProbe` (short delay, controls whether a
  Pod receives traffic without restarting it) and `livenessProbe` (longer
  delay, triggers an actual container restart on failure), both wired to
  each service's existing `/health` endpoint - the same endpoint
  originally built for this exact purpose back when each service was
  first created, now finally connected to real orchestration.
- **Persistent storage**: Postgres uses a `PersistentVolumeClaim` (1Gi),
  mounted into the container at its data directory - necessary because a
  Kubernetes Pod's local filesystem is treated as fully disposable, more
  aggressively than a Docker Compose container's; without a PVC, any Pod
  restart would silently and completely erase the database.
- **Fresh environment, not migrated data**: this Kubernetes deployment
  intentionally uses a freshly-migrated (schema only, via drizzle-kit
  migrate against a port-forwarded connection), non-production dataset,
  rather than repeating the full data migration performed for Docker
  Compose (docs/DOCKER_COMPOSE.md) - a deliberate scope decision, since
  the migration mechanism itself offered no new concepts to learn a
  second time.

## Verified

A complete, honest end-to-end chain was proven: a real HTTP request,
through `kubectl port-forward`, to the `auth-service` Kubernetes Service,
routed to the `auth-service` Pod, which correctly reached the `postgres`
Kubernetes Service and Pod (via Kubernetes' internal DNS, using the
Service name `postgres`), performing a real, successful database write
against a schema created specifically for this cluster via `drizzle-kit
migrate` over a temporary port-forwarded connection.


## Full Rollout Completed

All seven services, Postgres, and RabbitMQ are deployed and running.
Two additional issues were encountered and resolved while completing the
rollout:

**Transient DNS failure pulling a public image**: RabbitMQ's initial pull
failed with a DNS resolution error reaching Docker Hub. Confirmed
non-persistent by testing DNS resolution from a throwaway diagnostic Pod
(`kubectl run ... --image=busybox -- nslookup ...`), which succeeded
immediately after - a fresh Pod (`kubectl delete pod`) then pulled
successfully. Documented as a transient infrastructure blip, not a
configuration error.

**Dependent services crash-looping until their dependency became
available**: `analytics-service` and `notification-service`, which call
`startConsumer()` immediately on boot, crashed repeatedly
(`CrashLoopBackOff`) while RabbitMQ was unavailable during the DNS issue
above. Once RabbitMQ became reachable, Kubernetes' automatic restart
mechanism recovered both services with no manual intervention -
confirmed by checking `kubectl logs` (showing a clean, successful most-recent
boot) against a `RESTARTS` count that had already stopped climbing, since
the pod status label itself can briefly lag the pod's true current state
after a transition. This is a genuine, unplanned demonstration of the
self-healing behaviour Kubernetes is specifically designed to provide,
directly comparable to the RabbitMQ message-durability proof documented
in docs/DOCKER_COMPOSE.md, just at the orchestration layer rather than
the messaging layer.

Every service's database schema was migrated into the cluster's Postgres
via `kubectl port-forward` plus a temporarily-overridden `DATABASE_URL`,
mirroring the exact same technique already established for auth-service
earlier in this document. A complete end-to-end test - registration and
login through the Gateway, followed by a cross-service profile lookup
also through the Gateway - was verified to correctly reach the intended
backend service and return that service's own genuine response, rather
than a routing failure or infrastructure error.