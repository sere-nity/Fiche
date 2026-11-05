CREATE TYPE "public"."essay_mode" AS ENUM('practice', 'exam');--> statement-breakpoint
CREATE TYPE "public"."gist_check" AS ENUM('faithful', 'partly', 'no', 'unchecked');--> statement-breakpoint
CREATE TYPE "public"."link_status" AS ENUM('draft', 'final');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('supports', 'contradicts', 'extends', 'example_of');--> statement-breakpoint
CREATE TYPE "public"."citation_verdict" AS ENUM('substantive', 'decorative', 'misread');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"text_slug" text,
	"typed_source" text,
	"quote" text NOT NULL,
	"quote_prefix" text,
	"quote_suffix" text,
	"gist" text NOT NULL,
	"title" text NOT NULL,
	"gist_check" "gist_check" DEFAULT 'unchecked' NOT NULL,
	"gist_check_reason" text,
	"position" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"verdict" "citation_verdict",
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "essays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"question" text NOT NULL,
	"mode" "essay_mode" DEFAULT 'practice' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"feedback" jsonb
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"card_a_id" uuid NOT NULL,
	"card_b_id" uuid NOT NULL,
	"question" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bridge" text,
	"type" "link_type",
	"status" "link_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_pair_unique" UNIQUE("learner_id","card_a_id","card_b_id")
);
--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_card_a_id_cards_id_fk" FOREIGN KEY ("card_a_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_card_b_id_cards_id_fk" FOREIGN KEY ("card_b_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_learner_idx" ON "cards" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "citations_card_idx" ON "citations" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "essays_learner_idx" ON "essays" USING btree ("learner_id");