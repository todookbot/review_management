"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  CheckCircle, XCircle, RefreshCw, Sparkles, Star,
  Clock, User, Bot, Edit3, ExternalLink, ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import { PLATFORM_CONFIG } from "@/lib/portals"

const MOCK_DRAFTS = [
  {
    id: "d1",
    status: "DRAFT",
    aiProvider: "CLAUDE",
    model: "claude-3-5-sonnet",
    createdAt: "2026-04-27T08:10:00Z",
    review: {
      platform: "GOOGLE_MY_BUSINESS", rating: 2, locationName: "NYC 5th Ave",
      authorName: "Sarah Johnson",
      body: "The service was incredibly slow today. We waited 45 minutes for our order and the staff seemed overwhelmed.",
    },
    body: "Dear Sarah,\n\nThank you for sharing your honest feedback. We are truly sorry to hear about the long wait you experienced at our 5th Ave location — this is not the standard we hold ourselves to, and we completely understand your frustration.\n\nWe are actively working with our team to improve service speed during peak hours. We would love the opportunity to make this right. Please reach out to us directly at support@brand.com and mention this review.\n\nWe hope to see you again soon.\n\nWarm regards,\nThe Brand Team",
  },
  {
    id: "d2",
    status: "PENDING_APPROVAL",
    aiProvider: "CLAUDE",
    model: "claude-3-5-sonnet",
    createdAt: "2026-04-26T22:30:00Z",
    review: {
      platform: "YELP", rating: 5, locationName: "Brooklyn Branch",
      authorName: "Mike Chen",
      body: "Absolutely love this place! The ambiance is perfect for a date night and the food quality has improved massively.",
    },
    body: "Dear Mike,\n\nThank you so much for your wonderful words! We are thrilled to hear that your visit was such a great experience. Our team works incredibly hard to create a welcoming atmosphere, and knowing it made your date night special means the world to us.\n\nWe'll be sure to pass your kind words to our chef — they will be over the moon! We look forward to welcoming you back soon.\n\nWarm regards,\nThe Brand Team",
  },
  {
    id: "d3",
    status: "DRAFT",
    aiProvider: "OPENAI",
    model: "gpt-4o-mini",
    createdAt: "2026-04-26T15:45:00Z",
    review: {
      platform: "AMAZON", rating: 1, productName: "Wireless Headphones Pro",
      authorName: "Patricia Williams",
      body: "DEFECTIVE PRODUCT! The left earbud stopped working after 2 days.",
    },
    body: "Dear Patricia,\n\nWe sincerely apologize for the defective product you received. A device failing after just 2 days is completely unacceptable, and we take full responsibility.\n\nPlease contact our dedicated support team at returns@brand.com with your order number and we will immediately arrange a full replacement or refund — whichever you prefer. We stand behind every product we sell.\n\nThank you for bringing this to our attention.\n\nBest regards,\nThe Brand Team",
  },
  {
    id: "d4",
    status: "APPROVED",
    aiProvider: "CLAUDE",
    model: "claude-3-5-sonnet",
    createdAt: "2026-04-25T10:20:00Z",
    review: {
      platform: "TRIPADVISOR", rating: 3, locationName: "Hotel Grand Downtown",
      authorName: "Emma Thompson",
      body: "Mixed experience. Room was clean but check-in took forever and breakfast was disappointing.",
    },
    body: "Dear Emma,\n\nThank you for your candid feedback. We're pleased to hear the room met your expectations, and we sincerely apologize for the check-in delays and breakfast experience that fell short.\n\nYour comments have been shared directly with our front desk and kitchen teams. We are committed to improving and hope to have the opportunity to show you a much better stay.\n\nKind regards,\nThe Brand Team",
  },
  {
    id: "d5",
    status: "PUBLISHED",
    aiProvider: "CLAUDE",
    model: "claude-3-5-sonnet",
    createdAt: "2026-04-24T16:00:00Z",
    review: {
      platform: "APPLE_APP_STORE", rating: 4, productName: "ReviewPulse Mobile",
      authorName: "Dev Rodriguez",
      body: "Great app overall! Would love to see dark mode added.",
    },
    body: "Dear Dev,\n\nThank you for the kind review and the great suggestion! Dark mode is actually already on our roadmap — stay tuned for our next update. Your feedback truly shapes our product.\n\nWe are glad ReviewPulse is making a difference for you!\n\nThe ReviewPulse Team",
  },
]

const STATUS_CONFIG = {
  DRAFT:            { label: "Draft",           color: "bg-slate-400",  badge: "secondary" as const },
  PENDING_APPROVAL: { label: "Pending Approval", color: "bg-amber-500",  badge: "outline" as const },
  APPROVED:         { label: "Approved",         color: "bg-green-500",  badge: "outline" as const },
  REJECTED:         { label: "Rejected",         color: "bg-red-500",    badge: "destructive" as const },
  PUBLISHED:        { label: "Published",        color: "bg-blue-500",   badge: "outline" as const },
  FAILED:           { label: "Failed",           color: "bg-red-700",    badge: "destructive" as const },
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  )
}

