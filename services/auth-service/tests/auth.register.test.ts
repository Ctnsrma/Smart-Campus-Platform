import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

const app = createApp();
const testEmail = "integration.register@example.com";

async function cleanupTestUser() {
  await db.delete(users).where(eq(users.email, testEmail));
}

beforeEach(async () => {
  await cleanupTestUser();
});

afterAll(async () => {
  await cleanupTestUser();
  await pool.end();
});

describe("POST /auth/register", () => {
  it("creates a new account and does not return the password hash", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: testEmail, password: "correct-horse-battery" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.role).toBe("STUDENT");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/auth/register").send({ email: testEmail, password: "correct-horse-battery" });

    const res = await request(app)
      .post("/auth/register")
      .send({ email: testEmail, password: "correct-horse-battery" });

    expect(res.status).toBe(409);
  });

  it("rejects a weak password with 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: testEmail, password: "short" });

    expect(res.status).toBe(400);
  });
});