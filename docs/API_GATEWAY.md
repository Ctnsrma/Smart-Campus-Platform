# API Gateway — Implementation Documentation

## Purpose

Single entry point (port 3000) for all client traffic, using path-based
reverse proxying to forward requests to the correct backend service
without the client needing to know individual service ports.

## Routing Table

| Path prefix | Forwards to |
|---|---|
| `/auth/*` | Auth Service (3001) |
| `/students/*` | Student Service (3002) |
| `/courses/*` | Course Service (3003) |
| `/attendance/*` | Attendance Service (3004) |

The Gateway holds no database, no business logic, and no JWT
verification of its own at this stage — it only forwards. Each backend
service continues to independently verify JWTs itself (see
AUTH_SERVICE.md/STUDENT_SERVICE.md), preserving defense-in-depth even
though a Gateway now sits in front of them.

## Notable Engineering Challenges Resolved

### 1. `http-proxy-middleware` v3+ strips the Express mount path

**Symptom:** requests forwarded through `app.use("/auth", createProxyMiddleware({...}))`
arrived at the target service missing their prefix — `/auth/register`
was received by Auth Service as just `/register`, a route that does not
exist.

**Root cause:** `http-proxy-middleware` v3 onward deliberately changed
this behaviour: when a proxy is mounted via Express's own
`app.use(path, ...)` form, Express passes the proxy a path relative to
that mount point, and the library forwards that relative path — silently
stripping the prefix the client actually sent.

**Resolution:** each proxy is now mounted at the application root
(`app.use(createProxyMiddleware({...}))`, no path argument), using the
library's own `pathFilter` option to decide which requests to handle
instead. `pathFilter` only filters; it never rewrites the path, so the
full original path reaches the target unchanged.

### 2. Missing `tsconfig.json` caused compiled output inside `src/`

**Symptom:** running `npm run build` produced `.js` files sitting
directly next to their `.ts` source files, rather than in a separate
`dist/` folder as in every other service.

**Root cause:** this service's `tsconfig.json` was never created during
initial scaffolding. Without `rootDir`/`outDir` configured, TypeScript's
default behaviour compiles each file in place.

**Resolution:** created `tsconfig.json` matching the established
project-wide pattern; deleted the stray compiled files.

### 3. `/health` is a deliberate exception to the path-prefix convention

**Symptom:** `GET /students/health`, `/courses/health`, and
`/attendance/health`, called through the Gateway, all failed with
`Cannot GET ...` even though the underlying services were running and
healthy, and even though the equivalent business routes (e.g.
`/students/me`) worked correctly through the same Gateway configuration.

**Root cause:** every service's `/health` endpoint is registered at the
plain, unprefixed path `/health` — deliberately, since this route is
meant to be hit directly by container orchestration tooling (Kubernetes
probes) on a service's own internal port, not routed through the
Gateway. Every other, genuinely client-facing route in each service
(`/auth/*`, `/students/*`, `/courses/*`, `/attendance/*`) is correctly
self-prefixed. Testing `/health` *through* the Gateway with the same
prefix as business routes was testing a path that was never intended to
exist there.

**Resolution:** no code change — this is documented, intentional
behaviour. Gateway-routed verification uses real business routes (e.g.
`/students/me` after a real login) rather than `/health`, which remains
a direct, per-service, unprefixed check.

## Verified

A full round-trip was confirmed: login via `POST /auth/login` through
the Gateway (routed to Auth Service), followed by using the returned
token against `GET /students/me` through the Gateway (routed to Student
Service), correctly returning the authenticated user's own profile — two
different backend services, reached through one single port, with the
Gateway performing no logic beyond path-based forwarding.