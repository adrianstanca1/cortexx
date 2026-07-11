import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/requireAuth'

export const dynamic = 'force-dynamic'

// Server-side cache: postcode → { fetchedAt, payload }. wttr.in is generous
// but we still don't want every dashboard load to hit it.
const cache = new Map<string, { fetchedAt: number; payload: WeatherPayload }>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min — site weather doesn't shift faster

interface WeatherPayload {
  location: string
  observedAt: string
  tempC: number
  feelsLikeC: number
  condition: string
  humidity: number
  windKph: number
  windDir: string
  precipMm: number
  icon: string
}

const CONDITION_ICON: Record<string, string> = {
  sunny: '☀️',
  clear: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  overcast: '☁️',
  mist: '🌫️',
  fog: '🌫️',
  rain: '🌧️',
  drizzle: '🌦️',
  shower: '🌦️',
  snow: '❄️',
  sleet: '🌨️',
  thunder: '⛈️',
  hail: '🌨️',
}

function pickIcon(desc: string): string {
  const lc = desc.toLowerCase()
  for (const [key, icon] of Object.entries(CONDITION_ICON)) {
    if (lc.includes(key)) return icon
  }
  return '🌤️'
}

interface WttrCurrent {
  temp_C?: string
  FeelsLikeC?: string
  humidity?: string
  windspeedKmph?: string
  winddir16Point?: string
  precipMM?: string
  weatherDesc?: Array<{ value: string }>
  observation_time?: string
}

interface WttrResponse {
  current_condition?: WttrCurrent[]
  nearest_area?: Array<{
    areaName?: Array<{ value: string }>
    country?: Array<{ value: string }>
  }>
}

function normalize(location: string, wttr: WttrResponse): WeatherPayload {
  const cur = wttr.current_condition?.[0] || {}
  const condition = cur.weatherDesc?.[0]?.value || 'Unknown'
  const area = wttr.nearest_area?.[0]
  const locDisplay = area?.areaName?.[0]?.value
    ? `${area.areaName[0].value}${area.country?.[0]?.value ? `, ${area.country[0].value}` : ''}`
    : location
  return {
    location: locDisplay,
    observedAt: new Date().toISOString(),
    tempC: Number(cur.temp_C ?? 0) || 0,
    feelsLikeC: Number(cur.FeelsLikeC ?? 0) || 0,
    condition,
    humidity: Number(cur.humidity ?? 0) || 0,
    windKph: Number(cur.windspeedKmph ?? 0) || 0,
    windDir: cur.winddir16Point || '',
    precipMm: Number(cur.precipMM ?? 0) || 0,
    icon: pickIcon(condition),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const sp = req.nextUrl.searchParams
  const postcode = String(sp.get('postcode') || '').trim().replace(/\s+/g, '').toUpperCase()
  const city = String(sp.get('city') || '').trim()
  const location = postcode || city
  if (!location || location.length > 40 || !/^[A-Z0-9, .'-]+$/i.test(location)) {
    return NextResponse.json({ error: 'Provide ?postcode= or ?city= (alphanumerics only)' }, { status: 400 })
  }

  const cached = cache.get(location)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.payload, cached: true })
  }

  // wttr.in serves a JSON API at /<location>?format=j1. No API key, free.
  // Bound the request so a hung upstream doesn't tie up the route.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const upstream = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Cortexx/1.0 (site-diary weather)' },
    })
    clearTimeout(timeout)
    if (!upstream.ok) {
      return NextResponse.json({ error: `Weather upstream returned ${upstream.status}` }, { status: 502 })
    }
    const data = (await upstream.json()) as WttrResponse
    const payload = normalize(location, data)
    cache.set(location, { fetchedAt: Date.now(), payload })
    if (cache.size > 1000) {
      const now = Date.now()
      for (const [k, v] of cache.entries()) {
        if (now - v.fetchedAt > CACHE_TTL_MS) cache.delete(k)
      }
      if (cache.size > 1000) {
        const first = cache.keys().next().value
        if (first) cache.delete(first)
      }
    }
    return NextResponse.json({ ...payload, cached: false })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Weather upstream timed out' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 502 })
  }
}
