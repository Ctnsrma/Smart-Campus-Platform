# Jenkins CI/CD — Implementation Documentation

## Setup

Jenkins runs as a Docker container (`jenkins/jenkins:lts`) with two
volumes: a named volume `jenkins_home` for persistent configuration, and
the host's Docker socket (`/var/run/docker.sock`) mounted in, giving
Jenkins the ability to control the host's real Docker daemon rather than
running a separate, nested Docker installation of its own.

## Pipeline

Defined in `Jenkinsfile` at the repository root (Declarative Pipeline
syntax), configured in the Jenkins job as "Pipeline script from SCM" so
the pipeline definition itself is version-controlled alongside the code
it builds, rather than configured only inside Jenkins' own UI.

Current stages: Checkout (clone from GitHub), Install & Test (run a
subset of the automated test suite inside a temporary `node:22-alpine`
container).

## Scope Decision: Unit Tests Only, Not the Full Suite

The project's 39 automated tests are a mix of true unit tests (no
external dependencies) and integration/end-to-end tests that require a
fully running system (Postgres, RabbitMQ, and other services reachable
over real HTTP - see docs/NOTIFICATION_SERVICE.md, docs/ANALYTICS_SERVICE.md).
A CI container spun up fresh for a single test stage has none of this
running. Rather than build a full Docker-Compose-style orchestration
layer inside the pipeline solely to satisfy integration tests, the
pipeline currently runs only the genuinely dependency-free unit tests
(`password.test.ts`, `tokens.test.ts`, `requireRole.test.ts`, all in
Auth Service), via a dedicated `test:unit` script added specifically for
this purpose. This is a deliberate, documented scope boundary: it proves
the CI/CD automation concept correctly, without disproportionate effort
solving a different, larger problem (full-system CI testing) that the
project's academic scope does not require.

## Notable Engineering Challenges Resolved

### 1. Jenkins' base image has no language runtimes

**Symptom:** an early pipeline attempt to run `node --version` failed
with `node: not found`.

**Root cause:** `jenkins/jenkins:lts` is deliberately minimal and
language-agnostic; it does not include Node.js, Python, or any other
runtime by default.

**Resolution:** rather than installing Node.js permanently inside the
Jenkins container itself, pipeline stages that need Node.js run their
steps inside a temporary, purpose-built `node:22-alpine` Docker
container instead - the standard, idiomatic Jenkins pattern for
polyglot pipelines.

### 2. Installing the full Docker Engine instead of just the CLI

**Symptom:** an attempt to `apt-get install docker.io` inside the
Jenkins container pulled in ~100MB and dozens of unrelated packages
(`systemd`, `containerd`, `nftables`, etc.), with download speeds slow
enough to project over a day to complete.

**Root cause:** `docker.io` on Debian installs the complete Docker
Engine (daemon and all supporting infrastructure needed to actually run
containers locally) - unnecessary here, since Jenkins only needs to
*talk to* the host's already-running daemon via the mounted socket, not
run its own.

**Resolution:** installed only `docker-cli` (and its one dependency,
`docker-buildx`) - a ~20MB, ~30-second install providing exactly the
`docker` command-line client needed.

### 3. Docker socket permission denied for the non-root Jenkins user

**Symptom:** `permission denied while trying to connect to the Docker
daemon socket`, when a pipeline step (running as the restricted
`jenkins` user, not root) attempted to run `docker run`.

**Root cause:** the mounted socket file is owned by `root:root` inside
this container's context (a Docker-Desktop-on-Windows specific detail;
native Linux Docker installs more commonly expose a dedicated `docker`
group instead), and the `jenkins` user belongs to neither.

**Resolution:** `chmod 666 /var/run/docker.sock`, granting read/write
access to any user. Documented explicitly as a local-development-only
shortcut with a real, honest security tradeoff (any process reaching
this socket can control the entire host's Docker daemon) - acceptable
for a personal learning environment, but a genuine anti-pattern in any
real production Jenkins setup, which would instead manage group
membership precisely. Also non-permanent: the socket file is recreated
by Docker Desktop on restart, requiring this command to be reapplied.

### 4. Container-in-container volume mounting resolves against the host, not the calling container

**Symptom:** even after fixing permissions, `docker run -v
"$WORKSPACE":/app ...` (mounting Jenkins' own checked-out workspace path
into a fresh container) resulted in the new container seeing an empty
directory - `npm install` failed with `package.json` reported as
missing, despite it being directly confirmed present via `pwd`/`ls -la`
run by Jenkins itself moments earlier.

**Root cause:** since Jenkins runs inside its own container, and its
`docker run` commands are executed by the *host's* Docker daemon (via
the mounted socket, not a nested daemon), any bind-mount path in those
commands is resolved against the **host machine's** real filesystem, not
against paths that only exist inside the calling (Jenkins) container.
`/var/jenkins_home/workspace/...` is a real path inside the Jenkins
container, but no such path exists on the literal Windows host, so
Docker silently mounted an empty directory instead.

