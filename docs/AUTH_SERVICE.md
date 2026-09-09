# Auth Service — Implementation Documentation

## 1. Purpose

The Auth Service is one of six microservices in the Smart Campus Service Platform.
It owns identity for the entire system: user registration, authentication, session
management (via JWT access + refresh tokens), and role-based access control (RBAC).
No other service stores passwords or issues tokens — every other service will trust
tokens issued here.

## 2. Technology Stack and Rationale

| Choice | Alternative considered | Why this choice |
|---|---|---|
| Drizzle ORM | Prisma | Prisma requires downloading a compiled binary "engine" during setup, which can fail in restricted/offline environments. Drizzle is pure TypeScript, generates plain inspectable SQL migrations, and has zero extra binary dependencies. |
| bcryptjs | bcrypt (native) | The native `bcrypt` package requires C++ compilation during install, which fails on machines without build tools configured. `bcryptjs` is a pure-JS reimplementation of the identical algorithm — functionally equivalent at our scale, with zero install friction. |
| Opaque random refresh tokens (SHA-256 hashed at rest) | Refresh tokens as JWTs | JWTs cannot be revoked once issued — they remain valid until expiry no matter what. Storing a hash of a random opaque token lets the server revoke a specific session on demand (logout, suspected theft), which is required for real session management. |
| Zod | Manual `if` checks / Joi | Schema-first validation with automatic TypeScript type inference (`z.infer`) — one source of truth for both runtime validation and compile-time types. |
| PostgreSQL, schema-per-service | Separate database per service | A single shared PostgreSQL instance with one Postgres *schema* per microservice (`auth_service`, later `student_service`, etc.) preserves logical data isolation while keeping infrastructure cost and complexity low — a deliberate, documented trade-off appropriate for an academic deployment. |

## 3. Data Model

### `auth_service.users`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | primary key, default random |
| email | varchar(255) | not null, unique index |
| password_hash | varchar(255) | not null (bcrypt hash, never the plain password) |
| role | varchar(16) | not null, default `STUDENT` |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

### `auth_service.refresh_tokens`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | primary key, default random |
| token_hash | varchar(64) | not null (SHA-256 hex digest of the raw token — raw value never stored) |
| user_id | uuid | not null, foreign key → users.id, `ON DELETE CASCADE` |
| expires_at | timestamptz | not null |
| revoked_at | timestamptz | nullable — `null` means still active |
| created_at | timestamptz | not null, default now() |

Both tables live in the `auth_service` Postgres schema (not `public`), isolating this
service's data even though it shares a physical database instance with other
services for cost reasons.

## 4. API Reference

### `GET /health`
No auth required. Returns service status — used by orchestration tooling
(Docker/Kubernetes health checks in later phases) to confirm the process is alive.

### `POST /auth/register`
Public. Rate-limited (20 requests / 15 min / IP).

Request:
```json
{ "email": "alice@student.edu", "password": "correct-horse-battery" }
```
Validation: email must be a valid address; password minimum 8 characters.
Public registration always creates a `STUDENT` role — there is no way to
self-register as FACULTY or ADMIN through this endpoint (see Section 5).

Responses: `201` (created, returns id/email/role — never the password hash),
`400` (validation failed), `409` (email already registered).

### `POST /auth/login`
Public. Rate-limited.

Request: `{ "email": "...", "password": "..." }`

Response `200`: `{ accessToken, refreshToken, user: { id, email, role } }`.
`accessToken` is a JWT, valid 15 minutes. `refreshToken` is a random opaque
string, valid 7 days.

Response `401` for **both** "no such user" and "wrong password" — deliberately
identical, to prevent an attacker from using error differences to enumerate
which emails are registered.

### `POST /auth/refresh`
Public (requires a valid refresh token, not an access token).

Request: `{ "refreshToken": "<raw token from login>" }`

On success: the provided token is immediately revoked, a brand-new access +
refresh token pair is issued (**rotation**). Reusing the old, now-rotated-out
token is rejected with `401` — this is a theft-detection mechanism: if a
refresh token is ever stolen and used by an attacker, the legitimate user's
next refresh attempt with their now-superseded copy will also fail, giving a
detectable signal.

