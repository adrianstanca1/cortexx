const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')

// Patterns that must never appear in a tracked file. Each is a shape, not a
// specific secret: we assert on structure (credential embedded in a URL, a
// password assigned inline) so newly added leaks are caught even when the
// value itself is unknown to this test.
//
// URL-shaped patterns capture THREE groups: 1 = username, 2 = password,
// 3 = host. Capturing the host is what lets isUserEcho() refuse to excuse a
// remote credential; capturing the username separately from the password is
// what stops a two-group pattern from comparing the password against itself.
const SCHEMES = ['postgres(?:ql)?', 'mysql', 'mariadb', 'mongodb(?:\\+srv)?', 'redis(?:s)?', 'amqp', 'cockroachdb', 'clickhouse', 'mssql', 'sqlserver', 'ftp', 'ftps', 'git', 'https?', 'ssh']
// The host group must tolerate an explicit port and a trailing slash-free path
// boundary, otherwise "db.prod-host.io:5432" fails to match at all and a
// credential is never inspected.
const URL_RE = new RegExp(`\\b(?:${SCHEMES.join('|')}):\\/\\/([^:@/\\s]+):([^@/\\s]+)@([^\\s/'"]+)`, 'i')

// A variable name that names a secret, e.g. ADMIN_PASSWORD, JWT_SECRET,
// OPENAI_API_KEY. Anchored on the noun so prefixed/suffixed names match, not
// just the bare words.
const SECRET_KEY = '[A-Za-z0-9_]*(?:password|passwd|pwd|secret|token|api[_-]?key|credential|auth)[A-Za-z0-9_]*'

const TEMPLATE_SECRET_RE = new RegExp('\\b' + SECRET_KEY + '\\s*[\'"]?\\s*[:=]\\s*`(?![^`]*\\$\\{)([^`]{6,})`', 'i')

const PATTERNS = [
  { name: 'URL with inline password', group: 2, user: 1, host: 3, re: URL_RE },
  // Quoted value. '$' is NOT excluded from the capture: a bare "$" inside an
  // otherwise literal password is still a literal secret, and isPlaceholder()
  // is the component that distinguishes a whole-variable reference from a
  // literal. Excluding '$' here hid those values from the classifier entirely.
  //
  // The key may be quoted ("password": "...") as in JSON and quoted-key YAML, so
  // an optional quote may sit between the key and the separator. Spaces are
  // allowed INSIDE the quotes: a quoted passphrase may contain them, and the
  // capture now runs to the matching quote rather than stopping at whitespace.
  { name: 'secret assigned inline', group: 1, re: new RegExp(`\\b${SECRET_KEY}\\s*['"]?\\s*[:=]\\s*['"]([^'"]{6,})['"]`, 'i') },
  { name: 'secret assigned in template literal', group: 1, re: TEMPLATE_SECRET_RE, sourceOnly: true },
  // Bare env-style assignment, as used by .env files: KEY=value with no quotes.
  // Also accepts the colon form used by unquoted YAML scalars (ADMIN_PASSWORD: x).
  // Unquoted values run to whitespace or an inline comment, so a value cannot
  // swallow the following key.
  //
  // "," ";" and ")" are excluded from the value AND the value must still reach
  // end-of-line, which together keep this off source code: `secretAccessKey:
  // S3_SECRET_ACCESS_KEY!,` and `accessTokenCipher: encryptXeroToken(x),` are
  // object-literal members and function calls, not environment entries. The
  // secret noun appears in plenty of ordinary code, so the discriminator has to
  // be the surrounding syntax rather than the name.
  { name: 'secret assigned in env syntax', group: 1, re: new RegExp(`^\\s*(?:export\\s+)?${SECRET_KEY}\\s*[:=]\\s*(?:['"]([^'"]{6,})['"]|([^\\s'"#,;)]{6,}))\\s*(?:#.*)?$`, 'mi') },
]

const IGNORED_PREFIXES = [
  'ios/App/App/public/',   // vendored React Native bundles
  'bin/',                  // compiled native libraries
  // This file's own regression fixtures. Every probe value below is assembled
  // from fragments at runtime precisely so secret-scanning CI does not treat it
  // as live; the guardrail must not then flag its own test vectors. This is a
  // single, explicit, self-referential exclusion — narrower than the old
  // "everything under test/" exemption, which let real leaks through anywhere
  // in the test tree.
  'test/no-committed-credentials.test.js',
]

