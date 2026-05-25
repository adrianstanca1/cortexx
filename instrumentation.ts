/**
 * Next.js instrumentation hook. Called once per server start (on both
 * Node and Edge runtimes). Used to wire up Sentry early so any error
 * thrown anywhere in the app is captured.
 *
 * See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { initSentry } from './lib/sentry'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    initSentry('server')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    initSentry('edge')
  }
}
