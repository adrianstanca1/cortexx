const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

test('agent termination is final and execution cleanup cannot revive terminal states', () => {
  const registry = read('agent-os/packages/runtime/src/agentRegistry.ts')
  const orchestrator = read('agent-os/packages/runtime/src/orchestrator.ts')
  assert.match(registry, /agent\.state!==["']terminated["'] \? this\.setState\(id,["']suspended["']\) : undefined/)
  assert.match(registry, /agent\.state!==["']terminated["'] \? this\.setState\(id,["']idle["']\) : undefined/)
  assert.match(orchestrator, /state===["']busy["']\).*setState\([^\n]*["']idle["']\)/)
})

test('agent spawn validation is surfaced as a client error', () => {
  const server = read('agent-os/apps/api/src/server.ts')
  const route = server.match(/if \(url\.pathname === ["']\/api\/agents["'] && req\.method === ["']POST["']\) \{[\s\S]*?return json\(res, 201, agent\);\n    \}/)
  assert.ok(route, 'POST /api/agents route missing')
  assert.match(route[0], /try \{/)
  assert.match(route[0], /return json\(res, 400, \{ error:/)
})

test('failed approved delegation is terminal when its target is unavailable', () => {
  const delegations = read('agent-os/packages/runtime/src/delegations.ts')
  assert.match(delegations, /item\.status=["']failed["'];\s*item\.error=["']Target agent unavailable["']/)
  assert.match(delegations, /delegation\.failed/)
  assert.match(delegations, /if\(item\.status!==["']pending_approval["']\) return item/)
})

test('mobile operator credentials are atomically bound to an HTTPS destination', () => {
  const mobile = read('agent-os/apps/mobile/lib/api.ts')
  const compose = read('agent-os/infra/docker-compose.yml')
  const env = read('agent-os/.env.example')
  assert.match(mobile, /CONNECTION_KEY = ["']cortex_agent_os_connection_v1["']/)
  assert.match(mobile, /Remote Agent OS connections must use HTTPS/)
  assert.match(mobile, /setItemAsync\(CONNECTION_KEY, JSON\.stringify\(record\)\)/)
  assert.match(mobile, /Publish in-memory state only after durable storage succeeds/)
  assert.match(compose, /127\.0\.0\.1:4310:4310/)
  assert.match(env, /EXPO_PUBLIC_CORTEX_URL=https:\/\//)
})