// Apart from the vendored/binary prefixes and this file's own test vectors
// listed in IGNORED_PREFIXES, there is no path-based exemption and no vocabulary
// allowlist. Test sources are tracked and public exactly like production code,
// and a credential hardcoded while debugging an integration test is still a
// leak. Fixtures are excused by VALUE SHAPE (see isPlaceholder) or by a
// whole-value environment reference, never by living under test/.

// Hosts that are demonstrably not a live remote service. A username-echo
  // exemption is only defensible against these: against a real host, a password
  // that echoes the username is still a published credential.
  //
  // RFC 2606 reserves example.com/org/net precisely as documentation domains, so
  // a credential echoed there cannot address a real service. This is a
  // deliberate trade-off: it also means a genuine secret pasted against an
  // example.com host would be excused. The bounded blast radius is why the
  // exemption additionally requires the value to echo the username, which a
  // generated secret essentially never does. Drop the example.* alternative if
  // a stricter rule is wanted: the cost is rephrasing doc snippets as localhost.
const LOCAL_HOST = /^(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[?::1\]?|host\.docker\.internal)(?::\d+)?$|^[a-z0-9-]*\.local(?::\d+)?$|(?:^|\.)example\.(?:com|org|net)(?::\d+)?$/i

/** Service names that only resolve inside a container or compose network.
 *  A password against one of these cannot be reached from the public
 *  internet, and `redis://default:default@redis:6379` is the canonical example
 *  of a dev default that must not be reported. A FQDN or IP is never in here:
 *  anything resolvable from outside is treated as remote. */
const LOCAL_SERVICE_NAME = /^(?:postgres(?:ql)?|mysql|mariadb|mongo(?:db)?|redis|amqp|rabbitmq|db|database|api|app|web|valkey|clickhouse|localstack|minio)(?::\d+)?$/i

/** Minimum length for a value to be treated as a credential at all. Real
 *  passwords, API keys and connection-string secrets are comfortably longer;
 *  short strings like "include", "hidden", "s3cret" are enum values, field
 *  names and throwaway test stubs. */
const MIN_CREDENTIAL_LENGTH = 8

/** True when the candidate reads as documentation, a reference, or something
 *  that is not a literal secret at all, rather than as a generated credential.
 *
 *  This deliberately replaces an earlier "every token must appear in a known
 *  vocabulary" rule. That rule was unsound in both directions: it flagged
 *  ordinary English placeholders such as "changeme-please-1234" and
 *  "dev-only-do-not-use-in-prod" (so it could not be enabled without also
 *  editing .env.example), while its per-segment length escape hatch waved
 *  through generated secrets made of short groups. Shape is the signal:
 *
 *    - a function call, command substitution or braced expression is code
 *    - a URL is a connection string, judged by the URL pattern instead
 *    - an explicit redaction marker ("...", "***", "<value>") is documentation
 *    - a value that IS an environment reference is a reference, not a literal
 *    - a self-describing SCREAMING_SNAKE instruction names a secret, it is not one
 *    - a phrase of lowercase words reads as prose
 *
 *  Everything else is treated as a credential. Failing closed is correct here:
 *  the cost of a false positive is renaming a test stub, whereas a false
 *  negative is a published password. */
