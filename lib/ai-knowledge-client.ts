/** Resolve the active workspace again after a potentially long model request.
 * Another tab may have changed the shared workspace cookie in the meantime. */
export async function knowledgeWorkspaceMatches(orgId: string): Promise<boolean> {
  const response = await fetch('/api/ask', { cache: 'no-store' })
  if (!response.ok) throw new Error('Workspace context unavailable. Reload to try again.')
  const data = await response.json()
  return data.orgId === orgId
}
