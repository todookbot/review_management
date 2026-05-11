// ─── Existing adapters ────────────────────────────────────────────────────────
import { GoogleMyBusinessAdapter }  from "./google-mybusiness"
import { YelpAdapter }              from "./yelp"
import { AmazonAdapter }            from "./amazon"
import { AppStoreAdapter, GooglePlayAdapter } from "./app-store"

// ─── Location adapters ────────────────────────────────────────────────────────
import { TripAdvisorAdapter }       from "./location"
import { FoursquareAdapter }        from "./location"
import { AppleMapsAdapter }         from "./location"
import { ZomatoAdapter }            from "./location"
import { JustDialAdapter }          from "./location"

// ─── Hospitality adapters ─────────────────────────────────────────────────────
import { BookingComAdapter }        from "./hospitality"
import { AirbnbAdapter }            from "./hospitality"
import { ExpediaAdapter }           from "./hospitality"
import { AgodaAdapter }             from "./hospitality"

// ─── Social adapters ──────────────────────────────────────────────────────────
import { FacebookAdapter }          from "./social"
import { TwitterAdapter }           from "./social"
import { InstagramAdapter }         from "./social"
import { RedditAdapter }            from "./social"
import { LinkedInAdapter }          from "./social"

// ─── Product / E-commerce adapters ───────────────────────────────────────────
import { ShopifyAdapter }           from "./product"
import { WooCommerceAdapter }       from "./product"
import { TrustpilotAdapter }        from "./product"
import { G2Adapter }                from "./product"
import { CapterraAdapter }          from "./product"
import { FlipkartAdapter }          from "./product"
import { ProductHuntAdapter }       from "./product"

// ─── App Store adapters ───────────────────────────────────────────────────────
import { HuaweiAppGalleryAdapter }  from "./appstores"

// ─── Internal / Custom adapters ───────────────────────────────────────────────
import { QrFeedbackAdapter }        from "./internal"
import { CustomApiAdapter }         from "./internal"
import { EmailSurveyAdapter }       from "./internal"
import { InAppSdkAdapter }          from "./internal"

import type { BasePortalAdapter }   from "./base-adapter"

// ─── Registry ─────────────────────────────────────────────────────────────────
// All 28 platform adapters registered here. Add new platforms by:
// 1. Implementing BasePortalAdapter in the appropriate file
// 2. Adding it to this registry map

