# Notification Service — Implementation Documentation

## Purpose

Notification Service is the consumer half of the platform's first
asynchronous, event-driven flow. It has no HTTP endpoints for creating
data — its primary job is to listen continuously for `attendance.low`
events published by Attendance Service and persist a corresponding
notification record.

## Data Model

`notification_service.notifications`: id (uuid, pk), student_user_id
(uuid, no foreign key), course_id (uuid, no foreign key),
attendance_percentage (integer — stored as its own column rather than
embedded only in the message text, specifically so it remains queryable,
e.g. "find all notifications where the percentage was below 60"),
message (text), read (boolean, not null, default false), created_at.

## Process Shape: HTTP Server + Background Consumer

Unlike every previous service, this service's `index.ts` starts two
independent things concurrently in one process: an Express server
exposing only `GET /health` (so Kubernetes health/readiness probes have
something to check, even though this service's real work has nothing to
do with HTTP requests), and a RabbitMQ consumer that runs indefinitely in
the background. Neither blocks the other from starting.

## Queue and Binding Design

- Reasserts the `attendance_events` topic exchange (idempotent — safe
  even though Attendance Service already creates it; guards against
  Notification Service starting up before Attendance Service ever has).
- Declares its own **durable, explicitly named** queue,
  `notification_service.attendance_low` — durability and an explicit
  name matter because they mean this queue keeps accumulating messages
  even while this consumer process is not running, rather than being
  deleted the moment its connection closes (which is what would happen
  with an anonymous/exclusive queue).
- Binds that queue to the `attendance_events` exchange with the routing
  key `attendance.low` **only** — deliberately not `attendance.marked`.
  Filtering happens entirely at the RabbitMQ binding level, not in
  application code; Notification Service's code never sees, and does not
  need to know about, the more frequent `attendance.marked` events.

## Acknowledgement and Failure Handling

Each message is explicitly acknowledged (`channel.ack`) only after the
notification row has been successfully inserted into the database. If
processing throws (malformed payload, database error), the message is
negatively acknowledged (`channel.nack`) without requeueing. This is a
deliberate, minimal implementation of the retry/reliability behaviour
described in docs/ARCHITECTURE.md Section 8; a full dead-letter queue
(routing permanently-failed messages somewhere for manual inspection,
rather than discarding them) is a documented future enhancement, not yet
implemented.

## Verified End-to-End

With Auth, Attendance, and Notification services running simultaneously
as three independent processes, a faculty account was used to mark a
student ABSENT twice via Attendance Service. Notification Service's
console log confirmed two `attendance.low` events were received in real
time, and a direct database query confirmed two corresponding rows were
correctly persisted in `notification_service.notifications`, with
accurate student ID, percentage, and generated message text. This
constitutes concrete, verified proof of the platform's core asynchronous
architecture claim: two services with no direct network dependency on
each other correctly cooperate via RabbitMQ alone.