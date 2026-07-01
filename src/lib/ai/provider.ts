/**
 * AI Provider abstraction.
 *
 * Business logic never imports OpenAI directly — it depends on this interface.
 * Swapping models, adding Anthropic, or routing to a local model is a one-file
 * change here. The NullProvider keeps the app fully functional without an API
 * key (dev, CI, tests) using deterministic stand-ins.
 */

export const EMBEDDING_DIMENSIONS = 1536

export interface AIProvider {
  readonly name: string
  /** Returns a deterministic embedding for the given text. */
  embed(text: string): Promise<number[]>
  /** Batch embed for efficiency. */
  embedMany(texts: string[]): Promise<number[][]>
  /** Free-form completion used for conversation starters / summaries. */
  complete(opts: CompletionOptions): Promise<string>
  /** Whether this provider talks to a real model (vs. deterministic fallback). */
  readonly isLive: boolean
}

export interface CompletionOptions {
  system?: string
  prompt: string
  maxTokens?: number
  temperature?: number
  /** Force JSON-mode object output when supported. */
  json?: boolean
}

// ─── OpenAI implementation ───────────────────────────────────────────────────

class OpenAIProvider implements AIProvider {
  readonly name = "openai"
  readonly isLive = true
  private client: import("openai").default | null = null
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async getClient() {
    if (!this.client) {
      const { default: OpenAI } = await import("openai")
      this.client = new OpenAI({ apiKey: this.apiKey })
    }
    return this.client
  }

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedMany([text])
    return vec ?? new Array(EMBEDDING_DIMENSIONS).fill(0)
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const client = await this.getClient()
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts.map((t) => t.slice(0, 8000)),
    })
    return res.data.map((d) => d.embedding)
  }

  async complete(opts: CompletionOptions): Promise<string> {
    const client = await this.getClient()
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 400,
      ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
        { role: "user" as const, content: opts.prompt },
      ],
    })
    return res.choices[0]?.message?.content ?? ""
  }
}

// ─── Google Gemini implementation (REST — no SDK dependency) ─────────────────

class GeminiProvider implements AIProvider {
  readonly name = "gemini"
  readonly isLive = true
  private readonly apiKey: string
  private readonly genModel: string
  private readonly embedModel: string
  private static readonly BASE = "https://generativelanguage.googleapis.com/v1beta"

  constructor(apiKey: string) {
    this.apiKey = apiKey
    this.genModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash"
    this.embedModel = process.env.GEMINI_EMBED_MODEL?.trim() || "gemini-embedding-001"
  }

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedMany([text])
    return vec ?? new Array(EMBEDDING_DIMENSIONS).fill(0)
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const res = await fetch(
      `${GeminiProvider.BASE}/models/${this.embedModel}:batchEmbedContents?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((t) => ({
            model: `models/${this.embedModel}`,
            content: { parts: [{ text: t.slice(0, 8000) }] },
            // Match the pgvector column width so stored vectors are consistent.
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        }),
      }
    )
    if (!res.ok) throw new Error(`Gemini embed failed: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { embeddings?: Array<{ values: number[] }> }
    return (data.embeddings ?? []).map((e) => fitDimensions(e.values))
  }

  async complete(opts: CompletionOptions): Promise<string> {
    const res = await fetch(
      `${GeminiProvider.BASE}/models/${this.genModel}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(opts.system
            ? { systemInstruction: { parts: [{ text: opts.system }] } }
            : {}),
          contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.7,
            maxOutputTokens: opts.maxTokens ?? 400,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    )
    if (!res.ok) {
      console.error(`Gemini complete failed: ${res.status} ${await res.text()}`)
      return ""
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  }
}

/** Pad or truncate an embedding to the canonical width (zeros don't affect cosine). */
function fitDimensions(vec: number[]): number[] {
  if (vec.length === EMBEDDING_DIMENSIONS) return vec
  if (vec.length > EMBEDDING_DIMENSIONS) return vec.slice(0, EMBEDDING_DIMENSIONS)
  return [...vec, ...new Array(EMBEDDING_DIMENSIONS - vec.length).fill(0)]
}

// ─── Deterministic fallback (no API key needed) ──────────────────────────────

class NullProvider implements AIProvider {
  readonly name = "null"
  readonly isLive = false

  async embed(text: string): Promise<number[]> {
    return hashEmbedding(text)
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return texts.map(hashEmbedding)
  }

  async complete(opts: CompletionOptions): Promise<string> {
    // Return empty so callers fall back to their template logic.
    void opts
    return ""
  }
}

/**
 * Cheap, deterministic embedding: hashes tokens into a fixed-width vector.
 * Captures lexical overlap well enough for dev/testing similarity ordering.
 * NOT semantically rich — replaced by real embeddings in production.
 */
function hashEmbedding(text: string): number[] {
  const vec = new Array(EMBEDDING_DIMENSIONS).fill(0)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)

  for (const token of tokens) {
    let h = 2166136261
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const idx = Math.abs(h) % EMBEDDING_DIMENSIONS
    vec[idx] += 1
  }

  // L2 normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / mag)
}

// ─── Singleton accessor ──────────────────────────────────────────────────────

let _provider: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (_provider) return _provider

  // Preference order: Gemini (free tier) → OpenAI → deterministic fallback.
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()

  if (geminiKey) {
    _provider = new GeminiProvider(geminiKey)
  } else if (openaiKey && openaiKey.startsWith("sk-")) {
    _provider = new OpenAIProvider(openaiKey)
  } else {
    _provider = new NullProvider()
  }
  return _provider
}
