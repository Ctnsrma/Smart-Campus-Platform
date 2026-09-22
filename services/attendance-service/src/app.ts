import "dotenv/config";
import express, { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { attendanceRecords } from "./db/schema";
import { requireAuth, requireRole, AuthenticatedRequest } from "./middleware/auth";
import { markAttendanceSchema } from "./validation/schemas";
import { publishEvent } from "./messaging/publisher";

const LOW_ATTENDANCE_THRESHOLD = 75;

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "attendance-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/attendance/mark", requireAuth, requireRole("FACULTY", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
      const parsed = markAttendanceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const { studentUserId, courseId, status } = parsed.data;
      const markedByUserId = req.user!.sub;

      const [created] = await db
        .insert(attendanceRecords)
        .values({ studentUserId, courseId, status, markedByUserId })
        .returning();

      const allRecordsForCourse = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentUserId, studentUserId),
            eq(attendanceRecords.courseId, courseId),
          ),
        );

      const presentCount = allRecordsForCourse.filter((r) => r.status === "PRESENT").length;
      const attendancePercentage = Math.round((presentCount / allRecordsForCourse.length) * 100);

      await publishEvent("attendance.marked", { studentUserId, courseId, status, attendancePercentage });

      if (attendancePercentage < LOW_ATTENDANCE_THRESHOLD) {
        await publishEvent("attendance.low", { studentUserId, courseId, status, attendancePercentage });
      }

      res.status(201).json({ record: created, attendancePercentage });
    },
  );

  return app;
}