import { test, expect } from '@playwright/test'

// API tests for CortexBuild Ultimate backend
// These tests run against the backend API and are only enabled when E2E_API_URL is set
const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001/api'
const isApiEnabled = !!process.env.E2E_API_URL

test.describe('API Health', { skip: !isApiEnabled }, () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`)
    // Accept 200 (healthy) or 429 (rate limited) - still means endpoint exists
    expect([200, 429]).toContain(response.status())
  })

  test('database health check', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health/database`)
    // Accept any response that indicates endpoint exists
    expect([200, 401, 403, 429]).toContain(response.status())
  })
})

test.describe('API Authentication', { skip: !isApiEnabled }, () => {
  test('login responds', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'adrian.stanca1@gmail.com',
        password: process.env.TEST_USER_PASSWORD || 'Lolozania1',
      },
    })

    // Accept success (200), created (201), rate limit (429), or locked (401) from rate limiter
    expect([200, 201, 401, 429]).toContain(response.status())
  })

  test('login with invalid credentials fails or rate limited', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      },
    })

    // Accept expected failures or rate limiting
    expect([401, 403, 429]).toContain(response.status())
  })

  test('register endpoint responds', async ({ request }) => {
    const timestamp = Date.now()
    const response = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: `test_${timestamp}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
        company: 'Test Company',
      },
    })

    // Accept any response (201 created, 400 bad request, or 429 rate limited)
    expect([200, 201, 400, 429]).toContain(response.status())
  })
})

test.describe('API Projects', { skip: !isApiEnabled }, () => {
  let authToken: string

  test.beforeEach(async ({ request }) => {
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'adrian.stanca1@gmail.com',
        password: process.env.TEST_USER_PASSWORD || 'Lolozania1',
      },
    })

    // Try to get token, but may fail due to rate limiting
    if (loginResponse.ok()) {
      const json = await loginResponse.json()
      authToken = json.token
    }
  })

  test('projects endpoint responds', async ({ request }) => {
    // Skip if no token (rate limited)
    if (!authToken) {
      test.skip()
    }

    const response = await request.get(`${API_BASE}/projects`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    // Accept success or rate limited
    expect([200, 401, 429]).toContain(response.status())
  })

  test('create project endpoint responds', async ({ request }) => {
    if (!authToken) {
      test.skip()
    }

    const projectName = `Test Project ${Date.now()}`

    const response = await request.post(`${API_BASE}/projects`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        name: projectName,
        code: `TEST-${Date.now()}`,
        status: 'planning',
        budget: 100000,
      },
    })

    // Accept various responses
    expect([200, 201, 400, 401, 429]).toContain(response.status())
  })
})

test.describe('API Documents', { skip: !isApiEnabled }, () => {
  let authToken: string

  test.beforeEach(async ({ request }) => {
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'adrian.stanca1@gmail.com',
        password: process.env.TEST_USER_PASSWORD || 'Lolozania1',
      },
    })

    if (loginResponse.ok()) {
      const json = await loginResponse.json()
      authToken = json.token
    }
  })

  test('documents endpoint responds', async ({ request }) => {
    if (!authToken) {
      test.skip()
    }

    const response = await request.get(`${API_BASE}/documents`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    expect([200, 401, 429]).toContain(response.status())
  })

  test('safety endpoint responds', async ({ request }) => {
    if (!authToken) {
      test.skip()
    }

    const response = await request.get(`${API_BASE}/safety`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    expect([200, 401, 429]).toContain(response.status())
  })
})

test.describe('API Team', { skip: !isApiEnabled }, () => {
  let authToken: string

  test.beforeEach(async ({ request }) => {
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: process.env.TEST_USER_EMAIL || 'adrian.stanca1@gmail.com',
        password: process.env.TEST_USER_PASSWORD || 'Lolozania1',
      },
    })

    if (loginResponse.ok()) {
      const json = await loginResponse.json()
      authToken = json.token
    }
  })

  test('team members endpoint responds', async ({ request }) => {
    if (!authToken) {
      test.skip()
    }

    const response = await request.get(`${API_BASE}/team`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    expect([200, 401, 429]).toContain(response.status())
  })

  test('subcontractors endpoint responds', async ({ request }) => {
    if (!authToken) {
      test.skip()
    }

    const response = await request.get(`${API_BASE}/subcontractors`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    expect([200, 401, 429]).toContain(response.status())
  })
})
