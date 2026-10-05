import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  AgentRegistry,
  ApprovalService,
  DelegationService,
  EventBus,
  GroupRegistry,
  MemoryStore,
  ModelRouter,
  OllamaProvider,
  OpenAICompatibleProvider,
  Orchestrator,
  SkillRegistry,
  ToolRegistry,
} from "../../../packages/runtime/src/index.js";
import { promises as fs } from "node:fs";
import path from "node:path";

const events = new EventBus();
const agents = new AgentRegistry();
const approvals = new ApprovalService(events);
const memory = new MemoryStore(events);
const models = new ModelRouter([new OllamaProvider(), new OpenAICompatibleProvider()]);
const orchestrator = new Orchestrator(agents, events, memory, models);
const tools = new ToolRegistry(approvals, events);
const groups = new GroupRegistry(agents, events);
const skills = new SkillRegistry(agents, events);
const delegations = new DelegationService(agents, approvals, events, memory, models);

const PORT = Number(process.env.PORT || 4310);
const TOKEN = process.env.CORTEX_AGENT_OS_TOKEN || "";
const ALLOWED_ORIGIN = process.env.CORTEX_AGENT_OS_ORIGIN || "http://localhost:4310";
const webRoot = path.resolve(process.cwd(), "apps/web");

if (TOKEN.length < 32) {
  throw new Error("CORTEX_AGENT_OS_TOKEN must be at least 32 characters");
}

function cors() {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    vary: "Origin",
  };
}

function json(res: any, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json", ...cors() });
  res.end(JSON.stringify(data));
}

async function body(req: any) {
  let source = "";
  for await (const chunk of req) {
    source += chunk;
    if (source.length > 512_000) throw new Error("Request body too large");
  }
  return source ? JSON.parse(source) : {};
}

function bearer(req: any) {
  const raw = String(req.headers.authorization || "");
  return raw.startsWith("Bearer ") ? raw.slice(7) : "";
}