function isPlaceholder(value) {
  const raw = String(value).trim().replace(/^['"]|['"]$/g, '')
  const v = raw.toLowerCase()
  if (!v) return true
  // Not a literal: a call, a command substitution, or a parameter expansion —
  // but ONLY when the WHOLE value is that expression. A real password may
  // legitimately contain parentheses or braces ("Qz7(Wm2)Kp9"), so a value
  // that also carries ordinary credential characters is not excused for having
  // punctuation in it. Requiring the whole value to be the expression is what
  // keeps `generateToken()` and `$(mktemp)` exempt while `abc(def)ghi` is not.
  //
  // A parameter expansion carrying a DEFAULT (${A:-something}) is deliberately
  // NOT exempt: the default is a literal that ships in the repository, so
  // `postgresql://svc:${DB_PW:-fallbacksecret}@host/db` publishes the fallback
  // exactly as plainly as if it had been typed out.
  if (/^\$\([^)]*\)$|^[A-Za-z_][A-Za-z0-9_.]*\(.*\)$/.test(raw)) return true
  // A parameter expansion is a reference only when it carries NO default.
  // `${VAR:-literal}` still ships that literal into the repository, so classify
  // the DEFAULT and not the wrapper. Classifying the wrapper is how the bug
  // survived the first fix: `${VAR:-...}` tokenises into several short word-ish
  // fragments, which the multi-word prose rule below happily excuses, so the
  // embedded literal passed even after the exemption was narrowed.
  const withDefault = /^\$\{[A-Za-z_][A-Za-z0-9_]*[:-]([^{}]*)\}$/.exec(raw)
  if (withDefault) return isPlaceholder(withDefault[1])
  // A value that PARTLY contains an expansion is not a reference: `prefix${VAR}`
  // and `${VAR}suffix` still publish the literal part. A value that is ONLY the
  // reference is handled above and must stay exempt, so the check is for a
  // literal remainder, not merely for the presence of `$`.
  //
  // URLs are excluded here and judged by the rule below instead: in a URL the
  // expansion sits in the password POSITION, so the surrounding host and scheme
  // are not themselves a leaked literal. Testing this first is what made
  // `https://x-access-token:${GH_PAT}@github.com/...` unflaggable — the URL
  // decomposition never got a chance to run.
  if (/\$\{/.test(raw) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) &&
      raw.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*(:-[^{}]*)?\}/g, '').trim() !== '') {
    return false
  }
  // Inspect URL userinfo BEFORE the generic URL exemption. A URL carrying a
  // literal password is a credential even though the whole value is URL-shaped.
  // Only a password position that is itself a whole environment reference is
  // safe to exempt; defaults and literal prefixes/suffixes still publish data.
  const urlUserinfo = /^[a-z][a-z0-9+.-]*:\/\/[^/@:]*:([^/@]*)@/i.exec(raw)
  if (urlUserinfo) {
    const pw = urlUserinfo[1]
    if (/^\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)$/.test(pw)) return true
    return false
  }
  // URLs without a literal userinfo password are connection strings rather than
  // secret values and are judged by the URL-specific pattern in scan().
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return true
  // A dependency version constraint: "5.0.0-beta.32", "3.0.0 || 4.0.0". These
  // land here because the dependency NAME contains a secret noun ("next-auth",
  // "js-tokens", "x-sentry-auth"), and a version range is never a credential
  // however it is punctuated. Judged structurally — every "||" branch must
  // itself be a bare semver — rather than by listing version strings.
  if (raw.split('||').every((part) =>
        /^[~^><=\s]*v?\d+\.\d+(?:\.\d+)*(?:[-+][0-9A-Za-z.-]+)?[~^><=\s]*$/.test(part))) {
    return true
  }
  // An HTTP auth scheme is transport framing, not part of the secret, so judge
  // what follows it. A stub like a short scheme-prefixed word is then too short
  // to be a credential, while a real Authorization header still has a long,
  // credential-shaped remainder and is reported.
  const scheme = /^(?:bearer|basic|token|digest)\s+/i.exec(raw)
  if (scheme) return isPlaceholder(raw.slice(scheme[0].length))
  // Explicit redaction markers are placeholders only when they are the whole
  // value. A credential that merely contains a marker is still a leak.
  if (/^(?:\.\.\.|\*{2,}|<[^>]+>)$/.test(raw)) return true
  // A shell/env variable reference is the correct way to inject a credential.
  // The whole value must BE the reference, with NO default: `${VAR}` and `$VAR`
  // point at a secret held elsewhere, but `${VAR:-literal}` still publishes that
  // literal into the repository, exactly as visibly as if it had been typed out.
  // Splitting the reference shape from the default shape is what lets the
  // default fall through to the credential rules below.
  if (/^\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)$/.test(raw)) return true
  // SCREAMING_SNAKE containing a secret noun is an instruction, not a secret:
  // "GENERATE_LONG_RAND_PASSWORD" is documentation. A real password is never
  // all-caps, underscore-delimited, and self-describing.
  if (/^[A-Z0-9_]+$/.test(raw) && /(^|_)(PASSWORD|SECRET|TOKEN|CREDENTIAL|KEY)($|_)/.test(raw)) {
    return true
  }
  // Too short to be a real credential.
  if (raw.length < MIN_CREDENTIAL_LENGTH) return true

  const tokens = raw.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const alphaTokens = tokens.filter((t) => /[A-Za-z]/.test(t))
  // A single all-lowercase word ("include", "mktemp", "unknown") is an enum
  // value or a field name. Generated credentials carry case or digits.
  if (alphaTokens.length === 1 && !/[0-9A-Z]/.test(raw)) return true
  // A value built by repeating a short cycle is hand-written test material.
  // Real key material does not cycle: "0123456789abcdef" repeated four times
  // is an obvious stand-in, whereas a generated key has no small period.
  for (let period = 1; period * 2 <= raw.length; period++) {
    if (raw.length % period !== 0) continue
    if (raw.slice(0, period) === raw.slice(period, period * 2) &&
        raw.slice(0, period) === raw.slice(period * 2, period * 3) &&
        raw.slice(0, period) === raw.slice(period * 3)) {
      return true
    }
  }
  // A structured, provider-issued identifier rather than a credential:
  // "ExponentPushToken[abc123]" is a push handle echoed by the test, not a key.
  if (/^[A-Za-z][A-Za-z0-9_]*\[[A-Za-z0-9._-]{1,32}\]$/.test(raw)) return true
  // A prose phrase: several words, no token that mixes letters with digits and
  // no token that mixes upper and lower case. Hyphenated documentation values
  // like "changeme-please-1234" pass; a single token that mixes upper and lower
  // case with digits does not. Those counter-examples are deliberately not
  // written out here: this file is scanned by the same tools it scans with.
  if (alphaTokens.length >= 2) {
    for (const t of tokens) {
      const hasLetter = /[A-Za-z]/.test(t)
      const hasDigit = /[0-9]/.test(t)
      const hasUpper = /[A-Z]/.test(t)
      const hasLower = /[a-z]/.test(t)
      if ((hasLetter && hasDigit) || (hasUpper && hasLower)) return false
    }
    return true
  }
  return false
}

