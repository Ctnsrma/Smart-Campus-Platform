import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/utils/password";

describe("password utils", () => {
  it("hashes a password to something different from the plaintext", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash).not.toBe("correct-horse-battery-staple");
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    const result = await verifyPassword("correct-horse-battery-staple", hash);
    expect(result).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    const result = await verifyPassword("wrong-password", hash);
    expect(result).toBe(false);
  });
});