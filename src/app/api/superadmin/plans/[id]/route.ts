import { NextRequest, NextResponse } from "next/server"
import { db }   from "@/db"
import { plans } from "@/db/schema"
import { eq }   from "drizzle-orm"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  await db.update(plans).set({ ...body, updatedAt: new Date() }).where(eq(plans.id, id))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(plans).where(eq(plans.id, id))
  return NextResponse.json({ success: true })
}
