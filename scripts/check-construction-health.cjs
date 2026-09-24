// Accept only the construction API readiness contract, not another app's 200.
const { version } = require('../package.json');
function checkHealth(value) {
  return !!value && value.status === 'ok' && value.version === version &&
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
