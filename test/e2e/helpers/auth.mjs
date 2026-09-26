import { expect } from '@playwright/test'

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
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const origin = new URL(page.url()).origin
  const request = page.context().request
  const csrfResponse = await request.get(`${origin}/api/auth/csrf`)
  expect(csrfResponse.ok()).toBeTruthy()
  const { csrfToken } = await csrfResponse.json()
  expect(csrfToken).toBeTruthy()

  const callbackUrl = `${origin}/dashboard`
  const response = await request.post(`${origin}/api/auth/callback/credentials`, {
    headers: { 'X-Auth-Return-Redirect': '1' },
    form: { csrfToken, email, password, callbackUrl },
  })
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(new URL(payload.url).searchParams.get('error')).toBeNull()

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  if (dashboard) await expect(page).toHaveURL(/\/dashboard/)
}
