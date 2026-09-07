import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

const app = createApp();
const testEmail = "integration.refresh@example.com";
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

describe("POST /auth/refresh", () => {
  it("issues a new access + refresh token pair", async () => {
    const loginRes = await request(app).post("/auth/login").send({ email: testEmail, password: testPassword });
    const oldRefreshToken = loginRes.body.refreshToken;

    const refreshRes = await request(app).post("/auth/refresh").send({ refreshToken: oldRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.accessToken).toBe("string");
    expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);
  });

  it("rejects reuse of a refresh token that was already rotated out", async () => {
    const loginRes = await request(app).post("/auth/login").send({ email: testEmail, password: testPassword });
    const oldRefreshToken = loginRes.body.refreshToken;

    // First use - should succeed and rotate the token.
    await request(app).post("/auth/refresh").send({ refreshToken: oldRefreshToken });

    // Second use of the SAME now-rotated-out token - must be rejected.
    const reuseRes = await request(app).post("/auth/refresh").send({ refreshToken: oldRefreshToken });

    expect(reuseRes.status).toBe(401);
  });

  it("rejects a completely unknown refresh token", async () => {
    const res = await request(app).post("/auth/refresh").send({ refreshToken: "this-token-does-not-exist" });
    expect(res.status).toBe(401);
  });
});