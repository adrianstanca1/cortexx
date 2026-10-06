import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentRegistry,
  ApprovalService,
  DelegationService,
  EventBus,
  GroupRegistry,
  MemoryStore,
  ModelRouter,
  SkillRegistry,
} from "../packages/runtime/src/index.js";
import type { ModelProvider, ModelRequest, ModelResponse } from "../packages/core/src/types.js";

class FakeProvider implements ModelProvider {
  id = "fake";
  local = true;
  async health() { return true; }
  async models() { return ["fake"]; }
  async generate(request: ModelRequest): Promise<ModelResponse> {
    return {
      text: "done:" + request.prompt,
      provider: this.id,
      model: "fake",
      local: true,
      latencyMs: 1,
    };
  }
}

function runtime() {
  const events = new EventBus();
  const agents = new AgentRegistry();
  const approvals = new ApprovalService(events);
  const memory = new MemoryStore(events);
  const models = new ModelRouter([new FakeProvider()]);
  return { events, agents, approvals, memory, models };
}

test("agent lifecycle excludes suspended agents from capability routing", () => {
  const { agents } = runtime();
  assert.ok(agents.get("researcher"));
  agents.suspend("researcher");
  assert.notEqual(agents.find("research")?.id, "researcher");
  agents.resume("researcher");
  assert.equal(agents.find("research")?.id, "researcher");
  agents.terminate("researcher");
  assert.equal(agents.resume("researcher"), undefined);
});

test("groups validate members and coordinator", () => {
  const { agents, events } = runtime();
  const groups = new GroupRegistry(agents, events);
  assert.throws(() => groups.create({ name: "Bad", members: ["missing"] }), /Unknown agent/);
  assert.throws(
    () => groups.create({ name: "Bad", members: ["researcher"], coordinator: "qa" }),
    /Coordinator/,
  );
  const group = groups.create({
    name: "Bid team",
    members: ["researcher", "tender-scout"],
    coordinator: "tender-scout",
    sharedMemory: true,
  });
  assert.equal(group.members.length, 2);
  assert.equal(groups.list().length, 1);
});

test("skills install as catalog manifests and enable capabilities", () => {
  const { agents, events } = runtime();
  const skills = new SkillRegistry(agents, events);
  const installed = skills.install("construction.tender-scout");
  skills.enable(installed.instanceId, "researcher");
  assert.ok(agents.get("researcher")?.capabilities.includes("bid-score"));
  assert.equal(skills.listInstalled()[0].state, "enabled");
  skills.disable(installed.instanceId, "researcher");
  assert.equal(skills.listInstalled()[0].state, "installed");
  assert.ok(!agents.get("researcher")?.capabilities.includes("bid-score"));
  skills.enable(installed.instanceId, "researcher");
  assert.ok(agents.get("researcher")?.capabilities.includes("bid-score"));
  assert.equal(skills.uninstall(installed.instanceId), true);
  assert.ok(!agents.get("researcher")?.capabilities.includes("bid-score"));
});

test("normal delegations execute and critical delegations require approval", async () => {
  const { agents, events, approvals, memory, models } = runtime();
  const service = new DelegationService(agents, approvals, events, memory, models);
  const normal = await service.create({
    task: "summarise supplier risk",
    fromAgent: "supervisor",
    toAgent: "procurement",
    priority: "normal",
  });
  assert.equal(normal.status, "completed");
  assert.match(normal.result || "", /done:/);

  const critical = await service.create({
    task: "prepare critical bid decision",
    fromAgent: "supervisor",
    toAgent: "tender-scout",
    priority: "critical",
  });
  assert.equal(critical.status, "pending_approval");
  assert.ok(critical.approvalId);
  const approval = approvals.decide(critical.approvalId!, "approved");
  assert.ok(approval);
  await Promise.all([
    service.applyApproval(critical.approvalId!, "approved"),
    service.applyApproval(critical.approvalId!, "approved"),
  ]);
  assert.equal(critical.status, "completed");
  assert.equal(agents.get("tender-scout")?.runsCompleted, 1);
  await service.applyApproval(critical.approvalId!, "approved");
  assert.equal(agents.get("tender-scout")?.runsCompleted, 1);
});
