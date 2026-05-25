/**
 * Next.js instrumentation hook. Called once per server start (on both
 * Node and Edge runtimes). Wires up Sentry early so any error thrown
 * anywhere in the app is captured, and validates billing config (loud
 * warning when STRIPE_SECRET_KEY is set but price ids are missing).
 *
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { initSentry } from './lib/sentry'
import { validateBillingConfig } from './lib/billing'
import { validateStorageConfig } from './lib/storage'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    initSentry('server')

    // Loud-but-non-fatal config checks. Logged with a recognisable
    // prefix so the deploy workflow's tail-of-log step surfaces them
    // immediately when env vars are wired wrong.
    const billingError = validateBillingConfig()
    if (billingError) console.warn('⚠️ ' + billingError)

    const storageError = validateStorageConfig()
    if (storageError) console.warn('⚠️ ' + storageError)
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    initSentry('edge')
  }
}
