import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

const app = createApp();
const testEmail = "integration.login@example.com";
const testPassword = "correct-horse-battery";

async function cleanupTestUser() {
  await db.delete(users).where(eq(users.email, testEmail));
}

beforeAll(async () => {
  await cleanupTestUser();
  await request(app).post("/auth/register").send({ email: testEmail, password: testPassword });
});

afterAll(async () => {
  await cleanupTestUser();
  await pool.end();
});

describe("POST /auth/login", () => {
  it("logs in successfully with correct credentials and returns an access token", async () => {
    const res = await request(app).post("/auth/login").send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.user.email).toBe(testEmail);
  });

  it("rejects an incorrect password with 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: testEmail, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects a non-existent email with the SAME error as wrong password (no user enumeration)", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@nowhere.edu", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });
});

describe("GET /auth/me", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a request with an invalid token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the user's identity with a valid token", async () => {
    const loginRes = await request(app).post("/auth/login").send({ email: testEmail, password: testPassword });
    const token = loginRes.body.accessToken;

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });
});