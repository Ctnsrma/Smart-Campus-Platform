import crypto from "node:crypto";

export function generateRefreshTokenValue(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  return expires;
}