/**
 * Tiny structured logger for the Cortexx API.
 *
 * Dependency-free: timestamped, leveled lines (INFO / WARN / ERROR) to stdout/
 * stderr, with an optional structured `meta` object. The Express API previously
 * used ad-hoc console.log/console.error sprinkled across handlers; this module
 * centralises that so levels are consistent and output is parseable by log
 * shippers. Behaviour is unchanged otherwise — INFO/WARN go to stdout, ERROR to
 * stderr, each as a single line.
 *
 * Usage:
 *   const log = require('./logger');
 *   log.info('server started', { port });
 *   log.warn('cookie-parser missing');
 *   log.error('db query failed', { err: err.message });
 */
'use strict'

const LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' }

function fmt(level, msg, meta) {
  const ts = new Date().toISOString()
  let line = `${ts} ${level} ${msg}`
  if (meta !== undefined && meta !== null) {
    try {
      const flat = meta instanceof Error ? { err: meta.message } : meta
      line += ' ' + JSON.stringify(flat)
    } catch { /* circular/non-serialisable — skip meta */ }
  }
  return line
}

function write(level, stream, msg, meta) {
  stream.write(fmt(level, msg, meta) + '\n')
}

const log = {
  LEVELS,
  info(msg, meta) { write(LEVELS.INFO, process.stdout, msg, meta) },
  warn(msg, meta) { write(LEVELS.WARN, process.stdout, msg, meta) },
  error(msg, meta) { write(LEVELS.ERROR, process.stderr, msg, meta) },
  // Fatal boot-time guard failures (still ERROR level, but a distinct helper
  // so call sites read clearly).
  fatal(msg, meta) { write(LEVELS.ERROR, process.stderr, msg, meta) },
}

module.exports = log
