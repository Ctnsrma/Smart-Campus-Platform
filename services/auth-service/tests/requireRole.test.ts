import { describe, it, expect, vi } from "vitest";
import { Response } from "express";
import { requireRole, AuthenticatedRequest } from "../src/middleware/auth";

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requireRole middleware", () => {
  it("calls next() when the user has an allowed role", () => {
    const req = { user: { sub: "1", email: "a@b.com", role: "ADMIN" } } as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn();

    requireRole("ADMIN")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the user has a disallowed role", () => {
    const req = { user: { sub: "1", email: "a@b.com", role: "STUDENT" } } as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn();

    requireRole("ADMIN")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows access when the user matches any of multiple allowed roles", () => {
    const req = { user: { sub: "1", email: "a@b.com", role: "FACULTY" } } as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn();

    requireRole("ADMIN", "FACULTY")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects with 401 when there is no authenticated user at all", () => {
    const req = {} as AuthenticatedRequest;
    const res = createMockResponse();
    const next = vi.fn();

    requireRole("ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});