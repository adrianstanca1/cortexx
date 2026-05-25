import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { downloadToTemp } from '@/lib/storage'
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export const dynamic = 'force-dynamic'

const execFileP = promisify(execFile)

// Resolution order:
//   1. WHISPER_BIN env (point at a custom install)
//   2. /opt/whisper.cpp/build/bin/whisper-cli  (cmake builds, current)
//   3. /opt/whisper.cpp/main                   (legacy make builds)
const WHISPER_CANDIDATES = [
  process.env.WHISPER_BIN,
  '/opt/whisper.cpp/build/bin/whisper-cli',
  '/opt/whisper.cpp/main',
].filter((p): p is string => !!p)

const WHISPER_MODEL =
  process.env.WHISPER_MODEL ||
  '/opt/whisper.cpp/models/ggml-base.en.bin'

const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'

// Cap input size so a malicious / mis-configured client can't tie up the
// transcription pipeline. 25 MB matches the upload cap in /api/uploads.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const TRANSCRIBE_TIMEOUT_MS = 90_000

function findWhisper(): string | null {
  for (const p of WHISPER_CANDIDATES) {
    if (existsSync(p)) return p
  }
  return null
}

function notInstalled(): NextResponse {
  return NextResponse.json(
    {
      error: 'whisper.cpp is not installed on this server.',
      code: 'WHISPER_UNAVAILABLE',
      hint: 'Install with: git clone https://github.com/ggerganov/whisper.cpp /opt/whisper.cpp && cd /opt/whisper.cpp && cmake -B build && cmake --build build -j2 && bash ./models/download-ggml-model.sh base.en',
    },
    { status: 503 }
  )
}

/**
 * Convert a webm/ogg/m4a etc. audio blob to 16kHz mono PCM WAV (the format
 * whisper.cpp wants). Returns the path to the WAV file.
 */
async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  await execFileP(FFMPEG_BIN, [
    '-y',                // overwrite output
    '-i', inputPath,
    '-ar', '16000',      // 16 kHz sample rate
    '-ac', '1',          // mono
    '-c:a', 'pcm_s16le', // 16-bit signed PCM
    outputPath,
  ], { timeout: TRANSCRIBE_TIMEOUT_MS })
}

interface WhisperResult {
  text: string
  segments?: Array<{ start: number; end: number; text: string }>
}

async function runWhisper(wavPath: string, binPath: string): Promise<WhisperResult> {
  // -of <prefix>  emits <prefix>.json (with -oj). Use a sibling path of the wav.
  const outBase = wavPath.replace(/\.wav$/, '')
  await execFileP(
    binPath,
    [
      '-m', WHISPER_MODEL,
      '-f', wavPath,
      '-oj',           // output JSON
      '-of', outBase,
      '-l', 'en',      // English (we ship the .en model)
      '-nt',           // no per-line timestamps in default stdout
      '-t', '4',       // worker threads
    ],
    { timeout: TRANSCRIBE_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }
  )
  const jsonPath = `${outBase}.json`
  if (!existsSync(jsonPath)) {
    throw new Error('whisper produced no JSON output')
  }
  const raw = readFileSync(jsonPath, 'utf8')
  const parsed = JSON.parse(raw) as {
    transcription?: Array<{ text: string; offsets?: { from: number; to: number } }>
  }
  const segments = (parsed.transcription || []).map(s => ({
    start: (s.offsets?.from ?? 0) / 1000,
    end: (s.offsets?.to ?? 0) / 1000,
    text: s.text.trim(),
  }))
  const text = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
  return { text, segments }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  const binPath = findWhisper()
  if (!binPath) return notInstalled()

  let body: { url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = String(body.url || '').trim()
  if (!url) return NextResponse.json({ error: 'Missing audio URL' }, { status: 400 })

  // Only accept same-origin upload URLs — prevents SSRF via /api/transcribe.
  if (!/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(url)) {
    return NextResponse.json({ error: 'Invalid upload URL — must be /api/uploads/<filename>' }, { status: 400 })
  }

  // Resolve the audio bytes via the storage adapter — works for either
  // local-disk or S3 backend. Caller is responsible for cleanup.
  const filename = url.replace(/^\/api\/uploads\//, '')
  const dl = await downloadToTemp(filename)
  if (!dl) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
  }
  const sourcePath = dl.path

  // Cheap size check before doing anything heavy.
  const fileStat = await stat(sourcePath)
  if (fileStat.size > MAX_AUDIO_BYTES) {
    await dl.cleanup()
    return NextResponse.json({ error: `Audio too large (${Math.round(fileStat.size / 1024 / 1024)} MB, max 25 MB)` }, { status: 413 })
  }

  const work = mkdtempSync(join(tmpdir(), 'cortexx-tx-'))
  try {
    // Copy in (rather than read-into-mem) so ffmpeg can stream it.
    const inputPath = join(work, 'in' + (filename.match(/\.[a-z0-9]+$/i)?.[0] || '.webm'))
    writeFileSync(inputPath, readFileSync(sourcePath))
    const wavPath = join(work, 'audio.wav')
    await convertToWav(inputPath, wavPath)
    const result = await runWhisper(wavPath, binPath)
    if (!result.text) {
      return NextResponse.json({ error: 'Empty transcription — audio may be silent.', code: 'EMPTY_TRANSCRIPT' }, { status: 422 })
    }
    return NextResponse.json({ text: result.text, segments: result.segments, model: 'whisper.cpp:base.en' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Transcription failed'
    // Surface common failure modes with clearer codes.
    if (/timeout|ETIMEDOUT/i.test(msg)) {
      return NextResponse.json({ error: 'Transcription timed out (>90s)', code: 'TRANSCRIBE_TIMEOUT' }, { status: 504 })
    }
    if (/ENOENT.*ffmpeg/i.test(msg) || /ffmpeg.*ENOENT/i.test(msg)) {
      return NextResponse.json({ error: 'ffmpeg is not installed on this server', code: 'FFMPEG_UNAVAILABLE' }, { status: 503 })
    }
    return NextResponse.json({ error: msg, code: 'TRANSCRIBE_FAILED' }, { status: 502 })
  } finally {
    rmSync(work, { recursive: true, force: true })
    await dl.cleanup()
  }
}
