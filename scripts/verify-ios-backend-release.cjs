'use strict'

/** Fail-closed TestFlight release gate: the exact source commit must have a
 * successful production deployment AND its live backend must be healthy.
 * A signed IPA can otherwise ship UI functionality unsupported by the server.
 */
async function verifyBackendRelease({
  repo,
  sha,
  token,
  fetchImpl = fetch,
  apiUrl = 'https://cortexbuildpro.tech',
}) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo || '')) throw new Error('Invalid GitHub repository')
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid release SHA')
  if (!token) throw new Error('GitHub actions read token missing')

  const url = `https://api.github.com/repos/${repo}/actions/workflows/deploy-vps.yml/runs?head_sha=${sha}&per_page=50`
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'cortexx-ios-release-gate',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`Could not verify backend deployment status (HTTP ${response.status})`)
  const payload = await response.json()
  const runs = (Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [])
    .filter(run => run.head_sha === sha)
    .sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0) || (b.id || 0) - (a.id || 0))
  const latest = runs[0]
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error('The exact mobile source commit has no successful latest backend deployment; refusing TestFlight release')
  }

  const health = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/api/health`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!health.ok) throw new Error(`Production backend health failed (HTTP ${health.status})`)
  const state = await health.json()
  if (state?.status !== 'ok' || state?.checks?.database?.ok !== true || state?.checks?.app?.ok !== true) {
    throw new Error('Production backend did not pass database and app health checks')
  }
  return { sha, deployedRunId: latest.id }
}

module.exports = { verifyBackendRelease }

if (require.main === module) {
  verifyBackendRelease({
    repo: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    token: process.env.GH_TOKEN,
  }).then(result => {
    console.log(`Confirmed healthy backend deployment for ${result.sha.slice(0, 12)} (run ${result.deployedRunId})`)
  }).catch(error => {
    console.error('::error::' + error.message)
    process.exitCode = 1
  })
}
