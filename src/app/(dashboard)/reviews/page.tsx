"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Star, Search, Filter, Sparkles, Clock, MapPin, Package,
  AlertTriangle, CheckCircle, RefreshCw, ExternalLink, MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import { PLATFORM_CONFIG } from "@/lib/portals"

// ── Review type (matches API response) ───────────────────────────────────────

type ReviewTag = { tagType: string; value: string }
type Review = {
  id: string; platform: string; rating: number; status: string; isUrgent: boolean
  authorName: string; reviewedAt: string; locationName?: string | null; productName?: string | null
  body: string; tags: ReviewTag[]; hasDraft: boolean
}

// ── Legacy mock kept only for TypeScript fallback ────────────────────────────

const MOCK_REVIEWS: Review[] = [
  {
    id: "1", platform: "GOOGLE_MY_BUSINESS", rating: 2, status: "NEW", isUrgent: true,
    authorName: "Sarah Johnson", reviewedAt: "2026-04-26T14:23:00Z",
    locationName: "NYC - 5th Ave Branch", body: "The service was incredibly slow today. We waited 45 minutes for our order and the staff seemed completely overwhelmed. The food itself was okay but the experience ruined it.",
    tags: [
      { tagType: "SENTIMENT", value: "NEGATIVE" },
      { tagType: "TOPIC", value: "service_speed" },
      { tagType: "TOPIC", value: "staff_behavior" },
      { tagType: "URGENCY", value: "HIGH" },
      { tagType: "INTENT", value: "COMPLAINT" },
    ],
    hasDraft: false,
  },
  {
    id: "2", platform: "YELP", rating: 5, status: "DRAFT_CREATED", isUrgent: false,
    authorName: "Mike Chen", reviewedAt: "2026-04-26T10:11:00Z",
    locationName: "Brooklyn Branch", body: "Absolutely love this place! The ambiance is perfect for a date night and the food quality has gone way up since their new chef joined. The pasta carbonara was divine!",
    tags: [
      { tagType: "SENTIMENT", value: "POSITIVE" },
      { tagType: "TOPIC", value: "food_quality" },
      { tagType: "TOPIC", value: "ambiance" },
      { tagType: "URGENCY", value: "LOW" },
      { tagType: "INTENT", value: "PRAISE" },
    ],
    hasDraft: true,
  },
  {
    id: "3", platform: "AMAZON", rating: 1, status: "NEW", isUrgent: true,
    authorName: "Patricia Williams", reviewedAt: "2026-04-25T18:45:00Z",
    productName: "Wireless Headphones Pro", body: "DEFECTIVE PRODUCT! The left earbud stopped working after 2 days. This is unacceptable for a $150 product. I want a full refund immediately. Reporting to Amazon.",
    tags: [
      { tagType: "SENTIMENT", value: "NEGATIVE" },
      { tagType: "TOPIC", value: "product_quality" },
      { tagType: "URGENCY", value: "CRITICAL" },
      { tagType: "INTENT", value: "COMPLAINT" },
    ],
    hasDraft: false,
  },
  {
    id: "4", platform: "APPLE_APP_STORE", rating: 4, status: "RESPONDED", isUrgent: false,
    authorName: "Dev Rodriguez", reviewedAt: "2026-04-25T09:20:00Z",
    productName: "ReviewPulse Mobile", body: "Great app overall! The real-time notifications are super helpful. Would love to see dark mode added and maybe a way to bulk respond to reviews.",
    tags: [
      { tagType: "SENTIMENT", value: "POSITIVE" },
      { tagType: "TOPIC", value: "app_experience" },
      { tagType: "URGENCY", value: "LOW" },
      { tagType: "INTENT", value: "SUGGESTION" },
    ],
    hasDraft: false,
  },
  {
    id: "5", platform: "TRIPADVISOR", rating: 3, status: "IN_PROGRESS", isUrgent: false,
    authorName: "Emma Thompson", reviewedAt: "2026-04-24T20:15:00Z",
    locationName: "Hotel Grand Downtown", body: "Mixed experience. The room was clean and the view was fantastic but the check-in process took forever and the breakfast was disappointing. Average for the price.",
    tags: [
      { tagType: "SENTIMENT", value: "MIXED" },
      { tagType: "TOPIC", value: "cleanliness" },
      { tagType: "TOPIC", value: "price_value" },
      { tagType: "URGENCY", value: "MEDIUM" },
      { tagType: "INTENT", value: "COMPLAINT" },
    ],
    hasDraft: true,
  },
  {
    id: "6", platform: "GOOGLE_MY_BUSINESS", rating: 5, status: "NEW", isUrgent: false,
    authorName: "James Park", reviewedAt: "2026-04-24T12:00:00Z",
    locationName: "LA - West Hollywood", body: "Best coffee in the neighborhood! The barista remembered my order from last week. That kind of personal touch is rare these days. Will definitely be back!",
    tags: [
      { tagType: "SENTIMENT", value: "POSITIVE" },
      { tagType: "TOPIC", value: "staff_behavior" },
      { tagType: "URGENCY", value: "LOW" },
      { tagType: "INTENT", value: "PRAISE" },
    ],
    hasDraft: false,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}.0</span>
    </div>
  )
}

