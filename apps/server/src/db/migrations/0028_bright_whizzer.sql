CREATE TABLE "mail0_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"phone" text,
	"company" text,
	"job_title" text,
	"linkedin_url" text,
	"twitter_handle" text,
	"website" text,
	"notes" text,
	"tags" text,
	"priority" text DEFAULT 'medium',
	"status" text DEFAULT 'active',
	"lead_source" text,
	"last_contacted_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_contact_user_id_email_unique" UNIQUE("user_id","email")
);
--> statement-breakpoint
CREATE TABLE "mail0_contact_interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"direction" text,
	"subject" text,
	"content" text,
	"email_thread_id" text,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail0_contact_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1',
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_contact_tag_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "mail0_contact_tag_relation" (
	"contact_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_contact_tag_relation_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "mail0_contact" ADD CONSTRAINT "mail0_contact_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_contact_interaction" ADD CONSTRAINT "mail0_contact_interaction_contact_id_mail0_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."mail0_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_contact_interaction" ADD CONSTRAINT "mail0_contact_interaction_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_contact_tag" ADD CONSTRAINT "mail0_contact_tag_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_contact_tag_relation" ADD CONSTRAINT "mail0_contact_tag_relation_contact_id_mail0_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."mail0_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_contact_tag_relation" ADD CONSTRAINT "mail0_contact_tag_relation_tag_id_mail0_contact_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."mail0_contact_tag"("id") ON DELETE cascade ON UPDATE no action;