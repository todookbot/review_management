import {
  ComprehendClient,
  DetectSentimentCommand,
  DetectKeyPhrasesCommand,
  DetectEntitiesCommand,
  DetectDominantLanguageCommand,
  type SentimentType,
  type LanguageCode,
} from "@aws-sdk/client-comprehend"

export const comprehendClient = new ComprehendClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export interface ComprehendAnalysis {
  language:   string
  sentiment:  SentimentType
  sentimentScores: {
    positive: number
    negative: number
    neutral:  number
    mixed:    number
  }
  keyPhrases: Array<{ text: string; score: number }>
  entities:   Array<{ text: string; type: string; score: number }>
}

/**
 * Run full Comprehend NLP analysis on a review body.
 * Falls back to "en" if language detection fails.
 */
export async function analyzeReview(text: string): Promise<ComprehendAnalysis> {
  // Comprehend has a 5000 byte limit — truncate safely
  const safeText = text.slice(0, 4900)

  // 1. Detect language
  let language = "en"
  try {
    const langResult = await comprehendClient.send(
      new DetectDominantLanguageCommand({ Text: safeText }),
    )
    language = langResult.Languages?.[0]?.LanguageCode ?? "en"
  } catch (_) {}

  // Comprehend supports limited languages for full analysis
  const supportedLangs: LanguageCode[] = ["en", "es", "fr", "de", "it", "pt", "ar", "hi", "ja", "ko", "zh"]
  const analysisLang: LanguageCode = (supportedLangs.includes(language as LanguageCode) ? language : "en") as LanguageCode

  // 2. Run sentiment, key phrases, entities in parallel
  const [sentimentResult, keyPhrasesResult, entitiesResult] = await Promise.all([
    comprehendClient.send(
      new DetectSentimentCommand({ Text: safeText, LanguageCode: analysisLang }),
    ),
    comprehendClient.send(
      new DetectKeyPhrasesCommand({ Text: safeText, LanguageCode: analysisLang }),
    ),
    comprehendClient.send(
      new DetectEntitiesCommand({ Text: safeText, LanguageCode: analysisLang }),
    ),
  ])

  return {
    language,
    sentiment: sentimentResult.Sentiment ?? "NEUTRAL",
    sentimentScores: {
      positive: sentimentResult.SentimentScore?.Positive ?? 0,
      negative: sentimentResult.SentimentScore?.Negative ?? 0,
      neutral:  sentimentResult.SentimentScore?.Neutral  ?? 0,
      mixed:    sentimentResult.SentimentScore?.Mixed    ?? 0,
    },
    keyPhrases: (keyPhrasesResult.KeyPhrases ?? []).map(kp => ({
      text:  kp.Text ?? "",
      score: kp.Score ?? 0,
    })),
    entities: (entitiesResult.Entities ?? []).map(e => ({
      text:  e.Text ?? "",
      type:  e.Type ?? "OTHER",
      score: e.Score ?? 0,
    })),
  }
}
