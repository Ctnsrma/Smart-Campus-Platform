import {pgSchema,uuid,text,boolean,timestamp,integer } from "drizzle-orm/pg-core"; 

export const notificationSchema = pgSchema("notification_service");

export const notifications = notificationSchema.table(
    "notifications",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        studentUserId: uuid("student_user_id").notNull(),
        courseId: uuid("course_id").notNull(),
        attendancePercentage: integer("attendance_percentage").notNull(),
        message: text("message").notNull(),
        read: boolean("read").default(false).notNull(),
        createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
    }
)