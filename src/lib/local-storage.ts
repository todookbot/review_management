import fs from "fs"
import path from "path"

const STORAGE_PATH  = path.join(process.cwd(), "scratch", "sources.json")
const TOKEN_PATH    = path.join(process.cwd(), "scratch", "tokens.json")

export function getLocalSources() {
  if (!fs.existsSync(STORAGE_PATH)) return []
  try {
    const data = fs.readFileSync(STORAGE_PATH, "utf-8")
    return JSON.parse(data)
  } catch (err) {
    console.error("Failed to read local storage:", err)
    return []
  }
}

export function saveLocalSource(source: any) {
  const sources = getLocalSources()
  const index = sources.findIndex((s: any) => s.id === source.id)
  if (index >= 0) {
    sources[index] = { ...sources[index], ...source }
  } else {
    sources.push(source)
  }

  if (!fs.existsSync(path.dirname(STORAGE_PATH))) {
    fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true })
  }
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(sources, null, 2))
}

export function deleteLocalSource(id: string) {
  const sources = getLocalSources()
  const filtered = sources.filter((s: any) => s.id !== id)
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(filtered, null, 2))
}

// ── Token Storage ────────────────────────────────────────────────────────────
export function saveLocalToken(sourceId: string, token: any) {
  let tokens: Record<string, any> = {}
  if (fs.existsSync(TOKEN_PATH)) {
    try { tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")) } catch {}
  }
  tokens[sourceId] = { ...token, savedAt: new Date().toISOString() }
  if (!fs.existsSync(path.dirname(TOKEN_PATH))) {
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true })
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2))
}

export function getLocalToken(sourceId: string): any | null {
  if (!fs.existsSync(TOKEN_PATH)) return null
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"))
    return tokens[sourceId] ?? null
  } catch {
    return null
  }
}

export function getLatestGoogleToken(): { sourceId: string; token: any } | null {
  if (!fs.existsSync(TOKEN_PATH)) return null
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"))
    const entries = Object.entries(tokens)
      .filter(([, t]: any) => t.accessToken)
      .sort((a: any, b: any) => new Date(b[1].savedAt).getTime() - new Date(a[1].savedAt).getTime())
    if (!entries.length) return null
    return { sourceId: entries[0][0], token: entries[0][1] }
  } catch {
    return null
  }
}
