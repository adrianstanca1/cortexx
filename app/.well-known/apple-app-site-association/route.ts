// Read the signed app's application-identifier at runtime, so configuring
// Universal Links never requires baking Apple account data into a web build.
export const dynamic = 'force-dynamic'

export function GET() {
  const appIdentifier = process.env.APPLE_APP_IDENTIFIER?.trim()

  // The App ID prefix can differ from the Team ID for older Apple accounts.
  // Only associate the canonical bundle shipped by this repository.
  if (appIdentifier && !/^[A-Z0-9]{10}\.com\.cortexbuild\.app$/.test(appIdentifier)) {
    return Response.json(
      { error: 'APPLE_APP_IDENTIFIER must match the signed com.cortexbuild.app identifier' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return Response.json({
    applinks: {
      apps: [],
      details: appIdentifier ? [{
        appIDs: [appIdentifier],
        components: [{ '/': '*' }],
      }] : [],
    },
    webcredentials: { apps: appIdentifier ? [appIdentifier] : [] },
  }, {
    // Empty associations must be rechecked after the identifier is configured.
    headers: { 'Cache-Control': appIdentifier ? 'public, max-age=3600' : 'no-store' },
  })
}
