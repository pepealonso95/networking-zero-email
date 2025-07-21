CREATE TABLE "mail0_contact_email_sync" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_sync_at" timestamp NOT NULL,
	"last_inbox_message_id" text,
	"last_sent_message_id" text,
	"inbox_sync_token" text,
	"sent_sync_token" text,
	"historic_sync_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_contact_email_sync_contact_id_user_id_unique" UNIQUE("contact_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "mail0_contact_email_sync" ADD CONSTRAINT "mail0_contact_email_sync_contact_id_mail0_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."mail0_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail0_contact_email_sync" ADD CONSTRAINT "mail0_contact_email_sync_user_id_mail0_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mail0_user"("id") ON DELETE cascade ON UPDATE no action;