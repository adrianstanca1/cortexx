const GIB = 1024 ** 3

/**
 * Disk space is a capacity check on persistent hosts. Serverless filesystems
 * are ephemeral and their statfs values do not represent durable storage, so
 * they must not turn an otherwise healthy application into HTTP 503.
 */
export function evaluateDiskCapacity(freeBytes, env = process.env) {
  const serverless = env.VERCEL === '1' || Boolean(env.AWS_LAMBDA_FUNCTION_NAME) ||
    String(env.AWS_EXECUTION_ENV || '').startsWith('AWS_Lambda_')
  if (serverless) return { ok: true, ephemeral: true }

  const freeGb = Number(freeBytes) / GIB
  if (!Number.isFinite(freeGb) || freeGb < 0) return { ok: false, error: 'Disk capacity unavailable' }
  return { ok: freeGb > 1, free_gb: Math.round(freeGb * 100) / 100 }
}
