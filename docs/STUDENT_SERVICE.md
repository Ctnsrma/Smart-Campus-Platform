# Student Service - Implementation Documentation

## Notable Issues Encountered and Resolved

### Silent migration failure due to pre-created schema

**Symptom:** `npx drizzle-kit migrate` ran with no error output, but the
`students` table never appeared in the database. Verified via direct
`psql` queries across ~10 diagnostic steps (checking `.env`, connection
string, `pgSchema()` usage, journal file structure, drizzle-kit version,
and finally running the generated `.sql` file directly with `psql -f`).

**Root cause:** the `student_service` Postgres schema had already been
manually created (a required one-time setup step, mirroring
`auth-service`'s Step 31/44 setup) *before* running the migration. The
migration's first statement, `CREATE SCHEMA "student_service"`, then
failed with "schema already exists" - and this specific version of
`drizzle-kit` (`0.31.10`) aborts silently on this error rather than
reporting it or continuing, and does not record the migration as applied
in `drizzle.__drizzle_migrations`.

**Resolution:** ran the migration SQL directly via
`psql -f drizzle/0000_salty_romulus.sql`, which correctly skipped the
failed `CREATE SCHEMA` statement's effect (schema already existed) but
successfully executed the subsequent `CREATE TABLE` and `CREATE INDEX`
statements. Manually reconciled Drizzle's bookkeeping by computing the
migration file's SHA-256 hash and inserting it directly into
`drizzle.__drizzle_migrations`, so future `drizzle-kit` commands
correctly recognize this migration as already applied.

**Process improvement adopted:** going forward, do not manually
pre-create a service's Postgres schema before running its first
migration - let `drizzle-kit migrate` create the schema itself as part
of the first migration, exactly as it's designed to do. The manual
schema-creation step from the original setup pattern (Step 31) should
only be used for verifying schema *ownership*/permissions ahead of time
if needed, then dropped before the first real migration runs (as was
correctly done for `auth-service` in Step 44, but the lesson wasn't
carried forward when repeating the pattern for `student-service`).

### Known limitation: shared migration bookkeeping table

Because all services currently share one physical PostgreSQL instance
(see `docs/ARCHITECTURE.md` Section 9), Drizzle's `__drizzle_migrations`
bookkeeping table is also shared across every service, rather than
scoped per-service. This is currently harmless in practice, since
Drizzle identifies migrations by content hash (collision between
unrelated services' migration files is effectively impossible), but it
is a real, documented limitation of the cost-saving shared-instance
architecture, worth noting as a discussion point on deployment
trade-offs.


### Table created with wrong owner after manual migration workaround

**Symptom:** after resolving the silent migration failure (above) by running
the migration SQL manually via `psql -U postgres -f ...`, the application
itself failed at runtime with `Failed query: select ... from
student_service.students ...` and no further detail, when using the
`smart_campus` application role's credentials.

**Root cause:** running the migration as the `postgres` superuser made
`postgres` the *owner* of the newly created table. PostgreSQL grants no
implicit permissions to other roles on a table - not even `SELECT` - so the
application's `smart_campus` role had zero access to a table that visibly
existed in the schema.

**Resolution:** `ALTER TABLE student_service.students OWNER TO
smart_campus;`, restoring the table to the ownership state it would have
had if the migration had run successfully through drizzle-kit using the
application's own connection string in the first place.

**Process improvement adopted:** if a migration ever needs to be run
manually as a workaround, it must be run using the **same database role
the application itself connects as** (`smart_campus`, from
`DATABASE_URL`) - never the `postgres` superuser - specifically to avoid
this class of ownership/permission mismatch.