import type { AccountingConnection } from '@prisma/client'
import { prisma } from './db'
import { decryptXeroToken, encryptXeroToken, xeroTokenVaultConfigured } from './xero-token-vault'

type XeroTokenSet = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

export type XeroTenantConnection = {
  id: string
  authEventId?: string
  tenantId: string
  tenantType?: string
  tenantName?: string
  createdDateUtc?: string
  updatedDateUtc?: string
}

export class XeroApiError extends Error {
  status: number
  retryAfter: number | null
  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message)
    this.name = 'XeroApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

const TOKEN_URL = 'https://identity.xero.com/connect/token'
const CONNECTIONS_URL = 'https://api.xero.com/connections'
const API_BASE = 'https://api.xero.com/api.xro/2.0'

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

export function xeroPlatformConfig(origin?: string) {
  const clientId = process.env.XERO_CLIENT_ID || ''
  const clientSecret = process.env.XERO_CLIENT_SECRET || ''
  const base = process.env.NEXTAUTH_URL || process.env.APP_URL || origin || ''
  const redirectUri = process.env.XERO_REDIRECT_URI || (base ? `${base.replace(/\/+$/, '')}/api/integrations/xero/callback` : '')
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri && xeroTokenVaultConfigured()),
    missing: [
      !clientId && 'XERO_CLIENT_ID',
      !clientSecret && 'XERO_CLIENT_SECRET',
      !redirectUri && 'XERO_REDIRECT_URI/NEXTAUTH_URL',
      !xeroTokenVaultConfigured() && 'XERO_TOKEN_ENCRYPTION_KEY/CREDENTIAL_ENCRYPTION_KEY',
    ].filter(Boolean) as string[],
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { ...init, signal: controller.signal }) } finally { clearTimeout(timer) }
}

async function parseJsonOrText(response: Response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

async function tokenRequest(params: URLSearchParams, origin?: string): Promise<XeroTokenSet> {
  const cfg = xeroPlatformConfig(origin)
  if (!cfg.configured) throw new Error(`Xero platform integration is not configured: ${cfg.missing.join(', ')}`)
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(cfg.clientId, cfg.clientSecret), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params,
  })
  const body = await parseJsonOrText(response)
  if (!response.ok) throw new XeroApiError(`Xero token exchange failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`, response.status)
  return body as XeroTokenSet
}

export function exchangeXeroCode(code: string, origin?: string) {
  const cfg = xeroPlatformConfig(origin)
  return tokenRequest(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri }), origin)
}

export function refreshXeroTokens(refreshToken: string, origin?: string) {
  return tokenRequest(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }), origin)
}

export async function listXeroConnections(accessToken: string): Promise<XeroTenantConnection[]> {
  const response = await fetchWithTimeout(CONNECTIONS_URL, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })
  const body = await parseJsonOrText(response)
  if (!response.ok) throw new XeroApiError(`Xero connections failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`, response.status)
  return Array.isArray(body) ? body as XeroTenantConnection[] : []
}

export async function removeXeroConnection(accessToken: string, connectionId: string) {
  const response = await fetchWithTimeout(`${CONNECTIONS_URL}/${encodeURIComponent(connectionId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })
  if (!response.ok) {
    const body = await parseJsonOrText(response)
    throw new XeroApiError(`Xero disconnect failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`, response.status)
  }
}

function tokenExpiry(expiresIn?: number) { return new Date(Date.now() + Math.max(60, Number(expiresIn || 1800)) * 1000) }

export function encryptedTokenData(tokens: XeroTokenSet) {
  return {
    accessTokenCipher: encryptXeroToken(tokens.access_token),
    refreshTokenCipher: encryptXeroToken(tokens.refresh_token || null),
    accessTokenExpiresAt: tokenExpiry(tokens.expires_in),
    scopes: tokens.scope || null,
  }
}

export async function ensureXeroAccessToken(connection: AccountingConnection, forceRefresh = false): Promise<{ token: string; connection: AccountingConnection }> {
  const validUntil = connection.accessTokenExpiresAt?.getTime() || 0
  if (!forceRefresh && connection.accessTokenCipher && validUntil > Date.now() + 120_000) {
    return { token: decryptXeroToken(connection.accessTokenCipher), connection }
  }
  if (!connection.refreshTokenCipher) {
    await prisma.accountingConnection.update({ where: { id: connection.id }, data: { status: 'reauth_required', lastSyncError: 'Refresh token missing' } })
    throw new Error('Xero re-authorisation required')
  }
  try {
    const currentRefresh = decryptXeroToken(connection.refreshTokenCipher)
    const tokens = await refreshXeroTokens(currentRefresh)
    const tokenData = encryptedTokenData(tokens)
    const updated = await prisma.accountingConnection.update({
      where: { id: connection.id },
      data: {
        ...tokenData,
        refreshTokenCipher: tokens.refresh_token ? tokenData.refreshTokenCipher : connection.refreshTokenCipher,
        status: 'connected',
        lastSyncError: null,
      },
    })
    return { token: tokens.access_token, connection: updated }
  } catch (error) {
    await prisma.accountingConnection.update({ where: { id: connection.id }, data: { status: 'reauth_required', lastSyncError: error instanceof Error ? error.message.slice(0, 1000) : 'Token refresh failed' } })
    throw error
  }
}

async function apiCall(token: string, tenantId: string, path: string, init: RequestInit) {
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'xero-tenant-id': tenantId,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  return { response, body: await parseJsonOrText(response) }
}

export async function xeroApiRequest(connection: AccountingConnection, path: string, init: RequestInit = {}) {
  if (!connection.externalTenantId) throw new Error('Xero tenant is not linked')
  let current = await ensureXeroAccessToken(connection)
  let result = await apiCall(current.token, current.connection.externalTenantId || connection.externalTenantId, path, init)
  if (result.response.status === 401 && current.connection.refreshTokenCipher) {
    current = await ensureXeroAccessToken(current.connection, true)
    result = await apiCall(current.token, current.connection.externalTenantId || connection.externalTenantId, path, init)
  }
  if (!result.response.ok) {
    const retryHeader = result.response.headers.get('retry-after')
    const retryAfter = retryHeader && Number.isFinite(Number(retryHeader)) ? Number(retryHeader) : null
    const suffix = retryAfter != null ? ` retry-after=${retryAfter}s` : ''
    throw new XeroApiError(`Xero API ${path} failed (${result.response.status})${suffix}: ${typeof result.body === 'string' ? result.body : JSON.stringify(result.body)}`, result.response.status, retryAfter)
  }
  return result.body as Record<string, unknown>
}

export function safeXeroConnection(connection: AccountingConnection | null, importedCount = 0) {
  if (!connection) return null
  return {
    id: connection.id,
    provider: connection.provider,
    tenantId: connection.externalTenantId,
    tenantName: connection.externalTenantName,
    status: connection.status,
    scopes: connection.scopes?.split(' ').filter(Boolean) || [],
    settings: connection.settings,
    lastConnectedAt: connection.lastConnectedAt,
    lastHealthAt: connection.lastHealthAt,
    lastHealthError: connection.lastHealthError,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastSyncError: connection.lastSyncError,
    importedCount,
  }
}
