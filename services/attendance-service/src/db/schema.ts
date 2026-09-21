import { pgSchema,uuid,varchar,uniqueIndex,timestamp } from "drizzle-orm/pg-core";

export const attendanceSchema = pgSchema("attendance_service");

export const attendanceRecords = attendanceSchema.table(
    "attendance_records",{
        id: uuid("id").primaryKey().defaultRandom(),
        studentUserId: uuid("student_user_id").notNull(),
        courseId: uuid("course_id").notNull(),
        status: varchar("status",{length: 16}).notNull().default("ABSENT"),
        markedByUserId: uuid("marked_by_user_id").notNull(),
        createdAt: timestamp("created_at",{withTimezone: true}).notNull().defaultNow()
    },
)