CREATE TYPE "public"."plan" AS ENUM('FREE', 'STARTER', 'GROWTH', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'RESPONDER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."auth_mode" AS ENUM('API_KEY', 'OAUTH', 'WEBHOOK', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('GOOGLE_MY_BUSINESS', 'YELP', 'TRIPADVISOR', 'FACEBOOK', 'FOURSQUARE', 'APPLE_MAPS', 'ZOMATO', 'JUSTDIAL', 'AMAZON', 'FLIPKART', 'SHOPIFY', 'WOOCOMMERCE', 'TRUSTPILOT', 'G2', 'CAPTERRA', 'PRODUCTHUNT', 'APPLE_APP_STORE', 'GOOGLE_PLAY_STORE', 'HUAWEI_APPGALLERY', 'TWITTER', 'INSTAGRAM', 'REDDIT', 'LINKEDIN', 'BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'AGODA', 'QR_FEEDBACK', 'EMAIL_SURVEY', 'INAPP_SDK', 'CUSTOM_API');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('ACTIVE', 'PAUSED', 'ERROR', 'PENDING_AUTH');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('NEW', 'IN_PROGRESS', 'DRAFT_CREATED', 'RESPONDED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."tag_source" AS ENUM('AWS_COMPREHEND', 'CLAUDE', 'OPENAI', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."tag_type" AS ENUM('SENTIMENT', 'TOPIC', 'ENTITY_PERSON', 'ENTITY_PRODUCT', 'ENTITY_LOCATION', 'URGENCY', 'INTENT', 'LANGUAGE');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('CLAUDE', 'OPENAI', 'HUMAN');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"custom_domain" varchar(255),
	"logo_url" text,
	"favicon_url" text,
	"primary_color" varchar(7) DEFAULT '#6366f1',
	"secondary_color" varchar(7) DEFAULT '#f1f5f9',
	"brand_name" varchar(255),
	"plan" "plan" DEFAULT 'FREE',
	"is_active" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{"autoTagging":true,"autoDraft":true,"defaultAiProvider":"CLAUDE","responseLanguage":"en","notifyOnNewReview":true,"notifyOnNegative":true,"urgencyThreshold":3}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'VIEWER',
	"password_hash" text,
	"is_active" boolean DEFAULT true,
	"scoped_location_ids" text[],
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "review_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"auth_mode" "auth_mode" NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"location_id" varchar(255),
	"location_name" varchar(255),
	"product_id" varchar(255),
	"product_name" varchar(255),
	"secret_arn" text,
	"webhook_secret" text,
	"webhook_url" text,
	"oauth_scopes" text[],
	"token_expires_at" timestamp,
	"external_account_id" varchar(255),
	"status" "source_status" DEFAULT 'PENDING_AUTH',
	"is_active" boolean DEFAULT true,
	"sync_interval_minutes" varchar(10) DEFAULT '60',
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"location_id" varchar(255),
	"location_name" varchar(255),
	"product_id" varchar(255),
	"product_name" varchar(255),
	"author_name" varchar(255),
	"author_avatar" text,
	"author_id" varchar(255),
	"is_verified" boolean DEFAULT false,
	"rating" real,
	"title" text,
	"body" text,
	"language" varchar(10) DEFAULT 'en',
	"reviewed_at" timestamp,
	"raw_payload_s3_key" text,
	"status" "review_status" DEFAULT 'NEW',
	"is_urgent" boolean DEFAULT false,
	"is_processed" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"tag_type" "tag_type" NOT NULL,
	"value" varchar(255) NOT NULL,
	"score" real,
	"tag_source" "tag_source" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"body" text NOT NULL,
	"body_edited_by" uuid,
	"body_edited_at" timestamp,
	"ai_provider" "ai_provider" NOT NULL,
	"model" varchar(100),
	"prompt_version" varchar(20),
	"draft_status" "draft_status" DEFAULT 'DRAFT',
	"created_by" uuid,
	"submitted_by" uuid,
	"submitted_at" timestamp,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejected_by" uuid,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"published_at" timestamp,
	"publish_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sources" ADD CONSTRAINT "review_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_source_id_review_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."review_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_body_edited_by_users_id_fk" FOREIGN KEY ("body_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_drafts" ADD CONSTRAINT "response_drafts_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;