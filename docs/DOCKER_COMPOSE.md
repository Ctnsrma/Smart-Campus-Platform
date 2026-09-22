# Docker Compose — Implementation Documentation

## Purpose

`docker-compose.yml` (repository root) builds and runs all seven
services together as a single system, using one command
(`docker compose up`) instead of building and running each service
manually. Postgres and RabbitMQ remain installed directly on the host
machine at this stage (see docs/DOCKER.md's "Known Limitation" section);
containerized services reach them via `host.docker.internal`.
Containerized services reach each other by service name (e.g.
`http://auth-service:3001`), using the network Compose creates
automatically.

## Notable Engineering Challenges Resolved

### 1. Parallel builds exhausted network reliability

**Symptom:** `docker compose up --build` (and later, plain
`docker compose build`) repeatedly failed with `ECONNRESET` and
`EIDLETIMEOUT` errors from npm, at inconsistent points across different
services on different attempts.

**Root cause:** Compose builds all services in parallel by default. With
seven services, each running two independent `npm ci` processes (build
stage and runtime stage), this produced up to fourteen simultaneous
connections to the npm registry, competing for available bandwidth and
occasionally exceeding what the connection could reliably sustain.

**Resolution:** built services individually
(`docker compose build <service-name>`, one at a time) to reduce
concurrent load, and configured npm itself to be more tolerant of a slow
connection (`fetch-retries`, `fetch-retry-mintimeout`, `fetch-timeout`
set in every Dockerfile) so transient stalls are retried automatically
rather than failing the whole build. Note: `docker compose build --parallel N`
was attempted but found unreliable on the installed Compose version,
which now delegates builds to Docker's newer "Bake" backend; this is a
documented, currently open limitation in Compose itself, not a
configuration mistake.

### 2. Missing `.dockerignore` increased build context size

**Symptom:** every build transferred a larger-than-necessary build
context, and build context loading was noticeably slower before this fix
than after.

**Resolution:** added a root-level `.dockerignore` (node_modules, dist,
.git, .env files) — since every service's Dockerfile shares the same
build context (the repository root, per docs/DOCKER.md), a single file
applies to all seven builds simultaneously; no per-service `.dockerignore`
is needed or possible.

### 3. A real TypeScript strictness gap, only caught by a full `tsc` build

**Symptom:** `notification-service`'s Docker build failed with
`error TS18046: 'body' is of type 'unknown'`, despite this exact code
having run correctly under `npm run dev` (via tsx) and passing all
automated tests for months.

**Root cause:** `response.json()` returns `unknown` in modern
TypeScript, a deliberate safety measure since the shape of a network
response cannot be statically known. `tsx` (used for `npm run dev`) and
Vitest's transform pipeline do not perform the same strict, blocking
type-check that a genuine `tsc` compilation does — meaning a real type
error can exist in a codebase, passing every day-to-day workflow, and
only surface the first time an actual production-style build is
attempted. This is a genuine, generalizable lesson: passing tests and a
working dev server do not guarantee a project is free of type errors.

**Resolution:** added an explicit type assertion
(`(await response.json()) as { accessToken: string }`) at each call
site with this pattern, across every service's test helper files that
shared this copy-pasted code.

## Unplanned but Genuinely Valuable Proof: Message Durability

Upon first bringing up all seven containers together, `notification-service`
and `analytics-service` immediately received and correctly processed a
large backlog of `attendance.marked`/`attendance.low` events — none of
which were deliberately triggered at that moment. This backlog had
silently and correctly accumulated in RabbitMQ's durable queues across
numerous earlier development-session crashes, terminal closures, and at
least one laptop sleep event (`ECONNRESET`, documented in
ANALYTICS_SERVICE.md), throughout the project's development.

This is a genuine, unstaged demonstration of the reliability guarantee
`durable: true` queues and `persistent: true` messages (docs/ATTENDANCE_SERVICE.md,
docs/NOTIFICATION_SERVICE.md) were designed to provide: not a single
event was lost across weeks of interrupted development, and RabbitMQ
correctly redelivered every unacknowledged message the moment a working
consumer became available again. Verified directly in the RabbitMQ
management UI: both queues' message counts (Ready, Unacked, Total)
returned to zero once the backlog fully drained.

## Verified

All seven services built successfully and started together via
`docker compose up`, correctly reaching Postgres and RabbitMQ on the host
machine and each other by Compose-assigned service hostnames.