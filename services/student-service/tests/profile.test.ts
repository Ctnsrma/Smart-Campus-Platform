import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestToken } from "../src/utils/testAuth";
import { db, pool } from "../src/db/client";
import { students } from "../src/db/schema";
import { eq } from "drizzle-orm";

const testEmail = "integration.student@example.com";
const testPassword = "correct-horse-battery";

let userId: string;
let token: string;

beforeAll(async () => {
  const registerResponse = await fetch("http://localhost:3001/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  expect(registerResponse.ok).toBe(true);
  const registerData = await registerResponse.json();
  userId = registerData.user.id;
  token = await getTestToken(testEmail, testPassword);
});

afterAll(async () => {
  if (userId) {
    await db.delete(students).where(eq(students.userId, userId));

    await fetch("http://localhost:3001/auth/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  await pool.end();
});

describe("POST /students/profile", () => {
  it("creates a new student profile", async () => {
    const response = await fetch("http://localhost:3002/students/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: "Test Student",
        department: "Computer Science",
        semester: 7,
      }),
    });

    expect(response.status).toBe(201);
  });

  it("rejects a duplicate profile creation with 409", async () => {
    const response = await fetch("http://localhost:3002/students/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: "Test Student",
        department: "Computer Science",
        semester: 7,
      }),
    });

    expect(response.status).toBe(409);
  });
});