**Resolution:** mounted the named Docker volume `jenkins_home` itself
(the same volume backing Jenkins' own `/var/jenkins_home`, genuinely
known to and resolvable by the host's Docker daemon) into the new
container, rather than a raw path string. This is a fundamental,
generalizable consequence of the "mount the host's Docker socket into a
container" pattern, worth understanding precisely rather than treating
as an isolated quirk: any Docker-in-Docker-via-host-socket setup will
have this same constraint on volume mounts.

### 5. Missing environment variable for a dependency-free unit test

**Symptom:** 7 of 9 targeted unit tests passed; `tokens.test.ts`'s two
tests failed with `JWT_ACCESS_SECRET is not set`.

**Root cause:** this value normally comes from `auth-service/.env` via
`dotenv/config` - a file deliberately excluded from Git (docs/AUTH_SERVICE.md)
and therefore genuinely absent from the CI container's checked-out
source.

**Resolution:** supplied a CI-specific value directly via `docker run
-e JWT_ACCESS_SECRET=ci-test-secret`. This value has no relationship to
the real local/production secret and does not need one - the test only
requires internal consistency (sign a token, then verify it with the
same secret within the same test run).

## Verified

`Jenkinsfile`, checked directly into the repository and referenced by
the Jenkins job via "Pipeline script from SCM," successfully performs a
real Git checkout from GitHub followed by dependency installation and
execution of Auth Service's dependency-free unit test suite (9 tests,
all passing) inside an isolated, temporary Docker container - confirmed
with a genuine `Finished: SUCCESS` pipeline result.


## Full Pipeline: Build and Security Scan

Extended the pipeline with two further stages, following the original
architecture document's intended sequence (checkout → install/test →
build → scan → deploy).

### Docker Build Stage

Runs `docker build` directly as a Jenkins shell step (not nested inside
another `docker run`), tagging the image with `${env.BUILD_NUMBER}` (a
built-in, auto-incrementing Jenkins variable) rather than a fixed tag, so
each pipeline run produces a distinctly identifiable image. Confirmed
this works correctly using Jenkins' own checked-out workspace as the
build context with no volume-mounting workaround needed - unlike the
bind-mount problem documented above, `docker build`'s context is read
directly by the CLI process itself (running inside the Jenkins
container, with real access to the checked-out files) rather than
requiring the host daemon to independently resolve a path, which is why
this specific operation does not hit the same container-in-container
path-resolution issue.

### Security Scan Stage (Trivy)

Runs Trivy against the freshly-built image, using the host's Docker
socket. Two further issues resolved:

**Slow/unreliable default vulnerability database mirror**: the default
database source (accessed via `mirror.gcr.io`) repeatedly failed or
stalled significantly below a usable transfer rate (confirmed directly:
~106 KiB/s sustained, reaching only 79% after a 15-minute timeout).
Resolved by specifying `--db-repository public.ecr.aws/aquasecurity/trivy-db`,
an officially documented, AWS-hosted alternative mirror, which completed
reliably.

**Database persistence across pipeline runs**: added a named volume
(`trivy_cache`) mounted to Trivy's cache directory, so the multi-hundred-megabyte
vulnerability database downloads once and is reused by subsequent
pipeline runs, rather than being re-fetched on every single build - the
same persistence principle already applied to `jenkins_home` and
`postgres_data` elsewhere in this project.

**Scan policy**: `--exit-code 0` deliberately reports findings without
failing the build. A real scan of `auth-service`'s image identified 3
HIGH-severity CVEs, all in the base `node:22-alpine` image's underlying
`glibc` packages (not in the project's own application code or npm
dependencies) - a realistic, common finding for any project built on a
public base image, and exactly the kind of result this stage is meant to
surface for review, without blocking the pipeline on a base-image issue
outside the project's direct control to fix immediately.

## Verified

The full pipeline - checkout, unit tests, Docker image build, and a real
Trivy vulnerability scan against that built image - completes end to end
with `Finished: SUCCESS`, producing a genuinely tagged, scanned container
image on every run.