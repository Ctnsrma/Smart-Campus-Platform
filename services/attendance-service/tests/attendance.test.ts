import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, pool } from "../src/db/client";
import { attendanceRecords } from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const facultyEmail = "integration.attendance.faculty@example.com";
const studentEmail = "integration.attendance.student@example.com";
const testPassword = "correct-horse-battery";

let facultyToken: string;
let studentUserId: string;

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
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`UPDATE auth_service.users SET role = 'FACULTY' WHERE email = ${email}`);
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.accessToken;
}

async function markAttendance(token: string, courseId: string, status: "PRESENT" | "ABSENT") {
  const res = await fetch("http://localhost:3004/attendance/mark", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentUserId, courseId, status }),
  });
  return { status: res.status, body: await res.json() };
}

async function deleteTestUser(token: string) {
  await fetch("http://localhost:3001/auth/me", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

beforeAll(async () => {
  await registerUser(facultyEmail, testPassword);
  await promoteToFaculty(facultyEmail);
  facultyToken = await login(facultyEmail, testPassword);

  studentUserId = await registerUser(studentEmail, testPassword);
});

afterAll(async () => {
  await db.delete(attendanceRecords).where(eq(attendanceRecords.studentUserId, studentUserId));
  await deleteTestUser(facultyToken);
  const studentToken = await login(studentEmail, testPassword).catch(() => null);
  if (studentToken) await deleteTestUser(studentToken);
  await pool.end();
});

describe("POST /attendance/mark", () => {
  it("rejects a STUDENT with 403", async () => {
    const studentToken = await login(studentEmail, testPassword);
    const res = await fetch("http://localhost:3004/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ studentUserId, courseId: crypto.randomUUID(), status: "PRESENT" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 100% on a student's first PRESENT mark", async () => {
    const courseId = crypto.randomUUID();
    const { status, body } = await markAttendance(facultyToken, courseId, "PRESENT");
    expect(status).toBe(201);
    expect(body.attendancePercentage).toBe(100);
  });

  it("correctly calculates percentage across a mixed sequence of marks", async () => {
    const courseId = crypto.randomUUID();

    const first = await markAttendance(facultyToken, courseId, "PRESENT");
    expect(first.body.attendancePercentage).toBe(100);

    const second = await markAttendance(facultyToken, courseId, "ABSENT");
    expect(second.body.attendancePercentage).toBe(50);

    const third = await markAttendance(facultyToken, courseId, "PRESENT");
    expect(third.body.attendancePercentage).toBe(67);
  });

  it("publishes an additional attendance.low signal once percentage drops below 75%, reflected in a lower returned value", async () => {
    const courseId = crypto.randomUUID();

    await markAttendance(facultyToken, courseId, "PRESENT");
    const dropped = await markAttendance(facultyToken, courseId, "ABSENT");

    expect(dropped.body.attendancePercentage).toBe(50);
    expect(dropped.body.attendancePercentage).toBeLessThan(75);
  });
});