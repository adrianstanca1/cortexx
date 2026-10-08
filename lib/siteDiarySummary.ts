/** Auditable site-diary narrative built only from actual tenant-scoped API facts.
 * No language model, cached demo data or invented work progress is involved. */
export interface SiteDiaryReportFacts {
  project: { name: string }
  summary: {
    hoursTotal: number
    peopleOnSite: number
    snagsRaised: number
    snagsClosed: number
    photosTaken: number
    documentsFiled: number
  }
  activities: Array<{ actorName: string; action: string }>
}

export function formatSiteDiarySummary(
  data: SiteDiaryReportFacts,
  dateLabel: string,
  weather?: { icon: string; tempC: number; condition: string; windKph: number; windDir: string; precipMm: number } | null,
): string {
  const sum = data.summary
  const weatherText = weather
    ? `Weather: ${weather.icon} ${Math.round(weather.tempC)}°C · ${weather.condition} · wind ${Math.round(weather.windKph)} km/h ${weather.windDir}${weather.precipMm > 0 ? ` · ${weather.precipMm.toFixed(1)}mm rain` : ''}`
    : null
  return [
    `Site Diary — ${data.project.name}`,
    dateLabel,
    ...(weatherText ? [weatherText] : []),
    '',
    `${sum.hoursTotal.toFixed(1)} hours · ${sum.peopleOnSite} people on site`,
    `${sum.snagsRaised} snag${sum.snagsRaised === 1 ? '' : 's'} raised · ${sum.snagsClosed} closed`,
    `${sum.photosTaken} photos · ${sum.documentsFiled} documents filed`,
    '',
    data.activities.length ? 'Activity log:' : 'No activity logged.',
    ...data.activities.map(activity => `  • ${activity.actorName} ${activity.action}`),
  ].join('\n')
}
