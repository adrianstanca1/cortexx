const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const page = fs.readFileSync(path.join(root, 'app/field/handover/page.tsx'), 'utf8')

// Regression cover for PR #264, which had no dedicated test. The behaviour
// below is what a site supervisor depends on between shifts: no handover note
// is silently dropped, a slow response cannot overwrite a newer one, and a
// failed acceptance attempt is reported rather than discarded.

test('handover page renders every recorded note field, not just the summary', () => {
  for (const [field, label] of [
    ['summary', 'Summary'],
    ['completedWork', 'Completed'],
    ['nextShiftPlan', 'Next shift'],
    ['safetyNotes', 'Safety notes'],
    ['qualityNotes', 'Quality notes'],
    ['materialsNotes', 'Materials / deliveries'],
    ['plantNotes', 'Plant / access'],
  ]) {
    assert.match(
      page,
      new RegExp(`\\{\\s*item\\.${field}\\s*&&\\s*<FieldBlock label="${label}"`),
      `handover card must display item.${field}`
    )
  }
  // Open items are the actionable part of a handover and must survive too.
  assert.match(page, /item\.openItems \|\| \[\]/)
  assert.match(page, /Open items/)
})

test('handover page sends every note field to the API on create', () => {
  const create = page.slice(page.indexOf('const create = async'), page.indexOf('const accept = async'))
  for (const field of [
    'summary', 'completedWork', 'nextShiftPlan',
    'safetyNotes', 'qualityNotes', 'materialsNotes', 'plantNotes',
  ]) {
    assert.match(create, new RegExp(`${field}:\\s*form\\.${field}\\.trim\\(\\) \\|\\| null`), `create must persist form.${field}`)
  }
  assert.match(create, /openItems/)
})

test('a superseded handover response cannot overwrite the current selection', () => {
  // Every load takes a version token and only the newest one may commit state.
  assert.match(page, /const version = \+\+requestVersion\.current/)
  assert.match(page, /if \(version !== requestVersion\.current\) return/)
  assert.match(page, /if \(version === requestVersion\.current\) setLoading\(false\)/)
  // Switching projects invalidates the in-flight request instead of letting it land.
  assert.match(page, /return \(\) => \{ requests\.current\+\+ \}/)
  // The previous project's rows are cleared so they cannot linger on screen.
  assert.match(page, /setItems\(\[\]\)/)
})

test('a failed handover request is surfaced to the user', () => {
  // Errors must reach the page rather than being swallowed by a bare reload.
  assert.match(page, /Failed to load handovers/)
  assert.match(page, /Failed to load projects/)
  assert.match(page, /if \(!res\.ok\) throw new Error/)
  // The message container is announced, not rendered silently.
  assert.match(page, /role="alert"/)
})

test('acceptance is guarded against double submission and reports failure', () => {
  assert.match(page, /if \(acceptancePending\.current\) return/)
  assert.match(page, /acceptancePending\.current = false/)
  // Cancelling the prompt must not send a request.
  assert.match(page, /if \(acceptedBy === null\) return/)
  assert.match(page, /Failed to accept handover/)
  // Only one accept button is actionable at a time.
  assert.match(page, /disabled=\{acceptingId !== null\}/)
  // And the project selector is frozen while a mutation is in flight.
  assert.match(page, /disabled=\{saving \|\| acceptingId !== null\}/)
})

test('handover creation is blocked without a selected project', () => {
  assert.match(page, /if \(!projectId \|\| saving\) return/)
  assert.match(page, /disabled=\{saving \|\| !projectId\}/)
})