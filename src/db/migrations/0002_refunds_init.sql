CREATE TYPE "public"."refund_reason" AS ENUM('duplicate', 'fraud', 'customer_request', 'service_failure', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"order_ref" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"note" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_requests_status_idx" ON "refund_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_requests_requested_at_idx" ON "refund_requests" USING btree ("requested_at");