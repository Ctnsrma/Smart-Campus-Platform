# Docker — Implementation Documentation

## Multi-Stage Build Pattern

Every service Dockerfile uses a two-stage build: a `build` stage installs
all dependencies (including devDependencies) and compiles TypeScript to
JavaScript, and a `runtime` stage starts fresh, installs only production
dependencies (`npm ci --omit=dev`), and copies in just the compiled
`dist/` output from the build stage. TypeScript, `tsx`, and all dev
tooling never exist in the final image — reducing both image size and
attack surface (fewer installed packages means fewer potential
vulnerabilities). Measured result for auth-service: 56.2MB content size,
244MB total disk usage (shared base layers included).

## Monorepo Build Context

Because this is an npm workspaces monorepo, every service's Dockerfile
must be built with the **repository root** as the build context, not the
service's own folder — otherwise Docker cannot see the root
`package.json`, `package-lock.json`, or `tsconfig.base.json` that the
service depends on:


```
docker build -f services/auth-service/Dockerfile -t smart-campus/auth-service:dev .
```


(the trailing `.` is the build context — the current directory, expected
to be the repo root — and is easy to forget, producing a
`requires 1 argument` error if omitted.)

## Local Development: Reaching Host Machine Services

Containerized services need to reach PostgreSQL and RabbitMQ, both of
which run directly on the host machine (not yet containerized
themselves) during local development. A container's own `localhost`
refers to the container's isolated network namespace, not the host
machine — confirmed directly: a container using
`DATABASE_URL=...@localhost:5432/...` failed with a real connection
error when queried.

**Resolution:** Docker Desktop provides `host.docker.internal`, a
built-in DNS name resolving to the host machine from inside any
container. Local development runs override `DATABASE_URL` via `-e` on
the `docker run` command (not by editing `.env`, which remains correct
for non-containerized `npm run dev` usage):

```
docker run -p 3001:3001 --env-file services/auth-service/.env -e DATABASE_URL="postgres://smart_campus:smart_campus_dev_password@host.docker.internal:5432/smart_campus schema=auth_service"
smart-campus/auth-service:dev
```


## Known Limitation: Not Yet Using Docker Compose

At this stage, each service's image is built and run manually and
individually, with PostgreSQL and RabbitMQ remaining installed directly
on the host rather than containerized. This is a deliberate, sequenced
choice: Docker Compose (for running multiple related containers
together) is introduced only after every individual service's Dockerfile
is confirmed working in isolation — at which point containerizing
PostgreSQL and RabbitMQ as part of that same Compose setup becomes the
natural next step, since Compose is specifically designed for
multi-container coordination.