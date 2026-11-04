import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { notifications } from "../src/db/schema";
import { getTestToken } from "../src/utils/testAuth";
import { waitFor } from "./helpers/waitFor";

const facultyEmail = "integration.notifapi.faculty@example.com";
const studentEmail = "integration.notifapi.student@example.com";
const password = "correct-horse-battery";
const courseId = crypto.randomUUID();
const API = "http://localhost:3005";

type Notif = { id: string; courseId: string; attendancePercentage: number; read: boolean };

let studentUserId: string;
let facultyToken: string;
let studentToken: string;
let firstId: string;

async function registerUser(email: string): Promise<string> {
  const res = await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { user: { id: string } };
  return body.user.id;
}

async function deleteTestUser(token: string) {
  await fetch("http://localhost:3001/auth/me", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await registerUser(facultyEmail);
  await db.execute(sql`UPDATE auth_service.users SET role = 'FACULTY' WHERE email = ${facultyEmail}`);
  facultyToken = await getTestToken(facultyEmail, password);

  studentUserId = await registerUser(studentEmail);
  studentToken = await getTestToken(studentEmail, password);

  // Two ABSENT marks give 0%, so the pipeline produces two attendance.low notifications.
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
  await db.delete(notifications).where(eq(notifications.studentUserId, studentUserId));
  await db.execute(sql`DELETE FROM attendance_service.attendance_records WHERE student_user_id = ${studentUserId}`);
  await deleteTestUser(facultyToken);
  await deleteTestUser(studentToken);
  await pool.end();
});

describe("Notification read API", () => {
  it("lists the caller's own notifications once the pipeline delivers them", async () => {
    // Delivery is asynchronous, so poll instead of asserting immediately.
    const list = await waitFor(async () => {
      const res = await fetch(`${API}/notifications/me`, { headers: auth(studentToken) });
      const body = (await res.json()) as { notifications: Notif[] };
      return body.notifications.length >= 2 ? body.notifications : null;
    });

    expect(list.every((n) => n.courseId === courseId)).toBe(true);
    expect(list.every((n) => n.attendancePercentage === 0)).toBe(true);
    expect(list.every((n) => n.read === false)).toBe(true);
    firstId = list[0].id;
  });

  it("marks one of the caller's notifications as read", async () => {
    const res = await fetch(`${API}/notifications/${firstId}/read`, { method: "PATCH", headers: auth(studentToken) });
    const body = (await res.json()) as { notification: Notif };
    expect(res.status).toBe(200);
    expect(body.notification.read).toBe(true);
  });

  it("returns 404 when another user tries to mark it read", async () => {
    const res = await fetch(`${API}/notifications/${firstId}/read`, { method: "PATCH", headers: auth(facultyToken) });
    expect(res.status).toBe(404);
  });

  it("shows another user an empty list, proving identity comes from the token", async () => {
    const res = await fetch(`${API}/notifications/me`, { headers: auth(facultyToken) });
    const body = (await res.json()) as { notifications: Notif[] };
    expect(res.status).toBe(200);
    expect(body.notifications).toEqual([]);
  });

  it("rejects a malformed id with 400", async () => {
    const res = await fetch(`${API}/notifications/not-a-uuid/read`, { method: "PATCH", headers: auth(studentToken) });
    expect(res.status).toBe(400);
  });

  it("rejects a request with no token", async () => {
    const res = await fetch(`${API}/notifications/me`);
    expect(res.status).toBe(401);
  });
});