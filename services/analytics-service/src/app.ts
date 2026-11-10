import express, { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client";
import { analytics } from "./db/schema";
import { requireAuth, requireRole, AuthenticatedRequest } from "./middleware/auth";

// Same threshold the Attendance Service uses for attendance.low events.
const LOW_ATTENDANCE_THRESHOLD = 75;

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "analytics-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/analytics/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const rows = await db
      .select({
        courseId: analytics.courseId,
        totalMarked: analytics.totalMarked,
        totalPresent: analytics.totalPresent,
        lastAttendancePercentage: analytics.lastAttendancePercentage,
        updatedAt: analytics.updatedAt,
      })
      .from(analytics)
      .where(eq(analytics.studentUserId, req.user!.sub))
      .orderBy(desc(analytics.updatedAt));
    res.status(200).json({ courses: rows });
  });

  app.get(
    "/analytics/courses/:courseId/summary",
    requireAuth,
    requireRole("FACULTY", "ADMIN"),
    async (req: AuthenticatedRequest, res: Response) => {
      const parsedId = z.string().uuid().safeParse(req.params.courseId);
      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid course id" });
        return;
      }

      const rows = await db
        .select({ pct: analytics.lastAttendancePercentage })
        .from(analytics)
        .where(eq(analytics.courseId, parsedId.data));

      const studentsTracked = rows.length;
      const averageAttendance =
        studentsTracked === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.pct, 0) / studentsTracked);
      const studentsBelowThreshold = rows.filter((r) => r.pct < LOW_ATTENDANCE_THRESHOLD).length;

      res.status(200).json({
        courseId: parsedId.data,
        studentsTracked,
        averageAttendance,
        studentsBelowThreshold,
      });
    },
  );

  return app;
}