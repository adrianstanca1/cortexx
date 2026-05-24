export const ENV = {
  // Self-identifier baked into every issued JWT (and used as the OAuth
  // clientId). verifySession rejects tokens with an empty appId, so an
  // unset VITE_APP_ID would silently break auth.me / auth.session for
  // every email/password login. Default to the project name — matches
  // the literal "cortexbuild-field" the password-login mutation used
  // before #36 collapsed it into ENV.appId.
  appId: process.env.VITE_APP_ID ?? "cortexbuild-field",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Supabase project URL (e.g. https://abcdefg.supabase.co). Used to build
  // the JWKS endpoint and the issuer claim that verifySupabaseJwt expects.
  // Required at request time once authenticateRequest is migrated.
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  // Comma-separated list of email domains permitted to self-register via
  // auth.register. Empty list = registration disabled (returns FORBIDDEN).
  // Captured at module load — tests that rotate it must fresh-import.
  registrationAllowedDomains: (process.env.REGISTRATION_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Local Ollama base URL — primary provider for unified-ai. Defaults to
  // 127.0.0.1:11434 if unset (matches `ollama serve` defaults).
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  // Optional fallback API keys; orchestrator skips the provider when empty.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "cortexbuild-field",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
};
