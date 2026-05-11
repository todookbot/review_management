import { NextRequest, NextResponse } from "next/server"
import { db }            from "@/db"
import { reviewSources } from "@/db/schema"
import { eq }            from "drizzle-orm"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    await db.delete(reviewSources).where(eq(reviewSources.id, id))
  } catch (err) {
    console.warn("DB delete failed, removing from local storage:", id)
    const { deleteLocalSource } = require("@/lib/local-storage")
    deleteLocalSource(id)
  }
  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }  = await params
  const body    = await req.json()
  const allowed = ["status", "displayName", "lastSyncError"]
  const update: Record<string, unknown> = { updatedAt: new Date() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  try {
    await db.update(reviewSources).set(update).where(eq(reviewSources.id, id))
  } catch (err) {
    console.warn("DB update failed, saving to local storage:", id)
    const { saveLocalSource } = require("@/lib/local-storage")
    saveLocalSource({ id, ...update })
  }
  return NextResponse.json({ success: true })
}
