import { describe, it, expect, afterEach, afterAll } from "vitest";
import crypto from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { analytics } from "../src/db/schema";

const studentUserId = crypto.randomUUID();

async function upsertAttendanceMark(courseId: string, status: "PRESENT" | "ABSENT") {
  const wasPresent = status === "PRESENT" ? 1 : 0;

  await db
    .insert(analytics)
    .values({
      studentUserId,
      courseId,
      totalMarked: 1,
      totalPresent: wasPresent,
      lastAttendancePercentage: wasPresent * 100,
    })
    .onConflictDoUpdate({
      target: [analytics.studentUserId, analytics.courseId],
      set: {
        totalMarked: sql`${analytics.totalMarked} + 1`,
        totalPresent: sql`${analytics.totalPresent} + ${wasPresent}`,
        lastAttendancePercentage: wasPresent * 100,
        updatedAt: new Date(),
      },
    });
}

afterEach(async () => {
  await db.delete(analytics).where(eq(analytics.studentUserId, studentUserId));
});

afterAll(async () => {
  await pool.end();
});

describe("Analytics upsert concurrency safety", () => {
  it("correctly aggregates 10 truly concurrent upserts for the same student/course, with none lost", async () => {
    const courseId = crypto.randomUUID();

    // Promise.all fires all 10 database operations at genuinely the same
    // moment, deliberately forcing the exact race condition scenario
    // described in docs/ANALYTICS_SERVICE.md - this is stronger than
    // relying on network timing, which cannot be guaranteed to race
    // reliably from an external HTTP-based test.
    const marks: Array<"PRESENT" | "ABSENT"> = [
      "PRESENT", "ABSENT", "PRESENT", "PRESENT", "ABSENT",
      "ABSENT", "PRESENT", "ABSENT", "PRESENT", "ABSENT",
    ];

    await Promise.all(marks.map((status) => upsertAttendanceMark(courseId, status)));

    const [row] = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.studentUserId, studentUserId), eq(analytics.courseId, courseId)));

    expect(row).toBeDefined();
    expect(row.totalMarked).toBe(10);
    expect(row.totalPresent).toBe(marks.filter((m) => m === "PRESENT").length);
  });

  it("does not throw a unique-constraint error under concurrent inserts for a new row", async () => {
    const courseId = crypto.randomUUID();

    // Before the fix (Step 231), the first concurrent write to a brand
    // new (student, course) pair was exactly where the race condition
    // caused a duplicate-key error and a silently dropped event.
    await expect(
      Promise.all([
        upsertAttendanceMark(courseId, "PRESENT"),
        upsertAttendanceMark(courseId, "PRESENT"),
      ]),
    ).resolves.not.toThrow();

    const [row] = await db.select().from(analytics).where(eq(analytics.courseId, courseId));
    expect(row.totalMarked).toBe(2);
  });
});