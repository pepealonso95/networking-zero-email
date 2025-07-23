CREATE TABLE "mail0_lead" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"company" text,
	"job_title" text,
	"linkedin_url" text,
	"phone_number" text,
	"location" text,
	"source" text NOT NULL,
	"confidence" integer,
	"verified" boolean DEFAULT false,
	"added_to_crm" boolean DEFAULT false,
	"contact_id" text,
	"country_of_origin" text,
	"education_history" jsonb,
	"work_history" jsonb,
	"inferred_origin" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_lead_user_id_email_unique" UNIQUE("user_id","email")
);
--> statement-breakpoint
CREATE TABLE "mail0_lead_search" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"original_prompt" text NOT NULL,
	"processed_criteria" jsonb,
	"results_count" integer DEFAULT 0,
	"api_usage" jsonb,
	"status" text DEFAULT 'pending',
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "mail0_user_settings" ALTER COLUMN "settings" SET DEFAULT '{"language":"en","timezone":"UTC","dynamicContent":false,"externalImages":true,"customPrompt":"","trustedSenders":[],"isOnboarded":false,"colorTheme":"system","leadGeneration":{"hunterApiKey":"","apolloApiKey":"","snovApiKey":"","pdlApiKey":"","linkedinSalesNavCookie":"","linkedinAlternativeApiKey":"","linkedinAlternativeProvider":"scrap_in","defaultSearchLimit":10,"enableAutoEnrichment":true}}'::jsonb;--> statement-breakpoint
ALTER TABLE "mail0_lead" ADD CONSTRAINT "mail0_lead_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_lead" ADD CONSTRAINT "mail0_lead_contact_id_mail0_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."mail0_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_lead_search" ADD CONSTRAINT "mail0_lead_search_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;