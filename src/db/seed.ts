/**
 * Demo seeder — populates the DB with sample tenants, users, sources, reviews + tags
 * Run with: npx tsx src/db/seed.ts
 */

import { db } from "./index"
import {
  tenants, users, reviewSources, reviews, reviewTags, responseDrafts,
  plans, subscriptions,
} from "./schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

async function seed() {
  console.log("🌱 Seeding ReviewPulse demo data…")

  // ── 0. Plans ──────────────────────────────────────────────────────────────

  const planDefs = [
    {
      name: "Free",  slug: "free",  description: "For individuals trying out the platform",
      maxConnectors: 2,  maxReviewsPerMonth: 500,    maxStorageGb: "1",  maxUsers: 1,
      priceMonthly: "0", priceYearly: "0", sortOrder: 0, isPublic: true,
      features: { aiDrafts:false, nlpTagging:false, whiteLabel:false, customDomain:false, apiAccess:false, prioritySupport:false, advancedAnalytics:false, teamCollaboration:false },
    },
    {
      name: "Starter", slug: "starter", description: "For small businesses",
      maxConnectors: 5,  maxReviewsPerMonth: 5000,   maxStorageGb: "5",  maxUsers: 5,
      priceMonthly: "49", priceYearly: "470", sortOrder: 1, isPublic: true,
      features: { aiDrafts:true, nlpTagging:true, whiteLabel:false, customDomain:false, apiAccess:false, prioritySupport:false, advancedAnalytics:false, teamCollaboration:true },
    },
    {
      name: "Growth", slug: "growth", description: "For growing companies with multiple locations",
      maxConnectors: 15, maxReviewsPerMonth: 25000,  maxStorageGb: "25", maxUsers: 20,
      priceMonthly: "149", priceYearly: "1430", sortOrder: 2, isPublic: true,
      features: { aiDrafts:true, nlpTagging:true, whiteLabel:true, customDomain:true, apiAccess:true, prioritySupport:false, advancedAnalytics:true, teamCollaboration:true },
    },
    {
      name: "Enterprise", slug: "enterprise", description: "For large organizations",
      maxConnectors: 999, maxReviewsPerMonth: 999999, maxStorageGb: "500", maxUsers: 999,
      priceMonthly: "499", priceYearly: "4790", sortOrder: 3, isPublic: true,
      features: { aiDrafts:true, nlpTagging:true, whiteLabel:true, customDomain:true, apiAccess:true, prioritySupport:true, advancedAnalytics:true, teamCollaboration:true },
    },
  ]

  const insertedPlans = await Promise.all(planDefs.map(p => db.insert(plans).values(p).returning()))
  const planMap = Object.fromEntries(insertedPlans.map(([p]) => [p.slug, p]))
  console.log("✅ Plans seeded:", Object.keys(planMap).join(", "))

  // ── 0b. Super Admin user (no tenant) ──────────────────────────────────────

  const superAdminHash = await bcrypt.hash("admin123", 12)
  await db.insert(users).values({
    tenantId:     null,
    email:        "admin@reviewpulse.io",
    name:         "Platform Admin",
    role:         "SUPER_ADMIN",
    passwordHash: superAdminHash,
    isActive:     true,
  })
  console.log("✅ Super admin seeded: admin@reviewpulse.io / admin123")

  // ── 1. Tenant ─────────────────────────────────────────────────────────────

  const [tenant] = await db.insert(tenants).values({
    name:           "Acme Corp",
    slug:           "acme",
    customDomain:   "reviews.acme.com",
    brandName:      "Acme",
    primaryColor:   "#6366f1",
    secondaryColor: "#f1f5f9",
    plan:           "GROWTH",
    settings: {
      autoTagging:       true,
      autoDraft:         true,
      defaultAiProvider: "CLAUDE",
      responseLanguage:  "en",
      notifyOnNewReview: true,
      notifyOnNegative:  true,
      urgencyThreshold:  3,
    },
  }).returning()

  console.log("✅ Tenant created:", tenant.slug)

  // ── 1b. Subscription for Acme ─────────────────────────────────────────────

  const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 14)
  await db.insert(subscriptions).values({
    tenantId:           tenant.id,
    planId:             planMap.growth.id,
    status:             "TRIALING",
    billingCycle:       "MONTHLY",
    currentPeriodStart: new Date(),
    currentPeriodEnd:   trialEnd,
    trialEndsAt:        trialEnd,
  })

  // ── 2. Users ──────────────────────────────────────────────────────────────

  const [pw1, pw2, pw3] = await Promise.all([
    bcrypt.hash("password123", 12),
    bcrypt.hash("password123", 12),
    bcrypt.hash("password123", 12),
  ])

  await db.insert(users).values([
    {
      tenantId:     tenant.id,
      email:        "alice@acme.com",
      name:         "Alice Doe",
      role:         "TENANT_ADMIN",
      passwordHash: pw1,
      isActive:     true,
    },
    {
      tenantId:     tenant.id,
      email:        "mark@acme.com",
      name:         "Mark Singh",
      role:         "MANAGER",
      passwordHash: pw2,
      isActive:     true,
    },
    {
      tenantId:     tenant.id,
      email:        "lucy@acme.com",
      name:         "Lucy Kim",
      role:         "RESPONDER",
      passwordHash: pw3,
      isActive:     true,
    },
  ])
  console.log("✅ Tenant users seeded: alice@acme.com / password123")

  console.log("✅ Users seeded")

  // ── 3. Review Sources ─────────────────────────────────────────────────────

  const [googleSource] = await db.insert(reviewSources).values({
    tenantId:    tenant.id,
    platform:    "GOOGLE_MY_BUSINESS",
    authMode:    "OAUTH",
    displayName: "NYC 5th Ave — Google",
    locationId:  "ChIJplace123",
    locationName:"NYC 5th Ave Branch",
    status:      "ACTIVE",
    config:      { accountId: "accounts/67890", locationId: "locations/12345" },
  }).returning()

  const [yelpSource] = await db.insert(reviewSources).values({
    tenantId:    tenant.id,
    platform:    "YELP",
    authMode:    "API_KEY",
    displayName: "NYC Main — Yelp",
    locationId:  "acme-nyc-main",
    locationName:"NYC Main Branch",
    status:      "ACTIVE",
  }).returning()

  const [amazonSource] = await db.insert(reviewSources).values({
    tenantId:    tenant.id,
    platform:    "AMAZON",
    authMode:    "API_KEY",
    displayName: "Wireless Headphones Pro — Amazon",
    productId:   "B08N5WRWNW",
    productName: "Wireless Headphones Pro",
    status:      "ACTIVE",
  }).returning()

  console.log("✅ Sources seeded")

  // ── 4. Reviews ────────────────────────────────────────────────────────────

  const reviewData = [
    {
      sourceId:    googleSource.id,
      platform:    "GOOGLE_MY_BUSINESS",
      externalId:  "goog_review_001",
      locationId:  googleSource.locationId,
      locationName:googleSource.locationName,
      authorName:  "Sarah Johnson",
      rating:      2,
      body:        "The service was incredibly slow today. We waited 45 minutes for our order. The food itself was okay but the experience ruined it.",
      reviewedAt:  new Date("2026-04-26T14:23:00Z"),
      isUrgent:    true,
      isProcessed: true,
      language:    "en",
      status:      "NEW" as const,
    },
    {
      sourceId:    yelpSource.id,
      platform:    "YELP",
      externalId:  "yelp_review_001",
      locationId:  yelpSource.locationId,
      locationName:yelpSource.locationName,
      authorName:  "Mike Chen",
      rating:      5,
      body:        "Absolutely love this place! The ambiance is perfect for a date night and the food quality has gone way up since their new chef joined. The pasta carbonara was divine!",
      reviewedAt:  new Date("2026-04-26T10:11:00Z"),
      isUrgent:    false,
      isProcessed: true,
      language:    "en",
      status:      "DRAFT_CREATED" as const,
    },
    {
      sourceId:    amazonSource.id,
      platform:    "AMAZON",
      externalId:  "amzn_review_001",
      productId:   amazonSource.productId,
      productName: amazonSource.productName,
      authorName:  "Patricia Williams",
      rating:      1,
      body:        "DEFECTIVE PRODUCT! The left earbud stopped working after 2 days. This is unacceptable for a $150 product. I want a full refund immediately.",
      reviewedAt:  new Date("2026-04-25T18:45:00Z"),
      isUrgent:    true,
      isProcessed: true,
      language:    "en",
      status:      "NEW" as const,
    },
    {
      sourceId:    googleSource.id,
      platform:    "GOOGLE_MY_BUSINESS",
      externalId:  "goog_review_002",
      locationId:  googleSource.locationId,
      locationName:googleSource.locationName,
      authorName:  "James Park",
      rating:      5,
      body:        "Best coffee in the neighborhood! The barista remembered my order from last week. That kind of personal touch is rare these days.",
      reviewedAt:  new Date("2026-04-24T12:00:00Z"),
      isUrgent:    false,
      isProcessed: true,
      language:    "en",
      status:      "NEW" as const,
    },
  ]

  const insertedReviews = await Promise.all(
    reviewData.map(r =>
      db.insert(reviews).values({ tenantId: tenant.id, ...r, metadata: {} }).returning()
    )
  )

  console.log("✅ Reviews seeded:", insertedReviews.length)

  // ── 5. NLP Tags ───────────────────────────────────────────────────────────

  const tagData = [
    // Review 1 (slow service, negative)
    { reviewId: insertedReviews[0][0].id, tagType: "SENTIMENT" as const, value: "NEGATIVE",      score: 0.91, source: "AWS_COMPREHEND" as const },
    { reviewId: insertedReviews[0][0].id, tagType: "TOPIC"     as const, value: "service_speed", score: 0.93, source: "CLAUDE" as const },
    { reviewId: insertedReviews[0][0].id, tagType: "TOPIC"     as const, value: "food_quality",  score: 0.72, source: "CLAUDE" as const },
    { reviewId: insertedReviews[0][0].id, tagType: "URGENCY"   as const, value: "HIGH",          score: 0.87, source: "CLAUDE" as const },
    { reviewId: insertedReviews[0][0].id, tagType: "INTENT"    as const, value: "COMPLAINT",     score: 0.95, source: "CLAUDE" as const },
    // Review 2 (positive, food + ambiance)
    { reviewId: insertedReviews[1][0].id, tagType: "SENTIMENT" as const, value: "POSITIVE",      score: 0.97, source: "AWS_COMPREHEND" as const },
    { reviewId: insertedReviews[1][0].id, tagType: "TOPIC"     as const, value: "food_quality",  score: 0.94, source: "CLAUDE" as const },
    { reviewId: insertedReviews[1][0].id, tagType: "TOPIC"     as const, value: "ambiance",      score: 0.88, source: "CLAUDE" as const },
    { reviewId: insertedReviews[1][0].id, tagType: "URGENCY"   as const, value: "LOW",           score: 0.99, source: "CLAUDE" as const },
    { reviewId: insertedReviews[1][0].id, tagType: "INTENT"    as const, value: "PRAISE",        score: 0.96, source: "CLAUDE" as const },
    // Review 3 (defective product, critical)
    { reviewId: insertedReviews[2][0].id, tagType: "SENTIMENT" as const, value: "NEGATIVE",      score: 0.99, source: "AWS_COMPREHEND" as const },
    { reviewId: insertedReviews[2][0].id, tagType: "TOPIC"     as const, value: "product_quality",score:0.98, source: "CLAUDE" as const },
    { reviewId: insertedReviews[2][0].id, tagType: "URGENCY"   as const, value: "CRITICAL",      score: 0.99, source: "CLAUDE" as const },
    { reviewId: insertedReviews[2][0].id, tagType: "INTENT"    as const, value: "COMPLAINT",     score: 0.99, source: "CLAUDE" as const },
  ]

  await db.insert(reviewTags).values(tagData)
  console.log("✅ NLP tags seeded:", tagData.length)

  // ── 6. Draft for positive review ──────────────────────────────────────────

  await db.insert(responseDrafts).values({
    reviewId:      insertedReviews[1][0].id,
    tenantId:      tenant.id,
    aiProvider:    "CLAUDE",
    model:         "claude-3-5-sonnet-20241022",
    promptVersion: "v1",
    status:        "PENDING_APPROVAL",
    body:          "Dear Mike,\n\nThank you so much for your wonderful words! We are absolutely thrilled to hear that your visit was such a delightful experience. Our team works incredibly hard to create a warm and welcoming atmosphere, and knowing it made your date night special means the world to us.\n\nWe'll be sure to pass your kind words to our chef — they will be over the moon to hear this! We look forward to welcoming you back soon.\n\nWarm regards,\nAcme Team",
  })

  console.log("✅ Draft seeded")
  console.log("\n🎉 Seeding complete! Start the app with: npm run dev")
  process.exit(0)
}

seed().catch(err => {
  console.error("❌ Seeding failed:", err)
  process.exit(1)
})
