import { sql } from "./db.mjs";
import fs from "fs";

const schemaFile = new URL("./schema.sql", import.meta.url);
const schema = fs.readFileSync(schemaFile, "utf-8");
const statements = schema.split(/;\s*$/m).filter(s => s.trim().length > 0);

console.log(`[ensure-db] Creating ${statements.length} tables...`);
for (const stmt of statements) {
  try { await sql.unsafe(stmt); } catch (e) { if (!e.message?.includes('already exists')) console.warn(e.message); }
}
console.log("[ensure-db] Done.");