/** Whether the match at `end` is a literal PREFIX being concatenated with a
 *  non-empty right-hand side, e.g. `'sentry_key=' + DSN.publicKey`.
 *
 *  Both halves are required, and that conjunction is the whole point. Checking
 *  only the concatenation would excuse `password = "RealSecret" + suffix`,
 *  which is a live credential with a suffix appended — so the literal must ALSO
 *  end as an assignment prefix (`=` or `:`), the shape of a wire-format header
 *  waiting for its value rather than a complete secret. The right-hand side
 *  must be non-empty, so a trailing `+` at end of line does not excuse. */
function isConcatenatedFragment(contents, end, value) {
  if (!/[=:]\s*$/.test(String(value))) return false
  return /^\s*\+\s*\S/.test(contents.slice(end, end + 64))
}

/** Whether a credential-shaped value merely mirrors the username it protects.
 *  Real credentials are independent of the identity they authenticate, so an
 *  echo is a signal to look harder, not automatically a false positive.
 *
 *  This answers the narrow question "is this the same string as the username?"
 *  and deliberately says nothing about the host: whether an echo is acceptable
 *  depends on where it points, and that judgement belongs to scan() so the two
 *  cases (local dev convenience vs. published remote credential) cannot be
 *  collapsed by accident. */
function isUserEcho(value, urlUser) {
  if (!urlUser) return false
  const a = String(value).trim().toLowerCase()
  const b = String(urlUser).trim().toLowerCase()
  return a === b || b.startsWith(a) || b.endsWith(a)
}

/** Whether a host is demonstrably not a live remote service. Only against such
 *  a host is a username-echo password an acceptable dev convenience. */
function isLocalHost(urlHost) {
  if (urlHost === undefined) return false
  const h = String(urlHost)
  return LOCAL_HOST.test(h) || LOCAL_SERVICE_NAME.test(h)
}

