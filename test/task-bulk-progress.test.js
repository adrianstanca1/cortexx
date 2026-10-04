const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const bulk = fs.readFileSync(path.join(root, 'app/api/tasks/bulk/route.ts'), 'utf8')
const progress = fs.readFileSync(path.join(root, 'lib/task-progress.ts'), 'utf8')

// The single-task routes gained programme-ownership protection in PR #271, but
// the bulk route was left writing project progress unconditionally. A bulk
// complete/reopen/delete over a programme-owned project's tasks would therefore
// overwrite progress that is actually derived from programme activities.

test('single task mutations leave programme-owned progress alone', () => {
  assert.match(progress, /programmeActivities:\s*\{\s*none:\s*\{\s*\}\s*\}/)
})

test('bulk task mutation must not recompute progress for programme-owned projects', () => {
  // The guard is expressed once and spread into both writes.
  assert.match(bulk, /const taskOwnedProjects = \{[\s\S]{0,80}programmeActivities:\s*\{\s*none:\s*\{\s*\}\s*\}/)
  const spreads = bulk.match(/\.\.\.taskOwnedProjects/g) || []
  assert.equal(spreads.length, 2, 'both the recompute and the zeroing write need the guard')
})

test('bulk progress writes use updateMany so the relation filter is legal', () => {
  // project.update takes a unique `where`, which cannot carry a relation
  // filter, so it would throw Prisma error P2023 at runtime.
  assert.doesNotMatch(bulk, /prisma\.project\.update\(/)
  assert.match(bulk, /prisma\.project\.updateMany\(\{\s*\n\s*where: \{ id: projectId, \.\.\.taskOwnedProjects \}/)
})

test('bulk progress block does not shadow the updated count it returns', () => {
  // `const updated = new Set(...)` inside the block used to shadow the outer
  // `let updated` that the response reports. Shadowing is legal but ESLint's
  // no-shadow catches it, so assert the block stays clear of the name.
  const block = bulk.slice(bulk.indexOf('Recompute progress'), bulk.indexOf('NextResponse.json({ updated'))
  assert.doesNotMatch(block, /\bupdated\b(?!\s*[:,}])/m)
})