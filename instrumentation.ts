/**
 * Next.js instrumentation hook. Called once per server start (on both
 * Node and Edge runtimes). Wires up Sentry early so any error thrown
 * anywhere in the app is captured, and validates billing/storage
 * config (loud warning when STRIPE_SECRET_KEY or S3 vars are wired
 * wrong).
 *
 * Storage validation is dynamic-imported inside the nodejs branch
 * because lib/storage.ts uses node:fs / node:crypto / node:path —
 * loading it at the top would force Turbopack to evaluate it for the
 * Edge runtime too, which it can't, and the build emits a wall of
 * "Node.js module in Edge Runtime" warnings.
 *
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { initSentry } from './lib/sentry'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    initSentry('server')

    const { validateBillingConfig } = await import('./lib/billing')
    const billingError = validateBillingConfig()
    if (billingError) console.warn('⚠️ ' + billingError)

    const { validateStorageConfig } = await import('./lib/storage')
    const storageError = validateStorageConfig()
    if (storageError) console.warn('⚠️ ' + storageError)
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    initSentry('edge')
  }
}
