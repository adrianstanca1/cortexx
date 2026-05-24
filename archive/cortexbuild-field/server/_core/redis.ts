/**
 * Minimal Redis liveness probe for /api/health — opens a TCP connection,
 * issues PING, expects +PONG, then closes. No client lib dependency.
 *
 * Keeps the bundle small and avoids pulling ioredis/redis just for a
 * binary "is the cache reachable" answer. If we later need real caching,
 * swap this out for `ioredis`.
 */
import net from "node:net";
import { URL } from "node:url";

export type RedisCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

const REDIS_PROBE_TIMEOUT_MS = 1500;

/**
 * `REDIS_URL` is parsed loosely — `host`, `port`, optional `password` (basic
 * URL auth, no AUTH-with-username yet). Returns ok when Redis replies +PONG
 * within the timeout, else a reason string for the health response.
 */
export async function checkRedisReady(): Promise<RedisCheckResult> {
  const url = process.env.REDIS_URL;
  if (!url) return { ok: false, reason: "missing_redis_url" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_redis_url" };
  }

  const host = parsed.hostname || "127.0.0.1";
  const port = Number(parsed.port) || 6379;
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";

  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let settled = false;
    const finish = (r: RedisCheckResult) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(r);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), REDIS_PROBE_TIMEOUT_MS);

    sock.once("error", (err) => {
      clearTimeout(timer);
      finish({ ok: false, reason: `connect_error:${(err as Error).message.slice(0, 40)}` });
    });

    sock.once("connect", () => {
      // RESP-encoded AUTH (if password) then PING. Redis pipelines these.
      const cmds: string[] = [];
      if (password) {
        cmds.push(`*2\r\n$4\r\nAUTH\r\n$${password.length}\r\n${password}\r\n`);
      }
      cmds.push("*1\r\n$4\r\nPING\r\n");
      sock.write(cmds.join(""));
    });

    let buf = "";
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      // Look for +PONG, +OK, or -ERR.  (+OK appears for AUTH; we just need PONG to follow.)
      if (buf.includes("+PONG")) {
        clearTimeout(timer);
        finish({ ok: true });
      } else if (buf.startsWith("-")) {
        clearTimeout(timer);
        const line = buf.split("\r\n")[0]?.slice(1) ?? "auth_failed";
        finish({ ok: false, reason: line.slice(0, 60) });
      }
    });
  });
}
