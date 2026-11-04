import express, { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client";
import { notifications } from "./db/schema";
import { requireAuth, AuthenticatedRequest } from "./middleware/auth";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "notification-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/notifications/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.studentUserId, req.user!.sub))
      .orderBy(desc(notifications.createdAt));
    res.status(200).json({ notifications: rows });
  });

  app.patch("/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const parsedId = z.string().uuid().safeParse(req.params.id);
    if (!parsedId.success) {
      res.status(400).json({ error: "Invalid notification id" });
      return;
    }

    const [updated] = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, parsedId.data), eq(notifications.studentUserId, req.user!.sub)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.status(200).json({ notification: updated });
  });

  return app;
}