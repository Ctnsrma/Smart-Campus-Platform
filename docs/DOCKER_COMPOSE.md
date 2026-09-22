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


## Full Containerization: Postgres and RabbitMQ

Following the plan from the earlier "Known Limitation" section, PostgreSQL
and RabbitMQ were containerized and added to docker-compose.yml, using
official images (postgres:16, rabbitmq:3-management) rather than custom
Dockerfiles, since neither requires any project-specific build step.
Postgres uses a named volume (postgres_data) to persist data independently
of the container's own lifecycle - without this, all data would be lost
the moment the container is removed or recreated.

### Migrating Existing Data into the New Container

Rather than starting with an empty database, the real data accumulated
across months of development (real registered test accounts, all seven
services' migration history) was preserved via `pg_dumpall`, restored
into the new container.

**Encoding issue:** an initial dump created via PowerShell's `>` redirection
operator was corrupted by an unwanted UTF-16 byte-order-mark, causing
`psql` to fail parsing the very first line. Resolved by using
`pg_dumpall`'s own `--file=` option instead, which writes the file directly
in the correct encoding, bypassing PowerShell's redirection behaviour
entirely.

**Cross-platform locale incompatibility:** the dump's `CREATE DATABASE`
statement specified a Windows-specific locale (`English_India.1252`),
which the Linux-based Postgres container could not recognise. Resolved by
manually editing the dump file to use `en_US.utf8`, a Postgres locale name
compatible with the Linux locale database bundled in the official image.

**Server-level vs database-level objects:** `pg_dumpall` (used instead of
`pg_dump`, specifically because it captures role definitions - a
server-level object - which a single-database `pg_dump` would not
include) correctly reproduced the `smart_campus` role and database from a
single file, with no separate manual role-creation step required.

**Host/container port ambiguity during migration:** the containerized
Postgres was temporarily mapped to host port 5433 (rather than the
standard 5432) specifically to guarantee an unambiguous target during the
migration, since the pre-existing host-installed Postgres was still
running on 5432 throughout. On Windows specifically, Docker Desktop's
port publishing did not produce a conflict error even when a host process
already held port 5432, making this precaution necessary to verify with
certainty which server a given connection was actually reaching, rather
than assuming.

Data integrity was verified directly after restore by querying real,
known records (a specific user's email) and confirming an exact match
against the original host database, not merely by the absence of a fatal
error during restore.

### Healthcheck Precision: `ping` vs Port Connectivity

**Symptom:** `notification-service` and `analytics-service` crashed with
`ECONNREFUSED` connecting to RabbitMQ, even after adding a
`depends_on: rabbitmq: condition: service_healthy` dependency with a
healthcheck using `rabbitmq-diagnostics -q ping`.

**Root cause:** `ping` verifies that RabbitMQ's Erlang node process is
responsive, but does not verify that RabbitMQ has finished its boot
sequence and opened its actual AMQP network listener (port 5672) - two
genuinely different milestones in RabbitMQ's startup, confirmed directly
in its own logs (the node responds to `ping`-equivalent checks before the
line `started TCP listener on [::]:5672` appears).

**Resolution:** switched the healthcheck to
`rabbitmq-diagnostics check_port_connectivity`, which specifically
verifies the configured network ports are open and accepting connections,
combined with a `start_period` grace window. Verified directly: RabbitMQ's
own connection log (`accepting AMQP connection`, `authenticated and
granted access to vhost '/'`) now shows successful connections from both
consumer services immediately following the healthcheck passing, with
zero connection-refused errors.