function authorized(req: any) {
  const supplied = Buffer.from(bearer(req));
  const expected = Buffer.from(TOKEN);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function idFrom(pathname: string, prefix: string) {
  const raw = pathname.slice(prefix.length).split("/")[0];
  try { return decodeURIComponent(raw); } catch { return ""; }
}

const server = createServer(async (req: any, res: any) => {
  try {
    const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors());
      return res.end();
    }

    if (url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        service: "cortex-agent-os",
        time: new Date().toISOString(),
        missions: orchestrator.missions.size,
      });
    }

    if (url.pathname.startsWith("/api/") && !authorized(req)) {
      return json(res, 401, { error: "Unauthorized" });
    }

    if (url.pathname === "/api/status") {
      return json(res, 200, {
        agents: agents.list().filter(agent => agent.state !== "terminated").length,
        missions: orchestrator.listMissions().length,
        groups: groups.list().length,
        installedSkills: skills.listInstalled().length,
        delegations: delegations.list().length,
        pendingApprovals: approvals.list("pending").length,
        models: await models.status(),
      });
    }

    if (url.pathname === "/api/agents" && req.method === "GET") {
      return json(res, 200, agents.list());
    }

    if (url.pathname === "/api/agents" && req.method === "POST") {
      const input = await body(req);
      const agent = agents.spawn({
        id: input.id ? String(input.id) : undefined,
        name: String(input.name || ""),
        role: String(input.role || ""),
        model: input.model ? String(input.model) : undefined,
        capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String) : [],
      });
      events.publish("agent.registered", { agentId: agent.id, payload: { role: agent.role } });
      return json(res, 201, agent);
    }

    if (url.pathname.startsWith("/api/agents/")) {
      const id = idFrom(url.pathname, "/api/agents/");
      const prefix = "/api/agents/" + encodeURIComponent(id);
      const suffix = url.pathname.slice(prefix.length);
      const agent = agents.get(id);
      if (!agent) return json(res, 404, { error: "Agent not found" });

      if (req.method === "GET" && !suffix) return json(res, 200, agent);
      if (req.method === "DELETE" && !suffix) {
        agents.terminate(id);
        events.publish("agent.state_changed", { agentId: id, payload: { state: "terminated" } });
        return json(res, 200, agent);
      }
      if (req.method === "POST" && suffix === "/suspend") {
        agents.suspend(id);
        events.publish("agent.state_changed", { agentId: id, payload: { state: "suspended" } });
        return json(res, 200, agent);
      }
      if (req.method === "POST" && suffix === "/resume") {
        const resumed = agents.resume(id);
        if (!resumed) return json(res, 409, { error: "Terminated agents cannot resume" });
        events.publish("agent.state_changed", { agentId: id, payload: { state: "idle" } });
        return json(res, 200, resumed);
      }
      if (req.method === "GET" && suffix === "/skills") {
        return json(res, 200, skills.listInstalled().filter((item: any) => item.enabledForAgents.includes(id)));
      }
    }

    if (url.pathname === "/api/groups" && req.method === "GET") {
      return json(res, 200, groups.list());
    }

    if (url.pathname === "/api/groups" && req.method === "POST") {
      const input = await body(req);
      try {
        return json(res, 201, groups.create({
          id: input.id ? String(input.id) : undefined,
          name: String(input.name || ""),
          description: input.description ? String(input.description) : "",
          members: Array.isArray(input.members) ? input.members.map(String) : [],
          coordinator: input.coordinator ? String(input.coordinator) : undefined,
          sharedMemory: input.sharedMemory !== false,
          consensusRequired: Boolean(input.consensusRequired),
        }));
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (url.pathname === "/api/skills" && req.method === "GET") {
      return json(res, 200, skills.catalog());
    }

    if (url.pathname === "/api/skills/installed" && req.method === "GET") {
      return json(res, 200, skills.listInstalled());
    }

    if (url.pathname.startsWith("/api/skills/")) {
      const parts = url.pathname.slice("/api/skills/".length).split("/");
      const id = decodeURIComponent(parts[0] || "");
      const action = parts[1] || "";
      try {
        if (req.method === "POST" && action === "install") {
          return json(res, 201, skills.install(id));
        }
        if (req.method === "DELETE" && !action) {
          return skills.uninstall(id)
            ? json(res, 200, { uninstalled: true })
            : json(res, 404, { error: "Installed skill not found" });
        }
        if (req.method === "POST" && (action === "enable" || action === "disable")) {
          const input = await body(req);
          const agentId = String(input.agentId || "");
          return json(res, 200, action === "enable"
            ? skills.enable(id, agentId)
            : skills.disable(id, agentId));
        }
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (url.pathname === "/api/delegations" && req.method === "GET") {
      return json(res, 200, delegations.list());
    }

    if (url.pathname === "/api/delegations" && req.method === "POST") {
      const input = await body(req);
      try {
        return json(res, 201, await delegations.create({
          task: String(input.task || input.input || ""),
          fromAgent: String(input.fromAgent || ""),
          toAgent: String(input.toAgent || ""),
          priority: input.priority || "normal",
          requiresApproval: Boolean(input.requiresApproval),
        }));
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (url.pathname === "/api/models") return json(res, 200, await models.status());
    if (url.pathname === "/api/tools") return json(res, 200, tools.list());
    if (url.pathname === "/api/memory") {
      return json(res, 200, url.searchParams.get("q")
        ? memory.search(url.searchParams.get("q")!)
        : memory.list());
    }
    if (url.pathname === "/api/events") return json(res, 200, events.list());

    if (url.pathname === "/api/events/stream") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        ...cors(),
      });
      const unsubscribe = events.subscribe(event => {
        res.write("data: " + JSON.stringify(event) + "\n\n");
      });
      req.on("close", unsubscribe);
      return;
    }

    if (url.pathname === "/api/approvals" && req.method === "GET") {
      return json(res, 200, approvals.list());
    }

    if (url.pathname.startsWith("/api/approvals/") && req.method === "POST") {
      const id = idFrom(url.pathname, "/api/approvals/");
      const input = await body(req);
      const status = input.status === "approved"
        ? "approved"
        : input.status === "rejected"
          ? "rejected"
          : null;
      if (!status) return json(res, 400, { error: "status must be approved or rejected" });
      const item = approvals.decide(id, status);
      if (!item) return json(res, 404, { error: "Not found" });
      await delegations.applyApproval(id, status);
      return json(res, 200, item);
    }

    if (url.pathname === "/api/missions" && req.method === "GET") {
      return json(res, 200, orchestrator.listMissions());
    }

    if (url.pathname === "/api/missions" && req.method === "POST") {
      const input = await body(req);
      if (!input.goal) return json(res, 400, { error: "goal required" });
      const mission = orchestrator.createMission(String(input.goal));
      if (input.run !== false) void orchestrator.runMission(mission.id);
      return json(res, 201, mission);
    }

    if (url.pathname.startsWith("/api/missions/") && req.method === "GET") {
      const id = idFrom(url.pathname, "/api/missions/");
      const mission = orchestrator.mission(id);
      return mission ? json(res, 200, mission) : json(res, 404, { error: "Not found" });
    }

    if (url.pathname.startsWith("/api/missions/") && url.pathname.endsWith("/run") && req.method === "POST") {
      const id = url.pathname.split("/")[3];
      try {
        return json(res, 200, await orchestrator.runMission(id));
      } catch (error) {
        return json(res, 404, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      try {
        const html = await fs.readFile(path.join(webRoot, "index.html"), "utf8");
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(html);
      } catch {
        return json(res, 200, { name: "Cortex Agent OS", api: "/api/status" });
      }
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => console.log("Cortex Agent OS listening on :" + PORT));
