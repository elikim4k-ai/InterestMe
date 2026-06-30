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
  const apiKey = process.env.OPENAI_API_KEY
  _provider =
    apiKey && apiKey.startsWith("sk-") ? new OpenAIProvider(apiKey) : new NullProvider()
  return _provider
}
