"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { Star, TrendingUp, TrendingDown, MessageSquare, Clock, AlertTriangle, CheckCircle } from "lucide-react"

// ── Mock data ─────────────────────────────────────────────────────────────────

const ratingTrend = [
  { month: "Nov", avg: 3.8, total: 142 },
  { month: "Dec", avg: 4.0, total: 189 },
  { month: "Jan", avg: 3.6, total: 201 },
  { month: "Feb", avg: 4.2, total: 176 },
  { month: "Mar", avg: 4.4, total: 218 },
  { month: "Apr", avg: 4.1, total: 234 },
]

const sentimentData = [
  { name: "Positive", value: 58, color: "#22c55e" },
  { name: "Neutral",  value: 24, color: "#94a3b8" },
  { name: "Negative", value: 18, color: "#ef4444" },
]

const platformData = [
  { platform: "Google",     reviews: 312, avgRating: 4.2 },
  { platform: "Yelp",       reviews: 187, avgRating: 3.8 },
  { platform: "TripAdvisor",reviews: 143, avgRating: 4.5 },
  { platform: "Amazon",     reviews: 98,  avgRating: 4.0 },
  { platform: "App Store",  reviews: 76,  avgRating: 4.3 },
]

const responseRateData = [
  { month: "Nov", rate: 42 },
  { month: "Dec", rate: 58 },
  { month: "Jan", rate: 51 },
  { month: "Feb", rate: 67 },
  { month: "Mar", rate: 74 },
  { month: "Apr", rate: 81 },
]

const topTopics = [
  { topic: "service_speed",   count: 89,  sentiment: "negative" },
  { topic: "food_quality",    count: 134, sentiment: "positive" },
  { topic: "staff_behavior",  count: 67,  sentiment: "positive" },
  { topic: "price_value",     count: 54,  sentiment: "neutral"  },
  { topic: "cleanliness",     count: 41,  sentiment: "negative" },
  { topic: "ambiance",        count: 78,  sentiment: "positive" },
]

const STAT_CARDS = [
  {
    title:  "Total Reviews",
    value:  "1,247",
    delta:  "+12%",
    up:     true,
    icon:   Star,
    color:  "text-yellow-500",
  },
  {
    title:  "Avg Rating",
    value:  "4.1★",
    delta:  "+0.3",
    up:     true,
    icon:   TrendingUp,
    color:  "text-green-500",
  },
  {
    title:  "Response Rate",
    value:  "81%",
    delta:  "+7%",
    up:     true,
    icon:   MessageSquare,
    color:  "text-blue-500",
  },
  {
    title:  "Avg Response Time",
    value:  "2.4h",
    delta:  "-1.2h",
    up:     true,
    icon:   Clock,
    color:  "text-purple-500",
  },
  {
    title:  "Urgent Reviews",
    value:  "8",
    delta:  "-3",
    up:     true,
    icon:   AlertTriangle,
    color:  "text-red-500",
  },
  {
    title:  "Drafts Pending",
    value:  "5",
    delta:  "",
    up:     true,
    icon:   CheckCircle,
    color:  "text-amber-500",
  },
]

function sentimentColor(s: string) {
  return s === "positive" ? "bg-green-100 text-green-700"
    : s === "negative" ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-700"
}

export default function AnalyticsDashboard() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAT_CARDS.map(({ title, value, delta, up, icon: Icon, color }) => (
          <Card key={title} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            {delta && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-green-600" : "text-red-500"}`}>
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {delta} vs last month
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rating trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rating Trend (6 months)</CardTitle>
            <CardDescription className="text-xs">Average star rating over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={ratingTrend}>
                <defs>
                  <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: unknown) => [`${(val as number).toFixed(1)}★`, "Avg Rating"]}
                />
                <Area
                  type="monotone"
                  dataKey="avg"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#ratingGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sentiment pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sentiment Breakdown</CardTitle>
            <CardDescription className="text-xs">All platforms combined</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }) => `${value}%`}
                  labelLine={false}
                >
                  {sentimentData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: unknown) => [`${val}%`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center">
              {sentimentData.map(({ name, color }) => (
                <div key={name} className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform + Response Rate + Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By platform */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Reviews by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={platformData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="platform" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip />
                <Bar dataKey="reviews" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response rate trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Response Rate (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={responseRateData}>
                <defs>
                  <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, "Response Rate"]} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#respGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top topics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top NLP Topics</CardTitle>
            <CardDescription className="text-xs">Most mentioned themes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTopics.map(({ topic, count, sentiment }) => (
              <div key={topic} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColor(sentiment)}`}>
                    {topic.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