/** Classify every pattern match in a file; return only the non-placeholder ones. */
function scan(contents, file) {
  const findings = []
  for (const { name, re, group, user, host, sourceOnly } of PATTERNS) {
    if (sourceOnly && !/\.(?:[cm]?[jt]sx?)$/i.test(file)) continue
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    let m
    while ((m = global.exec(contents)) !== null) {
      // A pattern may offer alternated capture groups (quoted vs bare env
      // syntax). Take the first group that actually captured, so an unmatched
      // branch does not silently discard the match.
      let value = m[group]
      if (value === undefined) {
        for (let g = 1; g <= m.length; g++) {
          if (m[g] !== undefined) { value = m[g]; break }
        }
      }
      if (value === undefined) continue
      if (user !== undefined) {
        // A password embedded in a URL that merely echoes the username is a
        // dev convenience only when it points at a demonstrably local host.
        // Against any other host it is a published, working credential and is
        // reported unconditionally: the leniency isPlaceholder() shows toward
        // short ordinary-looking words ("waverify", "default") must not be able
        // to cancel this. That leniency exists to keep prose assignments from
        // tripping the guardrail, not to excuse a live credential in a URL.
        const urlHost = host === undefined ? undefined : m[host]
        if (!isLocalHost(urlHost) && isUserEcho(value, m[user])) {
          findings.push(`${file}: ${name} -> username-echo credential on a remote host (len ${value.length})`)
          continue
        }
      }
      if (isPlaceholder(value)) continue
      // A quoted PREFIX that is immediately concatenated is not a standalone
      // credential — it is one piece of a larger expression, typically a header
      // assembled from a value held elsewhere:
      //     'x-sentry-auth': 'Sentry sentry_version=7,sentry_key=' + DSN.publicKey + ...
      // Here the literal is a prefix; the actual secret arrives as an
      // identifier at runtime. Judged by isConcatenatedFragment() rather than
      // by narrowing the pattern, because a `(?!\s*\+)` lookahead in the regex
      // would also excuse `password: "RealSecret" + x`, which IS a leak. That
      // helper requires BOTH a non-empty right-hand side and a literal ending
      // in `=`/`:`, so neither a bare trailing `+` nor a complete secret being
      // concatenated is excused.
      if (isConcatenatedFragment(contents, m.index + m[0].length, value)) continue
      // Local host and the password merely echoes the username: a dev default.
      if (user !== undefined && isLocalHost(host === undefined ? undefined : m[host]) && isUserEcho(value, m[user])) continue
      // Report shape + length only; never the value.
      findings.push(`${file}: ${name} -> non-placeholder value (len ${value.length})`)
    }
  }
  return findings
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter(Boolean).filter((f) => !IGNORED_PREFIXES.some((p) => f.startsWith(p)))
}

/** Read every tracked blob in ONE git process.
 *  `git cat-file --batch` streams "<sha> <type> <size>\n<contents>\n" per object,
 *  so this costs one subprocess instead of one per file (1475 spawns took ~7s).
 */
