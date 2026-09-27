import { expect, request as playwrightRequest } from '@playwright/test'

export async function openLogin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /sign in to cortexx/i })).toBeVisible({ timeout: 15_000 })
}

export async function enterCredentials(page, email, password) {
  const emailInput = page.getByLabel('Email')
  const passwordInput = page.getByLabel('Password')
  const submitButton = page.getByRole('button', { name: /^sign in$/i })
  await emailInput.click()
  await emailInput.pressSequentially(email)
  await passwordInput.click()
  await passwordInput.pressSequentially(password)
  await expect(emailInput).toHaveValue(email)
  await expect(passwordInput).toHaveValue(password)
  await expect(submitButton).toBeEnabled()
  return submitButton
}

export async function submitLogin(page) {
  const submitButton = page.getByRole('button', { name: /^sign in$/i })
  await expect(submitButton).toBeEnabled()
  await submitButton.click()
}

export async function signIn(page, email, password, { dashboard = false } = {}) {
  // Persona switches use a fresh API cookie jar, then copy only the resulting
  // Auth.js cookies into the browser context. This prevents stale session
  // cookies from a previous user contaminating RBAC journeys on mobile.
  await page.context().clearCookies()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const origin = new URL(page.url()).origin
  const authRequest = await playwrightRequest.newContext({ baseURL: origin })
  try {
    const csrfResponse = await authRequest.get('/api/auth/csrf')
    expect(csrfResponse.ok()).toBeTruthy()
    const { csrfToken } = await csrfResponse.json()
    expect(csrfToken).toBeTruthy()

    const callbackUrl = origin + '/dashboard'
    const response = await authRequest.post('/api/auth/callback/credentials', {
      headers: { 'X-Auth-Return-Redirect': '1' },
      form: { csrfToken, email, password, callbackUrl },
    })
    expect(response.ok()).toBeTruthy()
    const payload = await response.json()
    expect(new URL(payload.url).searchParams.get('error')).toBeNull()

    const isolatedSession = await authRequest.get('/api/auth/session')
    expect(isolatedSession.ok()).toBeTruthy()
    const isolated = await isolatedSession.json()
    expect(isolated.user?.email?.toLowerCase()).toBe(email.toLowerCase())

    const state = await authRequest.storageState()
    await page.context().clearCookies()
    await page.context().addCookies(state.cookies)

    const browserSession = await page.context().request.get(origin + '/api/auth/session')
    expect(browserSession.ok()).toBeTruthy()
    const session = await browserSession.json()
    expect(session.user?.email?.toLowerCase()).toBe(email.toLowerCase())
  } finally {
    await authRequest.dispose()
  }

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  if (dashboard) await expect(page).toHaveURL(/\/dashboard/)
}
