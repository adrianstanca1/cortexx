const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { formatSiteDiarySummary } = require('../lib/siteDiarySummary.ts')
const page = fs.readFileSync(path.join(__dirname, '../app/site-diary/page.tsx'), 'utf8')

const facts = {
  project: { name: 'Project North' },
  summary: { hoursTotal: 24.5, peopleOnSite: 3, snagsRaised: 2, snagsClosed: 1, photosTaken: 4, documentsFiled: 2 },
  activities: [{ actorName: 'Site Foreman', action: 'completed façade section 1' }],
}

test('daily report is deterministic and includes actual site facts', () => {
  const a = formatSiteDiarySummary(facts, 'Thursday 8 October 2026')
  assert.equal(a, formatSiteDiarySummary(facts, 'Thursday 8 October 2026'))
  assert.match(a, /Project North/)
  assert.match(a, /24\.5 hours · 3 people on site/)
  assert.match(a, /2 snags raised · 1 closed/)
  assert.match(a, /4 photos · 2 documents filed/)
  assert.match(a, /Site Foreman completed façade section 1/)
  assert.doesNotMatch(a, /Weather:/)
})

test('empty activity logs stay empty instead of hallucinating progress', () => {
  const a = formatSiteDiarySummary({ ...facts, activities: [] }, '8 October 2026')
  assert.match(a, /No activity logged\./)
  assert.doesNotMatch(a, /completed façade section/)
})

test('weather is only included when supplied by the caller', () => {
  const a = formatSiteDiarySummary(facts, 'Today', { icon: '☀️', tempC: 18.5, condition: 'Sunny', windKph: 11.8, windDir: 'N', precipMm: 0 })
  assert.match(a, /Weather: ☀️ 19°C · Sunny · wind 12 km\/h N/)
  assert.doesNotMatch(a, /rain/)
})

test('web report uses the authenticated existing Site Diary data only', () => {
  assert.match(page, /fetch\(`\/api\/site-diary\?projectId=/)
  assert.match(page, /formatSiteDiarySummary\(data, niceDate/)
  assert.match(page, /navigator\.clipboard\.writeText\(reportText\)/)
  assert.match(page, /aria-label="Daily summary from project records"/)
})
