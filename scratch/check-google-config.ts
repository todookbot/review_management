
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

async function checkConfig() {
  console.log("--- Google Integration Diagnostic ---")
  
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  
  console.log(`NEXT_PUBLIC_APP_URL: ${appUrl || "NOT SET (defaulting to http://localhost:3000)"}`)
  console.log(`GOOGLE_CLIENT_ID: ${clientId ? (clientId.substring(0, 10) + "...") : "MISSING"}`)
  console.log(`GOOGLE_CLIENT_SECRET: ${clientSecret ? "PRESENT (hidden)" : "MISSING"}`)
  
  const redirectUri = `${appUrl || "http://localhost:3000"}/api/oauth/callback/google`
  console.log(`Calculated Redirect URI: ${redirectUri}`)
  
  const scopes = [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid"
  ]
  
  const params = new URLSearchParams({
    client_id: clientId || "MISSING",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: "test-state"
  })
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  console.log("\nGenerated OAuth URL for manual testing:")
  console.log(authUrl)
  
  console.log("\n--- Verification Steps ---")
  console.log("1. Ensure 'Business Profile API' and 'My Business Business Information API' are ENABLED in Google Cloud Console.")
  console.log(`2. Ensure '${redirectUri}' is added to 'Authorized redirect URIs' in the OAuth 2.0 Client ID settings.`)
  console.log("3. If the app is in 'Testing' mode, add your email as a 'Test User'.")
}

checkConfig()