const adapterRegistry: Record<string, BasePortalAdapter> = {
  // ── Location / Physical ──────────────────────────────────────────────────
  GOOGLE_MY_BUSINESS: new GoogleMyBusinessAdapter(),
  YELP:               new YelpAdapter(),
  TRIPADVISOR:        new TripAdvisorAdapter(),
  FACEBOOK:           new FacebookAdapter(),
  FOURSQUARE:         new FoursquareAdapter(),
  APPLE_MAPS:         new AppleMapsAdapter(),
  ZOMATO:             new ZomatoAdapter(),
  JUSTDIAL:           new JustDialAdapter(),

  // ── Product / E-commerce ─────────────────────────────────────────────────
  AMAZON:             new AmazonAdapter(),
  FLIPKART:           new FlipkartAdapter(),
  SHOPIFY:            new ShopifyAdapter(),
  WOOCOMMERCE:        new WooCommerceAdapter(),
  TRUSTPILOT:         new TrustpilotAdapter(),
  G2:                 new G2Adapter(),
  CAPTERRA:           new CapterraAdapter(),
  PRODUCTHUNT:        new ProductHuntAdapter(),

  // ── App Stores ────────────────────────────────────────────────────────────
  APPLE_APP_STORE:    new AppStoreAdapter(),
  GOOGLE_PLAY_STORE:  new GooglePlayAdapter(),
  HUAWEI_APPGALLERY:  new HuaweiAppGalleryAdapter(),

  // ── Social ────────────────────────────────────────────────────────────────
  TWITTER:            new TwitterAdapter(),
  INSTAGRAM:          new InstagramAdapter(),
  REDDIT:             new RedditAdapter(),
  LINKEDIN:           new LinkedInAdapter(),

  // ── Hospitality ───────────────────────────────────────────────────────────
  BOOKING_COM:        new BookingComAdapter(),
  AIRBNB:             new AirbnbAdapter(),
  EXPEDIA:            new ExpediaAdapter(),
  AGODA:              new AgodaAdapter(),

  // ── Internal / Custom ─────────────────────────────────────────────────────
  QR_FEEDBACK:        new QrFeedbackAdapter(),
  CUSTOM_API:         new CustomApiAdapter(),
  EMAIL_SURVEY:       new EmailSurveyAdapter(),
  INAPP_SDK:          new InAppSdkAdapter(),
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAdapter(platform: string): BasePortalAdapter {
  const adapter = adapterRegistry[platform.toUpperCase()]
  if (!adapter) throw new Error(`No adapter registered for platform: ${platform}`)
  return adapter
}

export function getAllAdapters(): BasePortalAdapter[] {
  return Object.values(adapterRegistry)
}

export function getPlatformMeta(platform: string) {
  const adapter = adapterRegistry[platform.toUpperCase()]
  if (!adapter) return null
  return {
    platform:    adapter.platform,
    displayName: adapter.displayName,
    authModes:   adapter.authModes,
    hasOAuth:    adapter.authModes.includes("OAUTH"),
    hasApiKey:   adapter.authModes.includes("API_KEY"),
    hasWebhook:  adapter.authModes.includes("WEBHOOK"),
  }
}

export { QrFeedbackAdapter } // re-export for QR URL generation

// ─── Platform display config (UI) ─────────────────────────────────────────────

export const PLATFORM_CONFIG: Record<string, {
  name:     string
  icon:     string
  color:    string
  category: "location" | "product" | "app" | "social" | "hospitality" | "internal"
}> = {
  // Location
  GOOGLE_MY_BUSINESS: { name: "Google My Business", icon: "🔍", color: "#4285F4", category: "location"    },
  YELP:               { name: "Yelp",               icon: "⭐", color: "#D32323", category: "location"    },
  TRIPADVISOR:        { name: "TripAdvisor",         icon: "🦉", color: "#34E0A1", category: "location"    },
  FACEBOOK:           { name: "Facebook",            icon: "👍", color: "#1877F2", category: "location"    },
  FOURSQUARE:         { name: "Foursquare",          icon: "📍", color: "#F94877", category: "location"    },
  APPLE_MAPS:         { name: "Apple Maps",          icon: "🗺️", color: "#000000", category: "location"    },
  ZOMATO:             { name: "Zomato",              icon: "🍽️", color: "#E23744", category: "location"    },
  JUSTDIAL:           { name: "JustDial",            icon: "📞", color: "#FF6600", category: "location"    },
  // Product
  AMAZON:             { name: "Amazon",              icon: "📦", color: "#FF9900", category: "product"     },
  FLIPKART:           { name: "Flipkart",            icon: "🛒", color: "#2874F0", category: "product"     },
  SHOPIFY:            { name: "Shopify",             icon: "🛍️", color: "#96BF48", category: "product"     },
  WOOCOMMERCE:        { name: "WooCommerce",         icon: "🟣", color: "#7F54B3", category: "product"     },
  TRUSTPILOT:         { name: "Trustpilot",          icon: "✅", color: "#00B67A", category: "product"     },
  G2:                 { name: "G2",                  icon: "🔴", color: "#FF492C", category: "product"     },
  CAPTERRA:           { name: "Capterra",            icon: "📊", color: "#FF6C00", category: "product"     },
  PRODUCTHUNT:        { name: "ProductHunt",         icon: "🚀", color: "#DA552F", category: "product"     },
  // App Stores
  APPLE_APP_STORE:    { name: "App Store",           icon: "🍎", color: "#000000", category: "app"         },
  GOOGLE_PLAY_STORE:  { name: "Google Play",         icon: "▶️", color: "#34A853", category: "app"         },
  HUAWEI_APPGALLERY:  { name: "Huawei AppGallery",   icon: "🌺", color: "#CF0A2C", category: "app"         },
  // Social
  TWITTER:            { name: "Twitter / X",         icon: "𝕏",  color: "#000000", category: "social"      },
  INSTAGRAM:          { name: "Instagram",           icon: "📸", color: "#E1306C", category: "social"      },
  REDDIT:             { name: "Reddit",              icon: "👾", color: "#FF4500", category: "social"      },
  LINKEDIN:           { name: "LinkedIn",            icon: "💼", color: "#0077B5", category: "social"      },
  // Hospitality
  BOOKING_COM:        { name: "Booking.com",         icon: "🏨", color: "#003580", category: "hospitality" },
  AIRBNB:             { name: "Airbnb",              icon: "🏠", color: "#FF5A5F", category: "hospitality" },
  EXPEDIA:            { name: "Expedia",             icon: "✈️", color: "#FFC72C", category: "hospitality" },
  AGODA:              { name: "Agoda",               icon: "🌏", color: "#CC0000", category: "hospitality" },
  // Internal
  QR_FEEDBACK:        { name: "QR Feedback",         icon: "📱", color: "#6366f1", category: "internal"    },
  EMAIL_SURVEY:       { name: "Email Survey",        icon: "📧", color: "#06B6D4", category: "internal"    },
  INAPP_SDK:          { name: "In-App SDK",          icon: "⚙️", color: "#8B5CF6", category: "internal"    },
  CUSTOM_API:         { name: "Custom API",          icon: "🔧", color: "#64748b", category: "internal"    },
}
