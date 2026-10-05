const base = process.env.CORTEX_URL || "http://127.0.0.1:4310";
const token = process.env.CORTEX_AGENT_OS_TOKEN || "";
const [command, ...args] = process.argv.slice(2);

if (token.length < 32) {
  throw new Error("Set CORTEX_AGENT_OS_TOKEN to the operator token");
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function main() {
  switch (command) {
    case "status":
      console.log(JSON.stringify(await request("/api/status"), null, 2));
      break;
    case "agents":
      console.log(JSON.stringify(await request("/api/agents"), null, 2));
      break;
    case "groups":
      console.log(JSON.stringify(await request("/api/groups"), null, 2));
      break;
    case "skills":
      console.log(JSON.stringify(await request("/api/skills"), null, 2));
      break;
    case "delegations":
      console.log(JSON.stringify(await request("/api/delegations"), null, 2));
      break;
    case "models":
      console.log(JSON.stringify(await request("/api/models"), null, 2));
      break;
    case "approvals":
      console.log(JSON.stringify(await request("/api/approvals"), null, 2));
      break;
    case "missions":
      console.log(JSON.stringify(await request("/api/missions"), null, 2));
      break;
    case "mission": {
      const goal = args.join(" ");
      if (!goal) throw new Error("Usage: npm run cli -- mission <goal>");
      console.log(JSON.stringify(await request("/api/missions", {
        method: "POST",
        body: JSON.stringify({ goal }),
      }), null, 2));
      break;
    }
    default:
      console.log("cortex commands: status | agents | groups | skills | delegations | models | approvals | missions | mission <goal>");
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
