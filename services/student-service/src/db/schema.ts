import { pgSchema,uuid,varchar,timestamp,integer,uniqueIndex } from "drizzle-orm/pg-core";

export const studentSchema = pgSchema("student_service");

export const students = studentSchema.table(
    "students",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id").notNull(),
        fullName: varchar("full_name",{length:255}).notNull(),
        department: varchar("department",{length:255}).notNull(),
        semester: integer("semester").notNull(),
        createdAt: timestamp("created_at",{withTimezone: true}).notNull().defaultNow(),
        updatedAt: timestamp("updated_at",{withTimezone: true}).notNull().defaultNow(),
    },
    (table)=> [uniqueIndex("Students_user_id_unique_idx").on(table.userId)],
);