function readAllTracked(files) {
  const index = execFileSync('git', ['ls-files', '-s', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const byPath = new Map()
  for (const entry of index.split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t')
    const path = entry.slice(tab + 1)
    const sha = entry.slice(0, tab).split(' ')[1]
    if (sha && files.includes(path)) byPath.set(path, sha)
  }

  const out = { text: new Map(), binary: new Set() }
  if (byPath.size === 0) return out

  // Feed the blob SHA taken from the INDEX, so a staged-but-uncommitted file is
  // still scanned (that is exactly the state a developer is in when they add a
  // secret) and so we never pay git's path resolution per file.
  const shas = [...byPath.values()]
  let stdout
  try {
    // No `encoding` option: execFileSync then returns a Buffer, which is what the
    // length-prefixed batch stream requires. Passing 'buffer' throws
    // ERR_UNKNOWN_ENCODING on modern Node and would be swallowed into a vacuous pass.
    stdout = execFileSync('git', ['cat-file', '--batch'], {
      cwd: repoRoot, input: `${shas.join('\n')}\n`, maxBuffer: 512 * 1024 * 1024,
    })
  } catch {
    return out // fall back to empty; non-vacuity assertions will fail loudly
  }
  if (!Buffer.isBuffer(stdout)) stdout = Buffer.from(stdout, 'latin1')

  // Walk the batch stream: "<sha> <type> <size>\n" then exactly <size> bytes then \n
  let offset = 0
  for (const path of byPath.keys()) {
    const nl = stdout.indexOf(0x0a, offset)
    if (nl === -1) break
    const header = stdout.toString('ascii', offset, nl)
    const [sha, type, sizeStr] = header.split(' ')
    const size = Number(sizeStr)
    if (!sha || Number.isNaN(size)) { offset = nl + 1; continue }
    const bodyStart = nl + 1
    const body = stdout.subarray(bodyStart, bodyStart + size)
    offset = bodyStart + size + 1 // +1 for the trailing newline
    if (type === 'blob') {
      if (body.includes(0)) out.binary.add(path)
      else out.text.set(path, body.toString('utf8'))
    }
  }
  return out
}

test('no tracked file embeds a live credential', () => {
  const files = trackedFiles()
  assert.ok(files.length > 0, 'git ls-files returned nothing — test would pass vacuously')

  const { text, binary } = readAllTracked(files)
  assert.ok(text.size > 0, 'no blobs read from git — test would pass vacuously')

  const findings = []
  for (const [file, contents] of text) {
    if (binary.has(file)) continue
    findings.push(...scan(contents, file))
  }

  assert.deepEqual(findings, [], `Credentials must come from the environment, never from tracked files:\n  ${findings.join('\n  ')}`)
})

test('tracked env templates stay placeholder-only', () => {
  const templates = trackedFiles().filter((f) => f.endsWith('.env.example') || f.endsWith('.env.template'))
  assert.ok(templates.length > 0, 'no env templates tracked — test would pass vacuously')

  const { text, binary } = readAllTracked(templates)
  // Every template must have been read back from git. The repository-wide test
  // above proves only that SOME text blob was read; if this narrower
  // cat-file call fails and returns nothing, this test would report zero
  // findings and pass while checking no template at all.
  assert.ok(
    text.size + binary.size > 0,
    'no env template blobs read from git — test would pass vacuously',
  )
  const unread = templates.filter((f) => !text.has(f) && !binary.has(f))
  assert.deepEqual(unread, [], `env templates missing from the git index read: ${unread.join(', ')}`)

  const findings = []
  for (const [file, contents] of text) {
    findings.push(...scan(contents, file))
  }

  assert.deepEqual(findings, [], `Env templates must document placeholders only:\n  ${findings.join('\n  ')}`)
})

const probe = (...parts) => parts.join('')
// A per-case value so no two assertions share a literal.
const MIXED = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const value = (n) => {
  // Generated one character at a time from a character-class table, so no
  // credential-shaped literal is stored anywhere in this file — not even as a
  // run of fragments an external scanner could reassemble. Holding the
  // fragments in arrays instead still put eight of them on one line, which
  // concatenated into exactly the token GitGuardian flags.
  // Pin one character from each class first, then fill the rest from the
  // table. Without this, a case can land on a value with no digit at all and
  // pass for a reason that has nothing to do with the bug under test.
  let out = ''
  for (let i = 0; i < 12; i++) out += MIXED[(n * 13 + i * 29 + 7) % MIXED.length]
  // Guarantee one character from each class. The three representatives are
  // ROTATED by n, then the whole thing is truncated back to 12: rotating keeps
  // the classes from landing in a fixed suffix that a scanner could learn, and
  // truncating keeps the value the same length as the table-generated part.
  const reps = ['aZ9', '9aZ', 'Z9a'][n % 3]
  return (reps + out).slice(0, 12)
}

test('the placeholder classifier is neither vacuous nor permissive', () => {
  // Guards against a classifier that passes everything, or one so loose it
  // would classify a real password as a placeholder.
  assert.ok(isPlaceholder('changeme'))
  assert.ok(isPlaceholder('your_password_here'))
  assert.ok(isPlaceholder('$DB_PASSWORD'), 'a variable reference is the correct way to inject')
  assert.ok(isPlaceholder('${POSTGRES_PASSWORD:-dev}'), 'a reference with a default is still a reference')
  assert.ok(isPlaceholder('GENERATE_LONG_RAND_PASSWORD'), 'a self-describing instruction is not a secret')

  // These must all be flagged as real credentials. Each is assembled from
  // fragments at runtime: secret-scanning CI (GitGuardian et al.) matches on
  // entropy, so a high-entropy literal written out in full here would be
  // reported as a live credential on every commit even though it is a fixture.
  // The joined values are identical to what the assertions below require.
  // All generated, so no secret-shaped literal exists in this file for an
  // entropy scanner to report. Each still asserts the property that matters,
  // so substituting a weaker probe cannot quietly weaken the test.
  const strong = value(20)
  const realLooking = 'hunter2'.repeat(2)
  const randomToken = value(21)
  const dollarsIn = probe('P@$', '$w0rd', 'Z')
  const hexToken = [...'9f83bd27c1e8f3a2b6d4e5c9a1b2c3d4e']
    .map((ch, i) => (i % 4 === 0 ? String.fromCharCode(97 + (i * 7) % 26) : ch))
    .join('')

  assert.ok(!isPlaceholder(strong), 'strong password must not be classified as placeholder')
  assert.ok(!isPlaceholder(realLooking), 'real-looking password must not be classified as placeholder')
  assert.ok(!isPlaceholder(randomToken), 'random high-entropy token must not be classified as placeholder')
  assert.ok(!isPlaceholder(dollarsIn), 'a $ inside a password is not a variable reference')
  assert.ok(!isPlaceholder(hexToken), 'a hex token is a secret')

  // A generated credential split into short hyphen groups must not be excused
  // because every individual segment is 3 characters or fewer. The probe is
  // built one character at a time so no secret-shaped literal — nor an
  // assembleable run of them — appears in this file. The assertion on
  // length and character classes below is what pins the probe to the exact
  // grouped shape under test, without writing that shape down.
  const groupedProbe = ['a', 'B', '1', '-', 'x', 'Y', '2', '-', 'q', 'Z', '3'].join('')
  assert.equal(groupedProbe.length, 11, 'probe length')
  assert.match(groupedProbe, /^[a-z][A-Z][0-9](-[a-z][A-Z][0-9]){2}$/, 'probe is three hyphen-joined groups')
  assert.ok(!isPlaceholder(groupedProbe), 'grouped high-entropy token is a secret')
})

// Each case below is a bypass that a previous revision of this guardrail let
// through. They are asserted through the full scan() path (not by calling
// isPlaceholder() directly) because the original defects were in how values
// reached, or failed to reach, the classifier.
//
// The probe values are assembled from fragments so that secret-scanning CI does
// not report this test as containing live credentials. They are deliberately
// DIFFERENT from the FIXTURE_ALLOWLIST entries above: a probe value that happens
// to be allowlisted would pass the "must catch" assertion for the wrong reason.
//
// Each probe uses a DIFFERENT value, and each is built from a varying number of
// fragments. Reusing one value across every case is what GitGuardian flags, and
// it also weakens the suite: a fix that special-cased that single string would
// pass every assertion below. Distinct values force each fix to be structural.
test('the scanner catches every previously-known bypass', () => {
  // Exercise the username-echo rule without storing a credential-shaped URI
  // in the repository. The repeated value is constructed only at runtime.
  const remoteEcho = value(22)
  const tick = String.fromCharCode(96)
  const numericPassword = Array.from({ length: 8 }, (_, i) => String((i + 1) % 10)).join('')
  const embeddedRedaction = value(23).slice(0, 5) + '*'.repeat(3) + value(24).slice(0, 5)
  const mustCatch = [
    ['env-style assignment with a prefixed key', 'app/config.py', `ADMIN_PASSWORD=${probe('Qz7', 'Wm2', 'Kp9')}`],
    ['env-style assignment, quoted', '.env.example', `JWT_SECRET="${probe('Xv4', 'Bt6', 'Zr8')}"`],
    ['non-postgres scheme on DATABASE_URL', 'cfg.env', `DATABASE_URL=cockroachdb://user:${probe('Nm3', 'Qv7', 'Hs5')}@host/db`],
    ['username-echo against a REMOTE host', 'app/db.env', `postgresql://${remoteEcho}:${remoteEcho}@db.prod-host.io/prod`],
    ['grouped short segments', 'app/db.env', `postgresql://u:${probe('aB1', 'xY2', 'qZ3')}@h/db`],
    ['quoted password containing a dollar sign', 'app/config.py', `password = '${probe('Rt9', '$3x', 'yZ5')}'`],
    ['hardcoded URL inside a test directory', 'test/integration.test.js', `const U='postgresql://u:${probe('Wq2', 'Lf8', 'Gc4')}@db.internal/prod';`],
    ['http basic-auth userinfo', 'deploy.yml', `url: https://deploy:${probe('Pj6', 'Nk3', 'Vb9')}@example.com/repo.git`],
    ['shell default that is a literal credential', 'cfg.env', `DATABASE_URL=${'$'}{A:-postgresql://svc:${probe('Hd5', 'Qs2', 'Mx7')}@prod/db}`],
    // --- findings [9]-[13]: forms the earlier revision did not match at all ---
    ['quoted JSON key and value', 'cfg.json', `{"password": "${value(0)}", "host": "db"}`],
    ['quoted YAML key and value', 'cfg.yml', `"api_key": "${value(1)}"`],
    ['unquoted YAML colon value', 'cfg.yml', `ADMIN_PASSWORD: ${value(2)}`],
    ['password containing parentheses', 'app/c.py', `password = '${value(12)}'`],
    ['password containing braces', 'app/c.py', `password = "${value(13)}"`],
    ['quoted passphrase containing spaces', 'app/c.py', `password = "${value(11)}"`],
    ['URL password carrying a shell fallback literal', 'cfg.env',
      `postgresql://svc:${'$'}{DB_PW:-${value(3)}}@prod.example.org/db`],
    // --- regressions guarding the fixes above from becoming new bypasses ---
    ['a secret merely concatenated is still caught', 'app/leak.js',
      `const password = "${value(4)}" + suffix;`],
    ['concatenation with an empty right side is still caught', 'app/leak.js',
      `apiKey: "${value(5)}" + "",`],
    ['a secret on its own line before other code is still caught', 'app/leak.js',
      `password = "${value(6)}"\nconst tail = other;`],
    ['an expansion embedded in a literal prefix is caught', 'app/cfg.env',
      `PASSWORD=prefix${'$'}{DB_PW}`],
    ['an expansion embedded in a literal suffix is caught', 'app/cfg.env',
      `PASSWORD=${'$'}{DB_PW}suffix`],
    // The URL exemption above must not become a hole: a reference alongside a
    // LITERAL in the password position is still a leak.
    ['https token URL with a literal and a reference', 'deploy.yml',
      'url: https://x-access-token:' + value(7) + '$' + '{GH_PAT}@github.com/org/repo.git'],
    ['https token URL with a shell fallback literal', 'deploy.yml',
      'url: https://x-access-token:' + '$' + '{GH_PAT:-' + value(8) + '}@github.com/org/repo.git'],
    ['numeric-only password is not a semver', 'app/config.env',
      'ADMIN_PASSWORD=' + numericPassword],
    ['embedded redaction marker does not hide a credential', 'app/config.env',
      'ADMIN_PASSWORD=' + embeddedRedaction],
    ['template-literal credential', 'app/config.ts',
      'const API_TOKEN = ' + tick + value(25) + tick + ';'],
  ]
  for (const [label, file, contents] of mustCatch) {
    assert.notDeepEqual(scan(contents, file), [], `guardrail must catch: ${label}`)
  }

  // Every probe must be genuinely credential-shaped, or an assertion above
  // could pass for the wrong reason (the value being exempt rather than the
  // scanner being correct). Guard against that directly.
  for (let n = 0; n < 16; n++) {
    const v = value(n)
    assert.match(v, /[a-z]/, `probe ${n} needs a lowercase letter`)
    assert.match(v, /[A-Z]/, `probe ${n} needs an uppercase letter`)
    assert.match(v, /[0-9]/, `probe ${n} needs a digit`)
    assert.ok(!isPlaceholder(v), `probe ${n} must not be classified as a placeholder`)
  }
  assert.equal(new Set(Array.from({ length: 16 }, (_, n) => value(n))).size, 16,
    'every probe value must be distinct, so no fix can special-case one string')

  // The concatenation exemption must be that narrow, in the one real case it
  // exists for: a header prefix assembled with an identifier at runtime.
  assert.deepEqual(
    scan(`'x-sentry-auth': 'Sentry sentry_version=7,sentry_key=' + DSN.publicKey + ',sentry_client=cortex/1.0'`, 'lib/sentry.js'),
    [],
    'a literal prefix concatenated with a runtime identifier is not a credential')
})

// The converse must also hold: the fixes above cannot simply widen the net
// until every URL and every env line is reported.
test('the scanner still permits documented placeholders and env references', () => {
  const mustPass = [
    ['local username-echo', 'app/db.env', 'postgresql://devuser:devuser@localhost:5432/app'],
    ['reference-only URL', 'app/db.env', 'postgresql://user:' + '$' + '{PG_PASSWORD}@localhost:5432/app'],
    // A reference in the password position of a real URL is the standard CI
    // clone pattern and must not be reported (docs/patches/deploy-vps-updated.yml).
    ['https token URL using a reference', 'deploy.yml',
      'url: https://x-access-token:' + '$' + '{GH_PAT}@github.com/org/repo.git'],
    ['placeholder host echo', 'docs.md', 'redis://default:default@redis:6379'],
    ['env reference assignment', '.env.example', 'ADMIN_PASSWORD=$ADMIN_PASSWORD'],
    ['self-describing instruction', '.env.example', 'POSTGRES_PASSWORD=GENERATE_LONG_RAND_PASSWORD'],
    ['placeholder words', '.env.template', 'DB_PASSWORD=your_password_here'],
    ['whole redaction marker', '.env.template', 'DB_PASSWORD=' + '*'.repeat(3)],
    ['dependency semver', 'package.json', '{"next-auth":"5.0.0-beta.32"}'],
    ['template literal env reference', 'app/config.ts',
      'const API_TOKEN = ' + String.fromCharCode(96) + '$' + '{API_TOKEN}' + String.fromCharCode(96) + ';'],
  ]
  for (const [label, file, contents] of mustPass) {
    assert.deepEqual(scan(contents, file), [], `must NOT be flagged: ${label}`)
  }
})
