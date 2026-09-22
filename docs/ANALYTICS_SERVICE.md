# Analytics Service — Implementation Documentation

## Purpose

Analytics Service maintains a derived, eventually-consistent read model
of attendance statistics, built entirely by consuming `attendance.marked`
events — it never queries Attendance Service's schema or database
directly, preserving the same service-independence principle applied
throughout the platform (see docs/ARCHITECTURE.md).

## Data Model

`analytics_service.analytics`: one row per (student, course) pair,
enforced by a composite unique index on (student_user_id, course_id).
Tracks total_marked, total_present, and last_attendance_percentage,
updated incrementally as events arrive, rather than storing full event
history (which already exists in Attendance Service's own table).

## Event Payload Design Flaw, Found and Fixed

The original `attendance.marked` event payload (designed while building
Notification Service) carried only the cumulative `attendancePercentage`
after each mark. When Analytics Service was built as a second consumer of
the same event, this proved insufficient: there was no way to determine
whether one specific mark was PRESENT or ABSENT from the cumulative
percentage alone. Fixed by adding a `status` field to the event payload
itself, published by Attendance Service. This is documented as a genuine
example of an event schema needing to evolve once a second, different
consumer's real requirements became known — not something foreseeable
from the first consumer's needs alone.

## Two Concurrency Bugs Found and Fixed

### 1. Lost events from a check-then-act race condition

**Symptom:** three attendance-mark events were published and confirmed
by Attendance Service, but Analytics Service's table only reflected two
of them.

**Root cause:** the initial consumer logic performed a `SELECT` to check
whether a row existed, then separately issued an `INSERT` or `UPDATE`
based on the result. Because RabbitMQ's `channel.consume` does not wait
for one callback's promise to fully resolve before invoking the next one,
two events for the same (student, course) pair could both run their
`SELECT` (both seeing "no row yet") before either completed its `INSERT`.
The second `INSERT` then failed with a Postgres unique-constraint
violation, and — because the consumer's catch block calls
`channel.nack(msg, false, false)` (no requeue) — that event was silently
and permanently dropped.

**Resolution:** replaced the separate select-then-branch logic with a
single atomic `INSERT ... ON CONFLICT DO UPDATE` statement
(`.onConflictDoUpdate()` in Drizzle), targeting the composite unique
constraint. Postgres guarantees this operation is atomic, eliminating the
gap between checking and acting entirely.

### 2. Out-of-order writes to a last-write-wins field

**Symptom:** after fixing the above, event counts (total_marked,
total_present) were correct, but `last_attendance_percentage` reflected
an earlier event's value, not the most recently published one.

**Root cause:** `total_marked`/`total_present` are safe under
out-of-order completion because they are atomic increments (order does
not affect the final sum). `last_attendance_percentage` is a plain
overwrite, which is inherently order-dependent — whichever database
write physically completes last determines the stored value, and without
additional constraints, that is not guaranteed to be the logically most
recent event.

**Resolution:** added `channel.prefetch(1)`, instructing RabbitMQ to
deliver only one unacknowledged message to this consumer at a time. Since
the message is only acknowledged after its database write completes,
this forces strictly sequential processing, guaranteeing that processing
order matches publish order.

## Verified

The three-event race condition scenario (PRESENT, then ABSENT, then
ABSENT again for the same student/course) was run repeatedly and
confirmed to reliably reset the arrival-order bug, confirmed genuinely
fixed only after both corrections above, with final state matching hand
calculation exactly: total_marked=3, total_present=1,
last_attendance_percentage=33%.


## Test Validity Confirmed

The regression test in `tests/upsert.test.ts` was deliberately verified
against the original buggy select-then-branch implementation before being
finalized: reverting the upsert logic caused the test to fail with the
exact `duplicate key value violates unique constraint` error observed in
production (Step 230 of the development log), confirming the test
genuinely detects this specific bug rather than passing trivially.
Interestingly, the 10-concurrent-writes test did not reliably fail against
the buggy version, while the simpler 2-concurrent-inserts-to-a-new-row
test did — a reminder that more simultaneous operations does not
necessarily make a race condition easier to trigger deterministically;
the narrowest reproduction (two writers racing to create the same
first row) proved the more reliable regression test.