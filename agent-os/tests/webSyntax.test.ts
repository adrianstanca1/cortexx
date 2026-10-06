import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

test("Mission Control browser script parses", () => {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/index.html"),
    path.resolve(process.cwd(), "agent-os/apps/web/index.html"),
  ];
  const file = candidates.find(existsSync);
  assert.ok(file, "Agent OS web index.html not found");
  const html = readFileSync(file, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match?.[1], "Agent OS browser script missing");
  assert.doesNotThrow(() => new Function(match![1]));
});
