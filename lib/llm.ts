/**
 * Local-LLM client (Ollama-compatible).
 *
 * Talks to an Ollama server over its REST API. By default points at
 * http://localhost:11434 — the standard Ollama port. Override via
 * the OLLAMA_BASE_URL + OLLAMA_MODEL env vars.
 *
 * To set up:
 *   curl -fsSL https://ollama.com/install.sh | sh
 *   ollama pull llama3.2:3b   # or qwen2.5:3b, phi3, mistral, etc.
 *   ollama serve              # if not auto-started
 *
 * The /api/ask route uses this. If Ollama isn't running, the caller
 * gets a clean 503 with a helpful message — no half-baked fallback.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b'

const REQUEST_TIMEOUT_MS = 60_000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmResponse {
  content: string
  model: string
  totalDurationMs?: number
  evalCount?: number
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmUnavailableError'
  }
}

/**
 * Call the local LLM with a chat-style message list. Returns the
 * assistant's reply. Throws LlmUnavailableError if Ollama can't be
 * reached (caller maps to 503).
 */
export async function chat(messages: ChatMessage[]): Promise<LlmResponse> {
  const url = `${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LlmUnavailableError(`Local LLM timed out after ${REQUEST_TIMEOUT_MS / 1000}s. The model may be too large or the server is busy.`)
    }
    throw new LlmUnavailableError(
      `Cannot reach Ollama at ${OLLAMA_BASE_URL}. Is it running? Install: curl -fsSL https://ollama.com/install.sh | sh, then pull a model: ollama pull ${OLLAMA_MODEL}`
    )
  }
  clearTimeout(timeout)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 404 && text.includes('model')) {
      throw new LlmUnavailableError(`Model "${OLLAMA_MODEL}" not installed. Run: ollama pull ${OLLAMA_MODEL}`)
    }
    throw new LlmUnavailableError(`Ollama returned HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    message?: { role: string; content: string }
    model?: string
    total_duration?: number
    eval_count?: number
  }
  const content = data.message?.content || ''
  if (!content) throw new LlmUnavailableError('Ollama returned an empty response.')

  return {
    content,
    model: data.model || OLLAMA_MODEL,
    totalDurationMs: data.total_duration ? Math.round(data.total_duration / 1_000_000) : undefined,
    evalCount: data.eval_count,
  }
}

export function buildSystemPrompt(context: {
  activeProjectCount: number
  openSnagCount: number
  pendingTimesheetCount: number
  recentActivity: string[]
  projectNames: string[]
}): string {
  const lines = [
    'You are Cortex, the AI assistant inside Cortexx — a construction-management app for UK SME contractors.',
    'You are concise, practical, and grounded in UK construction practice (CSCS, CIS, RAMS, HSE).',
    'Refuse to invent data. If you do not know something about the user\'s workspace, say so and suggest which screen they can check.',
    '',
    'Current workspace context:',
    `- Active projects: ${context.activeProjectCount}${context.projectNames.length > 0 ? ` (${context.projectNames.slice(0, 5).join(', ')}${context.projectNames.length > 5 ? '…' : ''})` : ''}`,
    `- Open snags: ${context.openSnagCount}`,
    `- Pending timesheet entries: ${context.pendingTimesheetCount}`,
  ]
  if (context.recentActivity.length > 0) {
    lines.push('', 'Recent activity (most recent first):')
    for (const a of context.recentActivity.slice(0, 5)) lines.push(`- ${a}`)
  }
  return lines.join('\n')
}

export const LLM_CONFIG = {
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  timeoutMs: REQUEST_TIMEOUT_MS,
}
