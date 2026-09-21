# Attendance Service — Implementation Documentation

## Purpose

Attendance Service owns attendance records and attendance-percentage
calculation. It introduces the platform's first asynchronous,
event-driven communication, publishing events to RabbitMQ rather than
calling other services directly — see docs/ARCHITECTURE.md Section 8 for
the original design rationale.

## Data Model

`attendance_service.attendance_records`: id (uuid, pk), student_user_id
(uuid, no foreign key — same cross-schema reasoning as every other
service), course_id (uuid, no foreign key), status (varchar(16), default
'ABSENT'), marked_by_user_id (uuid — the faculty member who marked it,
always derived from the caller's verified token, never from client input),
created_at.

No unique constraint exists on (student_user_id, course_id) or similar,
because a single student/course pair can legitimately have multiple
attendance records over time (one per class session). A future
`session_id` column, with a unique constraint on
(student_user_id, course_id, session_id), would be the correct way to
prevent a genuine duplicate — recording the same student twice for the
same specific class session — without also preventing legitimate
multiple-sessions-per-day records.

## Status Field: Deliberately Flexible

`status` is a plain `varchar`, not a Postgres `enum` type, and is
constrained to exactly `"PRESENT"` or `"ABSENT"` only at the application
layer via a Zod schema (`z.enum(["PRESENT", "ABSENT"])`). This mirrors
the same decision made for the `role` field in Auth Service: the set of
valid attendance statuses is plausibly extendable in the future (e.g.
"LATE", "EXCUSED"), and keeping the column as a plain string means adding
a new status later requires changing one line of validation code, not a
database migration.

## Event-Driven Design

### Exchange

A single **topic exchange** named `attendance_events` is declared
(`durable: true`, survives a RabbitMQ restart). A topic exchange routes
messages to queues based on a routing key pattern, which is what allows
any number of future consumers to independently decide which events they
care about — the producer (this service) has no knowledge of, and no
dependency on, who is listening.

### Events Published

| Routing Key | Payload | Published When |
|---|---|---|
| `attendance.marked` | `{ studentUserId, courseId, attendancePercentage }` | Every time attendance is marked |
| `attendance.low` | `{ studentUserId, courseId, attendancePercentage }` | Additionally, only if the recalculated percentage falls below 75% |

Attendance percentage is recalculated on every mark by querying all of a
student's attendance records for that specific course and computing
`(PRESENT count / total count) * 100`, rounded to the nearest integer —
calculated on demand rather than stored as a running counter, to avoid
any possibility of a stored value drifting out of sync with the
underlying records.

### Verified Behaviour

Manually verified end-to-end: a faculty account was created and used to
mark a student PRESENT twice (confirming 100% and correct
`attendance.marked` publication with no `attendance.low`), then ABSENT
twice more (confirming the percentage correctly dropped to 67% then 50%,
and that `attendance.low` was correctly published in addition to
`attendance.marked` once the threshold was crossed). Publication was
confirmed both via application logs and directly in the RabbitMQ
management UI, which shows the `attendance_events` exchange as type
`topic` with `durable: true`, matching the code exactly.

### Current Limitation: No Consumer Yet

As of this stage, zero queues are bound to the `attendance_events`
exchange. Per RabbitMQ's normal behaviour, a message published to an
exchange with no bound queues is silently and permanently discarded —
this is expected and correct at this stage, not a bug. Notification
Service (a subsequent development phase) will bind a queue to this
exchange, at minimum with the pattern `attendance.low`, to actually
consume and act on these events.