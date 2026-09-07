import {pgSchema, uuid, varchar, timestamp, uniqueIndex} from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth_service");

export const users = authSchema.table(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        email: varchar("email",{length: 255}).notNull(),
        passwordHash: varchar("password_hash", {length:255}).notNull(),
        role: varchar("role",{length:16}).notNull().default("STUDENT"),
        createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow()
    },
    (table) => [uniqueIndex("user_email_unique_idx").on(table.email)],
);

export const refreshTokens = authSchema.table("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});