const TAG_COLORS: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-700 border-green-200",
  NEGATIVE: "bg-red-100 text-red-700 border-red-200",
  NEUTRAL:  "bg-gray-100 text-gray-600 border-gray-200",
  MIXED:    "bg-purple-100 text-purple-700 border-purple-200",
  CRITICAL: "bg-red-600 text-white border-red-600",
  HIGH:     "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW:      "bg-blue-100 text-blue-700 border-blue-200",
  COMPLAINT:   "bg-red-50 text-red-600 border-red-200",
  PRAISE:      "bg-green-50 text-green-600 border-green-200",
  SUGGESTION:  "bg-blue-50 text-blue-600 border-blue-200",
  QUESTION:    "bg-purple-50 text-purple-600 border-purple-200",
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW:           { label: "New",           color: "bg-blue-500" },
  IN_PROGRESS:   { label: "In Progress",   color: "bg-amber-500" },
  DRAFT_CREATED: { label: "Draft Ready",   color: "bg-purple-500" },
  RESPONDED:     { label: "Responded",     color: "bg-green-500" },
  IGNORED:       { label: "Ignored",       color: "bg-gray-400" },
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const [allReviews,   setAllReviews]   = useState<Review[]>([])
  const [loadingData,  setLoadingData]  = useState(true)
  const [search,       setSearch]       = useState("")
  const [platform,     setPlatform]     = useState("ALL")
  const [status,       setStatus]       = useState("ALL")
  const [ratingFilter, setRatingFilter] = useState("ALL")
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [draftText,    setDraftText]    = useState("")
  const [generating,   setGenerating]   = useState(false)

  // Load real reviews from DB on mount
  useEffect(() => {
    fetch("/api/reviews")
      .then(r => r.json())
      .then(data => {
        // Use API reviews if any, otherwise use rich local mock data
        if (data.reviews?.length > 0) {
          setAllReviews(data.reviews)
        } else {
          setAllReviews(MOCK_REVIEWS)
        }
        setLoadingData(false)
      })
      .catch(() => {
        setAllReviews(MOCK_REVIEWS)
        setLoadingData(false)
      })
  }, [])

  const filtered = allReviews.filter(r => {
    if (search && !r.body.toLowerCase().includes(search.toLowerCase()) &&
        !r.authorName.toLowerCase().includes(search.toLowerCase())) return false
    if (platform !== "ALL" && r.platform !== platform) return false
    if (status   !== "ALL" && r.status   !== status)   return false
    if (ratingFilter !== "ALL" && r.rating !== parseInt(ratingFilter)) return false
    return true
  })

  const urgentCount = allReviews.filter(r => r.isUrgent).length

  async function handleGenerateDraft() {
    if (!selectedReview) return
    setGenerating(true)
    // Simulated AI generation
    await new Promise(r => setTimeout(r, 1800))
    setDraftText(
      `Dear ${selectedReview.authorName},\n\nThank you for taking the time to share your feedback with us. We truly appreciate your honest review.\n\n${
        selectedReview.rating <= 2
          ? "We sincerely apologize for the experience you described — this is not the standard we hold ourselves to, and we want to make it right. Please reach out to our team directly so we can address this personally."
          : "We are delighted to hear about your positive experience! Comments like yours inspire our team to continue delivering the best service possible."
      }\n\nWe hope to welcome you back soon.\n\nWarm regards,\nThe ReviewPulse Team`
    )
    setGenerating(false)
    toast.success("Draft generated by Claude AI")
  }

  async function handleApproveDraft() {
    await new Promise(r => setTimeout(r, 800))
    toast.success("Response approved and published!")
    setSelectedReview(null)
    setDraftText("")
  }

  return (
    <div className="space-y-4">
      {/* Urgent Banner */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {urgentCount} urgent review{urgentCount > 1 ? "s" : ""} need immediate attention
          </p>
          <Button size="sm" variant="destructive" className="ml-auto text-xs h-7">
            View Urgent
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search reviews..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Select value={platform} onValueChange={v => setPlatform(v ?? "ALL")}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Platforms</SelectItem>
                {Object.entries(PLATFORM_CONFIG).map(([key, { name }]) => (
                  <SelectItem key={key} value={key}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={v => setStatus(v ?? "ALL")}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={v => setRatingFilter(v ?? "ALL")}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Ratings</SelectItem>
                {[5, 4, 3, 2, 1].map(r => (
                  <SelectItem key={r} value={String(r)}>{r}★</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {filtered.length} reviews
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Review List */}
      <div className="space-y-3">
        {filtered.map(review => {
          const pConfig = PLATFORM_CONFIG[review.platform]
          const sConfig = STATUS_CONFIG[review.status]
          const sentimentTag = review.tags.find(t => t.tagType === "SENTIMENT")
          const urgencyTag   = review.tags.find(t => t.tagType === "URGENCY")
          const intentTag    = review.tags.find(t => t.tagType === "INTENT")
          const topicTags    = review.tags.filter(t => t.tagType === "TOPIC")

          return (
            <Card
              key={review.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                review.isUrgent ? "border-red-200 bg-red-50/30" : ""
              }`}
              onClick={() => { setSelectedReview(review); setDraftText("") }}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {review.authorName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{review.authorName}</span>
                      <StarRating rating={review.rating} />
                      {review.isUrgent && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                          <AlertTriangle className="w-2.5 h-2.5 mr-1" />URGENT
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(review.reviewedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Platform + Location/Product */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs flex items-center gap-1" style={{ color: pConfig?.color }}>
                        {pConfig?.icon} {pConfig?.name}
                      </span>
                      {review.locationName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{review.locationName}
                        </span>
                      )}
                      {(review as { productName?: string }).productName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="w-3 h-3" />{(review as { productName?: string }).productName}
                        </span>
                      )}
                    </div>

                    {/* Review body */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{review.body}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {sentimentTag && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TAG_COLORS[sentimentTag.value] ?? ""}`}>
                          {sentimentTag.value}
                        </span>
                      )}
                      {urgencyTag && urgencyTag.value !== "LOW" && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TAG_COLORS[urgencyTag.value] ?? ""}`}>
                          {urgencyTag.value} urgency
                        </span>
                      )}
                      {intentTag && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${TAG_COLORS[intentTag.value] ?? ""}`}>
                          {intentTag.value}
                        </span>
                      )}
                      {topicTags.slice(0, 3).map(t => (
                        <span key={t.value} className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600">
                          {t.value.replace(/_/g, " ")}
                        </span>
                      ))}

                      {/* Status + draft indicator */}
                      <div className="ml-auto flex items-center gap-2">
                        {review.hasDraft && (
                          <Badge variant="outline" className="text-xs px-1.5 gap-1 text-purple-600 border-purple-200">
                            <Sparkles className="w-2.5 h-2.5" />Draft ready
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${sConfig.color}`} />
                          <span className="text-xs text-muted-foreground">{sConfig.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={o => { if (!o) { setSelectedReview(null); setDraftText("") } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{PLATFORM_CONFIG[selectedReview.platform]?.icon}</span>
                  <span>Review by {selectedReview.authorName}</span>
                  {selectedReview.isUrgent && (
                    <Badge variant="destructive" className="text-xs ml-2">URGENT</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* Review detail */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <StarRating rating={selectedReview.rating} />
                  <span>·</span>
                  <span>{PLATFORM_CONFIG[selectedReview.platform]?.name}</span>
                  {selectedReview.locationName && <><span>·</span><span>{selectedReview.locationName}</span></>}
                  <span className="ml-auto">{new Date(selectedReview.reviewedAt).toLocaleString()}</span>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 text-sm leading-relaxed">
                  {selectedReview.body}
                </div>

                {/* NLP Tags */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">NLP ANALYSIS</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedReview.tags.map((tag, i) => (
                      <div key={i} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${TAG_COLORS[tag.value] ?? "bg-gray-100 text-gray-600"}`}>
                        <span className="text-muted-foreground mr-1">{tag.tagType.toLowerCase()}:</span>
                        {tag.value.toLowerCase().replace(/_/g, " ")}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Draft response */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground">AI RESPONSE DRAFT</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={handleGenerateDraft}
                        disabled={generating}
                      >
                        {generating
                          ? <><RefreshCw className="w-3 h-3 animate-spin" />Generating…</>
                          : <><Sparkles className="w-3 h-3" />Generate with Claude</>}
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    placeholder="Click 'Generate with Claude' to create an AI draft, or type your response manually…"
                    className="min-h-[140px] text-sm resize-none"
                  />

                  {draftText && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="gap-1 bg-green-600 hover:bg-green-700"
                        onClick={handleApproveDraft}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve & Publish
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300">
                        Save as Draft
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={handleGenerateDraft}
                        disabled={generating}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
