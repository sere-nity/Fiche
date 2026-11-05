CREATE TYPE "public"."card_kind" AS ENUM('quote', 'synthesis');--> statement-breakpoint
CREATE TYPE "public"."synthesis_move" AS ENUM('lens', 'fusion', 'lineage', 'counterweight', 'concession', 'test_case');--> statement-breakpoint
CREATE TABLE "card_sources" (
	"card_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "card_sources_card_id_source_id_pk" PRIMARY KEY("card_id","source_id"),
	CONSTRAINT "no_self_source" CHECK ("card_sources"."card_id" <> "card_sources"."source_id")
);
--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "quote" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "kind" "card_kind" DEFAULT 'quote' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "move" "synthesis_move";--> statement-breakpoint
ALTER TABLE "card_sources" ADD CONSTRAINT "card_sources_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_sources" ADD CONSTRAINT "card_sources_source_id_cards_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_sources_source_idx" ON "card_sources" USING btree ("source_id");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "quote_cards_have_quote" CHECK ("cards"."kind" = 'synthesis' OR "cards"."quote" IS NOT NULL);