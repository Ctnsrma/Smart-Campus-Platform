CREATE SCHEMA "notification_service";
--> statement-breakpoint
CREATE TABLE "notification_service"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"attendance_percentage" integer NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
