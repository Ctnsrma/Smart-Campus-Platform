import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestToken } from "../src/utils/testAuth";
import { db, pool } from "../src/db/client";
import { notifications } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { waitFor } from "./helpers/waitFor";
import crypto from "node:crypto";

const facultyEmail = "integration.e2e.faculty@example.com";
const studentEmail = "integration.e2e.student@example.com";
const testPassword = "correct-horse-battery";
const courseId = crypto.randomUUID();

let studentUserId: string;
let facultyToken: string;
let studentToken: string;

async function registerUser(email: string, password: string): Promise<string> {
  const res = await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.user.id;
}

async function promoteToFaculty(email: string) {
  await db.execute(sql`UPDATE auth_service.users SET role = 'FACULTY' WHERE email = ${email}`);
}

async function deleteTestUser(token: string) {
  await fetch("http://localhost:3001/auth/me", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeAll(async () => {
  await registerUser(facultyEmail, testPassword);
  await promoteToFaculty(facultyEmail);
  facultyToken = await getTestToken(facultyEmail, testPassword);

  studentUserId = await registerUser(studentEmail, testPassword);
  studentToken = await getTestToken(studentEmail, testPassword);
});

afterAll(async () => {
  await db.delete(notifications).where(eq(notifications.studentUserId, studentUserId));

  // TEMPORARY: reaching into attendance_service's schema directly for
  // test cleanup only, same justified, explicitly-documented exception
  // used elsewhere (see STUDENT_SERVICE.md) — no HTTP endpoint exists
  // yet to delete a specific student's attendance records.
  await db.execute(sql`DELETE FROM attendance_service.attendance_records WHERE student_user_id = ${studentUserId}`);

  await deleteTestUser(facultyToken);
  await deleteTestUser(studentToken);
  await pool.end();
});

describe("Attendance -> RabbitMQ -> Notification end-to-end flow", () => {
  it("creates a notification when attendance drops to 0%", async () => {
    // Mark the student ABSENT twice, so 0 PRESENT / 2 total = 0%.
    for (let i = 0; i < 2; i++) {
  const res = await fetch("http://localhost:3004/attendance/mark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${facultyToken}`,
    },
    body: JSON.stringify({ studentUserId, courseId, status: "ABSENT" }),
  });

  if (res.status !== 201) {
    const errorBody = await res.json();
    console.log("Attendance mark failed:", res.status, errorBody);
  }
  expect(res.status).toBe(201);
}

    // The HTTP calls above only confirm Attendance Service published the
    // events - Notification Service consumes them on its own schedule,
    // so we poll rather than check once immediately.
    const created = await waitFor(async () => {
      const rows = await db.select().from(notifications).where(eq(notifications.studentUserId, studentUserId));
      return rows.length > 0 ? rows[0] : null;
    });

    expect(created.attendancePercentage).toBe(0);
    expect(created.courseId).toBe(courseId);
    expect(created.message).toContain("0%");
    const res = await fetch("http://localhost:3004/attendance/mark", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${facultyToken}`,
  },
  body: JSON.stringify({ studentUserId, courseId, status: "ABSENT" }),
});

if (res.status !== 201) {
  const errorBody = await res.json();
  console.log("Attendance mark failed:", res.status, errorBody);
}
expect(res.status).toBe(201);
  });
});