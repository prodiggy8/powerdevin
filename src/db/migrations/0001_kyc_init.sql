CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'escalated');--> statement-breakpoint
CREATE TABLE "kyc_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"country" text NOT NULL,
	"risk_score" integer NOT NULL,
	"status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"decision_reason" text,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD CONSTRAINT "kyc_cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD CONSTRAINT "kyc_cases_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_cases_status_idx" ON "kyc_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_cases_submitted_at_idx" ON "kyc_cases" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "kyc_cases_assigned_to_idx" ON "kyc_cases" USING btree ("assigned_to");