CREATE SCHEMA "auth_service";
--> statement-breakpoint
CREATE TABLE "auth_service"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(16) DEFAULT 'STUDENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique_idx" ON "auth_service"."users" USING btree ("email");