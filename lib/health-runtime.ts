/**
 * Local disk capacity is not a meaningful readiness signal on serverless hosts:
 * the filesystem is ephemeral and may be mounted with a tiny reported quota.
 * Uploads must use the configured object store, not the function filesystem.
 */
export function isServerlessRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === '1' || Boolean(env.AWS_LAMBDA_FUNCTION_NAME)
}
