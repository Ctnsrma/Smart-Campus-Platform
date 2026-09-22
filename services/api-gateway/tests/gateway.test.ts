// services/api-gateway/tests/gateway.test.ts
import { describe, it, expect, afterAll } from "vitest";

const GATEWAY_URL = "http://localhost:3000";
const testEmail = "integration.gateway@example.com";
const testPassword = "correct-horse-battery";

let accessToken: string;

async function deleteTestUser(token: string) {
  await fetch(`${GATEWAY_URL}/auth/me`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

afterAll(async () => {
  if (accessToken) await deleteTestUser(accessToken);
});

describe("API Gateway routing", () => {
  it("forwards POST /auth/register to Auth Service with the full path preserved", async () => {
    const res = await fetch(`${GATEWAY_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user.email).toBe(testEmail);
  });

  it("forwards POST /auth/login and returns a real, usable access token", async () => {
    const res = await fetch(`${GATEWAY_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe("string");

    accessToken = body.accessToken;
  });

  it("forwards a token-authenticated request to Student Service via /students/me", async () => {
    // Relies on the token obtained through the Gateway in the previous test - deliberately proving the realistic end-to-end client flow
    // (login through the Gateway, then use that token through the Gateway against a completely different backend service) rather than just testing each route in isolation.
    const res = await fetch(`${GATEWAY_URL}/students/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // This student has no profile yet, so 404 is the CORRECT response - the assertion that matters here is that the request reached
    // Student Service at all (proven by getting Student Service's own "no profile found" response, not a Gateway routing failure like "Cannot GET" or a connection error).
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("No student profile found for this account");
  });

  it("returns 401, not a routing failure, when calling /students/me with no token", async () => {
    const res = await fetch(`${GATEWAY_URL}/students/me`);
    expect(res.status).toBe(401);
  });
});