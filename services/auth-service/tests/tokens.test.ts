import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/utils/tokens";

describe("access tokens", () => {
  const payload = { sub: "user-123", email: "student@example.com", role: "STUDENT" };

  it("signs a token that verifies back to the same payload", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it("throws an error when verifying a tampered token", () => {
    const token = signAccessToken(payload);
    const tamperedToken = token.slice(0, -3) + "xyz";

    expect(() => verifyAccessToken(tamperedToken)).toThrow();
  });
});