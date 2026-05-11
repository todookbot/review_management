import fs from "fs"
import path from "path"

const STORAGE_PATH = path.join(process.cwd(), "scratch", "sources.json")

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
