// Accept only the construction API readiness contract, not another app's 200.
// Deployment verification compares the version too; the scheduled monitor can run
// from a default branch that is ahead of the deployed release, so it opts out.
const { version } = require('../package.json');
function checkHealth(value) {
  const requireVersion = process.env.CHECK_HEALTH_IGNORE_VERSION !== '1';
  return !!value && value.status === 'ok' && (!requireVersion || value.version === version) &&
    value.service === 'cortexbuild-construction' && value.checks?.database?.ok === true &&
    Number.isFinite(Date.parse(value.timestamp));
}
module.exports = { checkHealth };
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    let ok = false;
    try { ok = checkHealth(JSON.parse(input)); } catch { /* invalid readiness response */ }
    if (!ok) {
      console.error('Expected a ready CortexBuild construction API with version ' + version + '; deployment verification failed.');
      process.exitCode = 1;
    }
  });
}
