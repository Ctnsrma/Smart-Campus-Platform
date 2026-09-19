import {pgSchema,uuid,varchar,timestamp,uniqueIndex} from "drizzle-orm/pg-core";

export const courseSchema = pgSchema("course_service");

export const courses = courseSchema.table(
    "courses",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code",{length:255}).notNull(),
        title: varchar("title",{length:255}).notNull(),
        department: varchar("department",{length:255}).notNull(),
        facultyUserId: uuid("faculty_user_id").notNull(),
        createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
        updatedAt: timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
    },
    (table)=> [uniqueIndex("Courses_code_unique_idx").on(table.code)],
);