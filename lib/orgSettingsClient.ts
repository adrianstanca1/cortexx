export interface OrganizationInviteSummary {
  id: string
  email: string
  role: string
  personaRole: string
  expiresAt: string
}

export interface OrganizationSummary {
  id: string
  slug: string
  name: string
  role: string
  personaRole?: string
  active?: boolean
}

type FetchResponse = Pick<Response, 'ok' | 'status' | 'json'>
type Fetcher = (url: string, init?: RequestInit) => Promise<FetchResponse>

export function selectActiveOrganization<T extends { active?: boolean }>(organizations: T[]): T | null {
  return organizations.find(organization => organization.active) || organizations[0] || null
}

export async function loadActiveOrganization(request: Fetcher = fetch): Promise<OrganizationSummary | null> {
  const response = await request('/api/orgs')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load workspaces')
  return selectActiveOrganization((data.organizations || []) as OrganizationSummary[])
}

export async function loadPendingInvites(
  organizationId: string,
  role: string,
  request: Fetcher = fetch,
): Promise<{ invites: OrganizationInviteSummary[]; error: string | null }> {
  if (role !== 'owner' && role !== 'admin') return { invites: [], error: null }

  try {
    const response = await request(`/api/orgs/${organizationId}/invites`)
    if (response.ok) {
      const data = await response.json()
      return { invites: data.invites || [], error: null }
    }
    if (response.status === 403) return { invites: [], error: null }
    const data = await response.json().catch(() => ({}))
    return { invites: [], error: data.error || 'Failed to load invites' }
  } catch (error) {
    return { invites: [], error: error instanceof Error ? error.message : 'Failed to load invites' }
  }
}

export async function revokePendingInvite(
  organizationId: string,
  inviteId: string,
  request: Fetcher = fetch,
): Promise<void> {
  const response = await request(`/api/orgs/${organizationId}/invites`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Failed to revoke invite')
}

export function createInviteRevokeHandler<T, Result>(
  invite: T,
  revoke: (invite: T) => Result,
): () => Result {
  return () => revoke(invite)
}

export function auditLogUrl(
  organizationId: string,
  options: { action?: string; take: number; skip?: number },
): string {
  const params = new URLSearchParams()
  if (options.action) params.set('action', options.action)
  params.set('take', String(options.take))
  if (options.skip !== undefined) params.set('skip', String(options.skip))
  return `/api/orgs/${organizationId}/audit-log?${params.toString()}`
}

export async function loadAuditLog<T = unknown>(
  organizationId: string,
  options: { action?: string; take: number; skip?: number },
  request: Fetcher = fetch,
): Promise<{ events: T[]; total: number; hasMore: boolean }> {
  const response = await request(auditLogUrl(organizationId, options))
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed')
  return data
}
