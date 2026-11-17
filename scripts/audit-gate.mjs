#!/usr/bin/env node
// Fail on high/critical production advisories unless every root advisory is
// explicitly allowlisted and its review date has not passed. Dependents that
// inherit an allowed advisory are accepted, but a new root advisory fails even
// when it arrives through the same dependency tree.
import { readFileSync } from "node:fs"

const [reportPath, allowPath] = process.argv.slice(2)
if (!reportPath || !allowPath) {
  console.error("usage: audit-gate.mjs <npm-audit.json> <allowlist.json>")
  process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, "utf8"))
const allowlist = JSON.parse(readFileSync(allowPath, "utf8"))
const today = new Date().toISOString().slice(0, 10)
const active = allowlist.filter((entry) => entry.reviewDue >= today)
const allowed = new Set(active.map((entry) => entry.ghsa))

const findings = Object.entries(report.vulnerabilities || {}).filter(([, value]) =>
  ["high", "critical"].includes(value.severity),
)
if (findings.length === 0) {
  console.log("audit: no high or critical production advisories")
  process.exit(0)
}

const advisories = new Set()
for (const [, value] of findings) {
  for (const via of value.via || []) {
    if (via && typeof via === "object" && via.url) {
      advisories.add(String(via.url).split("/").pop())
    }
  }
}
if (advisories.size === 0) {
  console.error("audit: high/critical finding without an advisory id; refusing to waive")
  process.exit(1)
}

const unallowed = [...advisories].filter((id) => !allowed.has(id))
if (unallowed.length > 0) {
  console.error(`audit: unallowlisted high/critical advisory: ${unallowed.join(", ")}`)
  process.exit(1)
}

console.log(
  `audit: ${findings.length} high/critical package(s) covered by active waivers: ${[...advisories].join(", ")}`,
)
