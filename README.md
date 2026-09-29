# Cloud-Native Smart Campus Service Platform

A microservices-based campus management system built to demonstrate real-world software architecture and DevOps practices — not a toy project, but a genuine engineering exercise covering distributed systems, event-driven architecture, containerization, orchestration, CI/CD, and cloud infrastructure, each proven working with real, reproducible evidence rather than assumed.

## What This Project Actually Demonstrates

Most student projects show a working demo. This one is built and documented so that every architectural claim can be independently verified: automated tests that prove security properties (not just "it works"), a message queue that survived weeks of real crashes with zero data loss, concurrency bugs that were found, fixed, and proven fixed with regression tests, and a CI/CD pipeline that performs a real rolling deployment against a live Kubernetes cluster.

## Architecture

Seven independently deployable services, communicating synchronously via REST and asynchronously via RabbitMQ:

| Service | Responsibility | Port |
|---|---|---|
| **Auth Service** | Registration, login, JWT + refresh token rotation, RBAC | 3001 |
| **Student Service** | Student profile management | 3002 |
| **Course Service** | Course and faculty assignment management | 3003 |
| **Attendance Service** | Attendance marking, percentage calculation, event publishing | 3004 |
| **Notification Service** | Consumes low-attendance events, generates alerts | 3005 |
| **Analytics Service** | Consumes attendance events, maintains a statistics read-model | 3006 |
| **API Gateway** | Single entry point, reverse-proxies to all services | 3000 |

```
Client → API Gateway → [Auth | Student | Course | Attendance] (REST)
                                              │
                                   Attendance Service
                                              │  publishes events
                                              ▼
                                     RabbitMQ (topic exchange)
                                        │              │
                             Notification Service   Analytics Service
                                  (consumes)            (consumes)
```

Each service owns its own PostgreSQL schema (schema-per-service on a shared instance — a deliberate, documented cost-consciousness decision, not an architectural compromise made by accident).

## Security

Not an afterthought — mapped explicitly to the OWASP Top 10, with automated tests proving each mitigation:

- **A01 (Broken Access Control):** Role-based middleware distinguishing "not authenticated" (401) from "authenticated, wrong role" (403). User identity in every service is derived strictly from the verified JWT — never from client-supplied request data — structurally preventing Insecure Direct Object Reference (IDOR) vulnerabilities.
- **A02 (Cryptographic Failures):** bcrypt password hashing; refresh tokens stored only as SHA-256 hashes, never in plaintext.
- **A03 (Injection):** All database access goes through Drizzle ORM's parameterized query builder — no hand-concatenated SQL anywhere in the codebase.
- **A07 (Authentication Failures):** Rate limiting, Zod input validation, and — critically — identical error responses for "wrong password" and "no such account," preventing user enumeration. This specific behavior has a dedicated regression test.

## Testing

39+ automated tests (Vitest), deliberately spanning three levels:

- **Unit tests** — isolated logic, no external dependencies (password hashing, JWT signing, RBAC middleware with mocked request/response objects)
- **Integration tests** — real HTTP requests against real running services and a real PostgreSQL database
- **End-to-end tests** — the full asynchronous pipeline, proven with a test that polls for eventual consistency rather than naively asserting immediately (a real, deliberate technique for testing asynchronous systems correctly, documented in `docs/NOTIFICATION_SERVICE.md`)

## Infrastructure

- **Docker** — multi-stage builds for all seven services (lean production images, no dev tooling shipped)
- **Docker Compose** — full local orchestration including PostgreSQL and RabbitMQ, with a real production-style data migration performed and documented (`docs/DOCKER_COMPOSE.md`)
- **Kubernetes (k3s via k3d)** — complete deployment of all seven services plus PostgreSQL and RabbitMQ: Deployments, Services, Secrets, PersistentVolumeClaims, and readiness/liveness probes, verified end-to-end through the API Gateway
- **Jenkins CI/CD** — a working five-stage pipeline (Checkout → Unit Tests → Docker Build → Trivy Security Scan → Kubernetes Deploy) that performs real rolling updates against the live cluster
- **Terraform** — AWS infrastructure as code (VPC, public subnet, Internet Gateway, least-privilege Security Groups, EC2, ECR) — provisioned and verified against a real AWS account

## Project Status

| Layer | Status |
|---|---|
| Backend services (7) | Complete, tested |
| Async event pipeline | Complete, verified end-to-end |
| Docker / Compose | Complete |
| Kubernetes (local) | Complete, verified end-to-end |
| Jenkins CI/CD | Complete, verified end-to-end |
| Terraform / AWS | Infrastructure code proven correct and provisioned successfully; deployment interrupted by a network connectivity issue during the final SSH step, then safely torn down (`terraform destroy`, zero orphaned cost) |
| Frontend | Not yet started |

## Getting Started (Local Development)

```bash
git clone https://github.com/Ctnsrma/Smart-Campus-Platform.git
cd Smart-Campus-Platform
npm install
```

Each service needs its own `.env` (see `.env.example` in each `services/*` folder) pointing at a local PostgreSQL instance, and RabbitMQ for the event-driven services.

Run a service individually:
```bash
npm run dev --workspace=@smart-campus/auth-service
```

Or bring up the entire system with Docker Compose:
```bash
docker compose up --build
```

Run the full test suite for a service:
```bash
npm test --workspace=@smart-campus/auth-service
```

## Documentation

Every service, and every significant engineering decision or bug encountered, is documented in `docs/`:

- `ARCHITECTURE.md` — original system design and rationale
- `AUTH_SERVICE.md`, `STUDENT_SERVICE.md`, `COURSE_SERVICE.md`, `ATTENDANCE_SERVICE.md`, `NOTIFICATION_SERVICE.md`, `ANALYTICS_SERVICE.md`, `API_GATEWAY.md` — per-service implementation notes
- `DOCKER.md`, `DOCKER_COMPOSE.md` — containerization details, including a real data migration
- `KUBERNETES.md` — full deployment narrative, including every real issue hit and resolved
- `JENKINS.md` — CI/CD pipeline, including five distinct real engineering problems solved

These documents are written as an honest engineering log — including bugs, wrong turns, and how they were actually diagnosed and fixed — not a cleaned-up summary. That process is as much a part of this project as the working code.

## Tech Stack

**Backend:** Node.js, TypeScript, Express.js, Drizzle ORM, PostgreSQL, RabbitMQ, JWT, Zod
**Testing:** Vitest, Supertest
**Infrastructure:** Docker, Kubernetes (k3s/k3d), Jenkins, Terraform, AWS (EC2, ECR, VPC)
**Tooling:** Git, npm workspaces (monorepo)
