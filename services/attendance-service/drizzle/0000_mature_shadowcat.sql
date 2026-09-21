CREATE SCHEMA "attendance_service";
--> statement-breakpoint
CREATE TABLE "attendance_service"."attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'ABSENT' NOT NULL,
	"marked_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
