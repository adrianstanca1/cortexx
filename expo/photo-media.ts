/** A native image request must never send the user's JWT to a third-party host. */
export function photoSource(url: string | null, token: string | null, apiUrl: string): { uri: string; headers?: { Authorization: string } } | null {
  if (!url) return null;
  if (/^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(url) && token) {
    return { uri: `${apiUrl.replace(/\/$/, '')}${url}?stream=1`, headers: { Authorization: `Bearer ${token}` } };
  }
  // External HTTPS images are allowed for legacy document links, without credentials.
  // Reject userinfo, unencrypted transport and arbitrary relative paths.
  try {
    const candidate = new URL(url);
    if (candidate.protocol !== 'https:' || candidate.username || candidate.password) return null;
    return { uri: candidate.href };
  } catch { return null; }
}
