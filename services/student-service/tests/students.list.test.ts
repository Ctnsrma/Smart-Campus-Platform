import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";

const facultyEmail = "integration.studentlist.faculty@example.com";
const studentEmail = "integration.studentlist.student@example.com";
const password = "correct-horse-battery";
const API = "http://localhost:3002";

type StudentRow = { userId: string; fullName: string; department: string; semester: number };

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

beforeAll(async () => {
  await registerUser(facultyEmail);
  await db.execute(sql`UPDATE auth_service.users SET role = 'FACULTY' WHERE email = ${facultyEmail}`);
  facultyToken = await login(facultyEmail);

  studentUserId = await registerUser(studentEmail);
  studentToken = await login(studentEmail);

  const res = await fetch(`${API}/students/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(studentToken) },
    body: JSON.stringify({ fullName: "Zed Listtest", department: "Testing", semester: 2 }),
  });
  expect(res.status).toBe(201);
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM student_service.students WHERE user_id = ${studentUserId}`);
  await deleteTestUser(facultyToken);
  await deleteTestUser(studentToken);
  await pool.end();
});

describe("GET /students", () => {
  it("lists students, with only the expected fields, for a faculty member", async () => {
    const res = await fetch(`${API}/students`, { headers: auth(facultyToken) });
    const body = (await res.json()) as { students: StudentRow[] };
    expect(res.status).toBe(200);
    const mine = body.students.find((s) => s.userId === studentUserId);
    expect(mine).toEqual({ userId: studentUserId, fullName: "Zed Listtest", department: "Testing", semester: 2 });
  });

  it("rejects a student with 403", async () => {
    const res = await fetch(`${API}/students`, { headers: auth(studentToken) });
    expect(res.status).toBe(403);
  });

  it("rejects a request with no token", async () => {
    const res = await fetch(`${API}/students`);
    expect(res.status).toBe(401);
  });
});