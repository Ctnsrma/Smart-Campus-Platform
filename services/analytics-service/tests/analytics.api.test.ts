import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { analytics } from "../src/db/schema";

const facultyEmail = "integration.analyticsapi.faculty@example.com";
const studentEmail = "integration.analyticsapi.student@example.com";
const password = "correct-horse-battery";
const courseId = crypto.randomUUID();
const API = "http://localhost:3006";

type CourseStats = { courseId: string; totalMarked: number; totalPresent: number; lastAttendancePercentage: number };

let studentUserId: string;
let facultyToken: string;
let studentToken: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registerUser(email: string): Promise<string> {
  const res = await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return ((await res.json()) as { user: { id: string } }).user.id;
}

async function login(email: string): Promise<string> {
  const res = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return ((await res.json()) as { accessToken: string }).accessToken;
}

async function deleteTestUser(token: string) {
  await fetch("http://localhost:3001/auth/me", { method: "DELETE", headers: auth(token) });
}

async function waitFor<T>(check: () => Promise<T | null>, timeoutMs = 8000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`condition not met within ${timeoutMs}ms`);
}

beforeAll(async () => {
  await registerUser(facultyEmail);
  await db.execute(sql`UPDATE auth_service.users SET role = 'FACULTY' WHERE email = ${facultyEmail}`);
  facultyToken = await login(facultyEmail);

  studentUserId = await registerUser(studentEmail);
  studentToken = await login(studentEmail);

  // Two ABSENT marks: totalMarked 2, totalPresent 0, last percentage 0.
  for (let i = 0; i < 2; i++) {
    const res = await fetch("http://localhost:3004/attendance/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(facultyToken) },
      body: JSON.stringify({ studentUserId, courseId, status: "ABSENT" }),
    });
    expect(res.status).toBe(201);
  }
});

afterAll(async () => {
  await db.delete(analytics).where(eq(analytics.studentUserId, studentUserId));
  await db.execute(sql`DELETE FROM attendance_service.attendance_records WHERE student_user_id = ${studentUserId}`);
  await deleteTestUser(facultyToken);
  await deleteTestUser(studentToken);
  await pool.end();
});

describe("Analytics read API", () => {
  it("shows the caller's own totals once both events are processed", async () => {
    // The read model updates asynchronously, so poll until both marks are counted.
    const entry = await waitFor(async () => {
      const res = await fetch(`${API}/analytics/me`, { headers: auth(studentToken) });
      const body = (await res.json()) as { courses: CourseStats[] };
      return body.courses.find((c) => c.courseId === courseId && c.totalMarked === 2) ?? null;
    });
    expect(entry.totalPresent).toBe(0);
    expect(entry.lastAttendancePercentage).toBe(0);
  });

  it("gives faculty a course summary", async () => {
    const res = await fetch(`${API}/analytics/courses/${courseId}/summary`, { headers: auth(facultyToken) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      courseId,
      studentsTracked: 1,
      averageAttendance: 0,
      studentsBelowThreshold: 1,
    });
  });

  it("rejects a student on the summary with 403", async () => {
    const res = await fetch(`${API}/analytics/courses/${courseId}/summary`, { headers: auth(studentToken) });
    expect(res.status).toBe(403);
  });

  it("shows another user an empty list, proving identity comes from the token", async () => {
    const res = await fetch(`${API}/analytics/me`, { headers: auth(facultyToken) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { courses: CourseStats[] }).courses).toEqual([]);
  });

  it("rejects a malformed course id with 400", async () => {
    const res = await fetch(`${API}/analytics/courses/not-a-uuid/summary`, { headers: auth(facultyToken) });
    expect(res.status).toBe(400);
  });

  it("rejects a request with no token", async () => {
    const res = await fetch(`${API}/analytics/me`);
    expect(res.status).toBe(401);
  });
});