import "dotenv/config";
import express, { Request, Response } from "express";
import { db } from "./db/client";
import { users } from "./db/schema";
import { hashPassword, verifyPassword } from "./utils/password";
import { signAccessToken } from "./utils/tokens";
import { eq } from "drizzle-orm";
import { registerSchema, loginSchema } from "./validation/schemas";
import { authRateLimiter } from "./middleware/rateLimit";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "auth-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/auth/register", authRateLimiter, async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [created] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email, role: users.role });

    res.status(201).json({ user: created });
  });

  app.post("/auth/login", authRateLimiter, async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

    res.status(200).json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  });

  app.get("/auth/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({ user: req.user });
  });

  return app;
}