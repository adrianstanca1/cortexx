// Do not allow an accessible error/login page to mask a broken route.
export function assertRouteHealth(response, requestedRoute, actualURL) {
  const status = response?.status()
  if (!status || status >= 400) {
    throw new Error(`${requestedRoute}: HTTP ${status ?? 'no response'}`)
  }
  const requestedPath = new URL(requestedRoute, actualURL).pathname
  const actualPath = new URL(actualURL).pathname
  const authenticationPaths = ['/login', '/register']
  if (!authenticationPaths.includes(requestedPath) && authenticationPaths.includes(actualPath)) {
    throw new Error(`${requestedRoute}: unexpected authentication redirect to ${actualPath}`)
  }
}
