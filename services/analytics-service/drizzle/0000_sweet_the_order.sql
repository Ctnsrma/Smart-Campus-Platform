CREATE SCHEMA "analytics_service";
--> statement-breakpoint
CREATE TABLE "analytics_service"."analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"total_marked" integer NOT NULL,
	"total_present" integer NOT NULL,
	"last_attendance_percentage" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_student_course_unique_idx" ON "analytics_service"."analytics" USING btree ("student_user_id","course_id");