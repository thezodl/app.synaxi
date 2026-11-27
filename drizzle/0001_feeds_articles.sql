CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"feed_id" uuid NOT NULL,
	"guid" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"author" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL,
	"sort_at" timestamp with time zone NOT NULL,
	"excerpt" text NOT NULL,
	"rss_html" text NOT NULL,
	"is_full_text" boolean NOT NULL,
	"extracted_html" text,
	"extracted_at" timestamp with time zone,
	"extract_failed_at" timestamp with time zone,
	"thumbnail_url" text,
	"bookmarked_at" timestamp with time zone,
	"bookmark_cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_feed_guid" UNIQUE("feed_id","guid")
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"url_enc" text NOT NULL,
	"url_hmac" text NOT NULL,
	"title" text NOT NULL,
	"site_url" text,
	"folder_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_url_hmac_unique" UNIQUE("url_hmac")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folders_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_sort" ON "articles" USING btree ("sort_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "articles_feed_sort" ON "articles" USING btree ("feed_id","sort_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "articles_bookmarked" ON "articles" USING btree ("bookmarked_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "articles"."bookmarked_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "feeds_folder" ON "feeds" USING btree ("folder_id");