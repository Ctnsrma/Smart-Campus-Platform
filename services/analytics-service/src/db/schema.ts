import {pgSchema,uuid,timestamp,integer, uniqueIndex} from "drizzle-orm/pg-core";

export const analyticsSchema = pgSchema("analytics_service");

export const analytics = analyticsSchema.table("analytics",{
    id: uuid("id").primaryKey().defaultRandom(),
    studentUserId: uuid("student_user_id").notNull(),
    courseId: uuid("course_id").notNull(),
    totalMarked: integer("total_marked").notNull(),
    totalPresent: integer("total_present").notNull(),
    lastAttendancePercentage: integer("last_attendance_percentage").notNull(),
    updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
    }, (table) => [uniqueIndex("analytics_student_course_unique_idx").on(table.studentUserId, table.courseId)],
)
