import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { db, pool } from "../src/db/client";
import { users, refreshTokens } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { afterAll } from "vitest";

const app = createApp();
const testEmail = "integration.delete@example.com";
const testPassword = "correct-horse-battery";

afterAll(async () => {
  await pool.end();
});

describe("DELETE /auth/me", () => {
  it("deletes the authenticated user's own account and cascades to their refresh tokens", async () => {
    await request(app).post("/auth/register").send({ email: testEmail, password: testPassword });
    const loginRes = await request(app).post("/auth/login").send({ email: testEmail, password: testPassword });
    const { accessToken, user } = loginRes.body;

    const deleteRes = await request(app).delete("/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const remainingUsers = await db.select().from(users).where(eq(users.id, user.id));
    expect(remainingUsers).toHaveLength(0);

    const remainingTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, user.id));
    expect(remainingTokens).toHaveLength(0);
  });

  it("rejects deletion attempts with no valid token", async () => {
    const res = await request(app).delete("/auth/me");
    expect(res.status).toBe(401);
  });
});