export default function DraftsPage() {
  const [tab,        setTab]        = useState("pending")
  const [selected,   setSelected]   = useState<typeof MOCK_DRAFTS[0] | null>(null)
  const [editedBody, setEditedBody] = useState("")
  const [loading,    setLoading]    = useState(false)
  const [rejectNote, setRejectNote] = useState("")
  const [showReject, setShowReject] = useState(false)

  const byStatus = {
    pending:   MOCK_DRAFTS.filter(d => ["DRAFT", "PENDING_APPROVAL"].includes(d.status)),
    approved:  MOCK_DRAFTS.filter(d => d.status === "APPROVED"),
    published: MOCK_DRAFTS.filter(d => d.status === "PUBLISHED"),
    rejected:  MOCK_DRAFTS.filter(d => d.status === "REJECTED"),
  }

  function openDraft(draft: typeof MOCK_DRAFTS[0]) {
    setSelected(draft)
    setEditedBody(draft.body)
    setRejectNote("")
    setShowReject(false)
  }

  async function handleApprove() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoading(false)
    toast.success("Response approved and published to " + PLATFORM_CONFIG[selected!.review.platform]?.name)
    setSelected(null)
  }

  async function handleReject() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    toast.info("Draft rejected. AI will regenerate with " + (selected!.aiProvider === "CLAUDE" ? "OpenAI" : "Claude"))
    setSelected(null)
    setShowReject(false)
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Pending Review", count: byStatus.pending.length,   color: "text-amber-600" },
          { label: "Approved",       count: byStatus.approved.length,   color: "text-green-600" },
          { label: "Published",      count: byStatus.published.length,  color: "text-blue-600"  },
          { label: "Rejected",       count: byStatus.rejected.length,   color: "text-red-600"   },
        ].map(({ label, count, color }) => (
          <Card key={label} className="p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {byStatus.pending.length > 0 && (
              <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4 bg-amber-500">{byStatus.pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "published"] as const).map(statusTab => (
          <TabsContent key={statusTab} value={statusTab} className="space-y-3 mt-4">
            {byStatus[statusTab].length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No drafts in this state
              </div>
            ) : byStatus[statusTab].map(draft => {
              const pConfig = PLATFORM_CONFIG[draft.review.platform]
              const sConfig = STATUS_CONFIG[draft.status as keyof typeof STATUS_CONFIG]
              return (
                <Card
                  key={draft.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openDraft(draft)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      {/* AI provider badge */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          draft.aiProvider === "CLAUDE" ? "bg-orange-500" : "bg-green-600"
                        }`}>
                          <Bot className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{draft.aiProvider}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Review context */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium" style={{ color: pConfig?.color }}>
                            {pConfig?.icon} {pConfig?.name}
                          </span>
                          <StarRow rating={draft.review.rating} />
                          <span className="text-xs text-muted-foreground">by {draft.review.authorName}</span>
                          {draft.review.locationName && (
                            <span className="text-xs text-muted-foreground">· {draft.review.locationName}</span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {new Date(draft.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Original review snippet */}
                        <p className="text-xs text-muted-foreground italic mb-2 line-clamp-1">
                          "{draft.review.body}"
                        </p>

                        {/* Draft response */}
                        <p className="text-sm line-clamp-2">{draft.body}</p>

                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${sConfig.color}`} />
                            <span className="text-xs text-muted-foreground">{sConfig.label}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        ))}
      </Tabs>

      {/* Draft Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={o => { if (!o) setSelected(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const pConfig = PLATFORM_CONFIG[selected.review.platform]
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <Bot className="w-4 h-4 text-orange-500" />
                    AI Draft — {pConfig?.name} review by {selected.review.authorName}
                  </DialogTitle>
                </DialogHeader>

                {/* Original review */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">ORIGINAL REVIEW</p>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <StarRow rating={selected.review.rating} />
                      <span className="text-xs text-muted-foreground">by {selected.review.authorName}</span>
                    </div>
                    <p className="leading-relaxed">{selected.review.body}</p>
                  </div>
                </div>

                <Separator />

                {/* Draft editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      DRAFT RESPONSE
                      <span className="font-normal text-muted-foreground/70">
                        (generated by {selected.aiProvider} · {selected.model})
                      </span>
                    </p>
                  </div>
                  <Textarea
                    value={editedBody}
                    onChange={e => setEditedBody(e.target.value)}
                    className="min-h-[180px] text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{editedBody.length} characters · ~{Math.round(editedBody.split(" ").length / 130)} min read</p>
                </div>

                {showReject && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">REJECTION REASON</p>
                    <Textarea
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      placeholder="What needs to be changed? The AI will use this as context for regeneration…"
                      className="min-h-[80px] text-sm resize-none border-red-200"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    {loading
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <CheckCircle className="w-3.5 h-3.5" />}
                    Approve & Publish
                  </Button>

                  {!showReject ? (
                    <Button
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-200"
                      onClick={() => setShowReject(true)}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      className="gap-1.5"
                      onClick={handleReject}
                      disabled={loading || !rejectNote}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Confirm Reject & Regenerate
                    </Button>
                  )}

                  <Button variant="ghost" className="gap-1.5 text-xs" size="sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    Re-generate
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