### `GET /auth/me`
Protected — requires `Authorization: Bearer <accessToken>`. Returns the
decoded token claims (`sub`, `email`, `role`). Used to prove the
`requireAuth` middleware correctly accepts valid tokens and rejects
missing/invalid ones.

## 5. Security Measures (mapped to OWASP Top 10, 2021)

- **A01 – Broken Access Control**: `requireRole(...roles)` middleware enforces
  role checks independently of authentication (`401` = not authenticated,
  `403` = authenticated but wrong role — kept deliberately distinct).
  Public registration cannot create FACULTY/ADMIN accounts; those are
  provisioned by direct, controlled database action.
- **A02 – Cryptographic Failures**: passwords are hashed with bcrypt
  (never stored or logged in plain text); refresh tokens are stored only as
  SHA-256 hashes, never in raw form.
- **A03 – Injection**: all database access goes through Drizzle's query
  builder, which always parameterizes queries — no hand-concatenated SQL
  strings anywhere in the codebase.
- **A07 – Identification and Authentication Failures**: Zod validation on
  every input; rate limiting on `/register` and `/login`; identical
  error responses for the two distinct login-failure cases (user
  enumeration prevention); refresh token rotation with reuse detection.

## 6. Testing

21 automated tests across 6 files, run via `npm test` (Vitest):

| File | Type | Count | Covers |
|---|---|---|---|
| `password.test.ts` | Unit | 3 | bcrypt hash/verify correctness |
| `tokens.test.ts` | Unit | 2 | JWT sign/verify, tamper rejection |
| `requireRole.test.ts` | Unit | 4 | RBAC middleware, isolated with mocked req/res/next |
| `auth.register.test.ts` | Integration | 3 | Real HTTP + real DB: create, duplicate rejection, weak password rejection |
| `auth.login.test.ts` | Integration | 6 | Login success, wrong password, non-existent email (identical error), protected route access |
| `auth.refresh.test.ts` | Integration | 3 | Token rotation, reuse rejection, unknown token rejection |

Integration tests use Supertest against the real Express app (via a
`createApp()` factory, decoupled from `app.listen()`) and the real
PostgreSQL database, with `beforeEach`/`beforeAll` + `afterAll` hooks to
guarantee a clean, repeatable state regardless of run order or prior runs.

## 7. Notable Issues Encountered and Resolved

- **TypeScript 7 removed `moduleResolution: "node"`** (renamed internally to
  `node10` years prior, then deleted outright in TS 7.0, July 2026).
  Resolved by switching to `"nodenext"` for both `module` and
  `moduleResolution`, which resolves imports the way Node.js actually does
  at runtime.
- **npm 11's install-script approval gate**: `esbuild` (a transitive
  dependency of `tsx`/`drizzle-kit`) requires an explicit
  `npm install-scripts approve esbuild` before its postinstall script (which
  downloads a platform-specific binary) is allowed to run — a genuine
  security feature, not a bug.
- **`.gitignore` indentation bug**: leading whitespace on ignore-pattern
  lines silently broke every rule, allowing `node_modules` to appear as
  untracked. Fixed by ensuring rules start at column 1; verified with
  `git check-ignore -v`.
- **Schema-name mismatch**: `drizzle.config.ts`'s `schemaFilter` initially
  used a hyphen (`auth-service`) while the actual Postgres schema and
  Drizzle schema definition used an underscore (`auth_service`) —
  caught before running a migration against the real database, avoiding a
  half-applied schema.
- **JWT timing false alarm**: an early manual test compared two access
  tokens signed within the same second and found them identical, which
  looked like a bug. JWT's `iat` claim only has one-second resolution;
  the tokens were not actually being cached or reused. Root-caused with an
  explicit `Start-Sleep` before concluding it was correct behavior. The
  final automated test for token rotation deliberately asserts on
  `refreshToken` values, not `accessToken` timing, to avoid this class of
  flakiness entirely.

## 8. What's Deliberately Not Included (and why)

- No password reset / email verification flow — out of scope for the
  project's MVP.
- No admin-account creation endpoint — ADMIN/FACULTY accounts are
  provisioned directly in the database, a deliberate control to prevent
  privilege escalation via a public API.
- Refresh tokens use an in-memory-friendly design but are stored in
  PostgreSQL (not Redis) — acceptable at this scale; would likely move to
  Redis with TTL in a higher-throughput production deployment.