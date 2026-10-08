#!/usr/bin/env node
/** Read-only inventory: canonical construction app, legacy checkout states,
 * and remote branch differences. Never checks out, commits, merges or deletes. */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const canonical = resolve(process.cwd())
const home = process.env.HOME || '/home/administrator'
const sourceDirs = [
  canonical,
  join(home, 'audit-repos/cortexbuildpro.com'),
  join(home, 'audit-repos/management'),
  join(home, 'workspace/agent-os'),
  join(home, 'workspace/bot'),
  join(home, 'nexusos'),
  join(home, 'video-lab/Facelessvideogen'),
  join(home, 'video-lab/viral-shorts-studio'),
]

function git(dir, ...args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 10000 })
  return r.status === 0 ? r.stdout.trimEnd() : null
}
function lines(s) { return s ? s.split('\n').filter(Boolean) : [] }
function auditRepo(dir) {
  if (!existsSync(dir) || git(dir, 'rev-parse', '--is-inside-work-tree') !== 'true')
    return { name: basename(dir), available: false }
  const branch = git(dir, 'branch', '--show-current')
  const status = git(dir, 'status', '--porcelain=v1', '--untracked-files=all')
  const tracked = git(dir, 'ls-files')
  const stash = git(dir, 'stash', 'list')
  return {
    name: basename(dir), available: true, branch,
    head: git(dir, 'rev-parse', '--short', 'HEAD'),
    trackedFiles: lines(tracked).length,
    modifiedOrUntrackedFiles: lines(status).length,
    stashes: lines(stash).length,
  }
}
const branches = lines(git(canonical, 'for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'))
  .filter(b => b !== 'origin' && b !== 'origin/main' && b !== 'origin/HEAD')
const remoteBranches = branches.map(branch => {
  const ancestor = git(canonical, 'merge-base', 'origin/main', branch)
  if (!ancestor) return { branch, unrelatedHistory: true, mergeAutomatically: false }
  const originalChanges = lines(git(canonical, 'diff', '--name-only', ancestor, branch))
  const differentPaths = originalChanges.filter(file =>
    git(canonical, 'rev-parse', `origin/main:${file}`) !== git(canonical, 'rev-parse', `${branch}:${file}`))
  return {
    branch, unrelatedHistory: false,
    originalChangedFiles: originalChanges.length,
    stillDifferentFiles: differentPaths.length,
    // A squash merge changes commit ancestry. Changed files must be reviewed
    // for semantic supersession; a difference is NOT automatically unmerged.
    pathsToReview: differentPaths.slice(0, 30),
  }
})
const summary = {
  generatedAt: new Date().toISOString(),
  canonical: auditRepo(canonical),
  sources: sourceDirs.slice(1).map(auditRepo),
  remoteBranches,
  rules: [
    'Inventory is read-only and cannot delete or merge',
    'Do not merge unrelated git histories or overwrite local modifications',
    'Do not import different authentication or tenant databases into Cortex Construct',
    'Only delete legacy repositories after verified functional parity and recoverable backups',
  ],
}
console.log(JSON.stringify(summary, null, 2))
