import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestToken} from "../src/utils/testAuth";
import { db, pool } from "../src/db/client";
import { courses } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const facultyEmail = "integration.faculty@example.com";
const studentEmail = "integration.coursestudent@example.com";
const testPassword = "correct-horse-battery";

let facultyUserId: string;
let facultyToken: string;
let studentToken: string;

async function registerUser(email: string, password: string) {
  const res = await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body.user.id;
}

async function promoteToFaculty(email: string) {
    // TEMPORARY: no HTTP endpoint exists yet for role promotion.
    // Justified the same way as auth-service's DELETE /auth/me workaround
    // once was: no alternative currently exists.
  await db.execute(sql`UPDATE auth_service.users SET role = 'FACULTY' WHERE email = ${email}`);
}

async function deleteTestUser(token: string) {
  await fetch("http://localhost:3001/auth/me", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeAll(async () => {
  facultyUserId = await registerUser(facultyEmail, testPassword);
  await promoteToFaculty(facultyEmail);
  facultyToken = await getTestToken(facultyEmail, testPassword);

  await registerUser(studentEmail, testPassword);
  studentToken = await getTestToken(studentEmail, testPassword);
});

afterAll(async () => {
  await db.delete(courses).where(eq(courses.facultyUserId, facultyUserId));
  await deleteTestUser(facultyToken);
  await deleteTestUser(studentToken);
  await pool.end();
});

describe("POST /courses", () => {
  it("allows a FACULTY user to create a course, self-assigned", async () => {
    const response = await fetch("http://localhost:3003/courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        code: "TST101",
        title: "Test Course",
        department: "Testing",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.course.facultyUserId).toBe(facultyUserId);
  });

  it("rejects a duplicate course code with 409", async () => {
    const response = await fetch("http://localhost:3003/courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        code: "TST101",
        title: "Different Title",
        department: "Testing",
      }),
    });

    expect(response.status).toBe(409);
  });

  it("rejects a STUDENT attempting to create a course with 403", async () => {
    const response = await fetch("http://localhost:3003/courses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        code: "TST999",
        title: "Should Not Work",
        department: "Testing",
      }),
    });

    expect(response.status).toBe(403);
  });
});