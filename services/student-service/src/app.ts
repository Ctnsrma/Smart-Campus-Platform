import "dotenv/config";
import express, { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { students } from "./db/schema";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth";
import { createProfileSchema } from "./validation/schemas";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "student-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/students/profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const userId = req.user!.sub;

    const existing = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "A student profile already exists for this account" });
      return;
    }

    const [created] = await db
      .insert(students)
      .values({ userId, ...parsed.data })
      .returning();

    res.status(201).json({ student: created });
  });

  app.get("/students/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.sub;

    const [profile] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);

    if (!profile) {
      res.status(404).json({ error: "No student profile found for this account" });
      return;
    }

    res.status(200).json({ student: profile });
  });

  return app;
}