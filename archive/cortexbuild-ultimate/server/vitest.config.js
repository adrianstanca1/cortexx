const { defineConfig } = require('vitest/config');

const exclude = [
  '**/node_modules/**',
  'test/unified-ai-v2.test.js',
  'test/condition-evaluator.simple.test.js',
  'test/workflow-runner.simple.test.js',
];

// Sandbox cannot bind to ports — skip integration tests that use supertest
if (process.env.CODEX_SANDBOX_NETWORK_DISABLED) {
  exclude.push('test/push-tokens.test.js');
  exclude.push('test/billing-webhook.test.js');
}

// otplib may not be installed in all environments — skip MFA tests if missing
try {
  require('otplib');
} catch {
  exclude.push('test/mfa.test.js');
}

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.js'],
    exclude,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['lib/**/*.js', 'routes/**/*.js'],
    },
    testTimeout: 10000,
  },
});
