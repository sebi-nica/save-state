import axios, { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api, {
  SLOW_MS,
  errorMessage,
  onServerWaking,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from './client'

// A fake HTTP layer shared by the `api` instance and the bare axios used for refreshes.
// `routes` maps "METHOD /api/path" to a handler (config) => [status, data] | 'network' | Promise.
let routes
let calls

function pathOf(config) {
  return config.url.startsWith('/api') ? config.url : `${config.baseURL}${config.url}`
}

async function adapter(config) {
  const key = `${config.method.toUpperCase()} ${pathOf(config)}`
  calls.push({ key, auth: config.headers?.Authorization })
  const handler = routes[key]
  if (!handler) throw new Error(`Unexpected request: ${key}`)
  const result = await handler(config)
  if (result === 'network') throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  const [status, data] = result
  const response = { data, status, statusText: '', headers: {}, config }
  if (status >= 400) throw new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, null, response)
  return response
}

const count = (key) => calls.filter((c) => c.key === key).length

beforeEach(() => {
  routes = {}
  calls = []
  axios.defaults.adapter = adapter
  api.defaults.adapter = adapter
  setAccessToken('old')
  setSessionExpiredHandler(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('token refresh', () => {
  it('refreshes once on 401 and replays the request with the new token', async () => {
    routes['GET /api/library/'] = (c) => (c.headers.Authorization === 'Bearer new' ? [200, ['ok']] : [401, {}])
    routes['POST /api/auth/refresh/'] = () => [200, { access: 'new', user: { username: 'a' } }]

    const res = await api.get('/library/')

    expect(res.data).toEqual(['ok'])
    expect(count('POST /api/auth/refresh/')).toBe(1)
    expect(calls.map((c) => c.auth)).toEqual(['Bearer old', undefined, 'Bearer new'])
  })

  it('shares one refresh between concurrent 401s', async () => {
    routes['GET /api/library/'] = (c) => (c.headers.Authorization === 'Bearer new' ? [200, 'lib'] : [401, {}])
    routes['GET /api/recommendations/'] = (c) => (c.headers.Authorization === 'Bearer new' ? [200, 'recs'] : [401, {}])
    routes['POST /api/auth/refresh/'] = () => new Promise((r) => setTimeout(() => r([200, { access: 'new' }]), 10))

    const results = await Promise.all([api.get('/library/'), api.get('/recommendations/')])

    expect(results.map((r) => r.data)).toEqual(['lib', 'recs'])
    expect(count('POST /api/auth/refresh/')).toBe(1)
  })

  it('reports an expired session when the refresh fails', async () => {
    const expired = vi.fn()
    setSessionExpiredHandler(expired)
    routes['GET /api/library/'] = () => [401, {}]
    routes['POST /api/auth/refresh/'] = () => [401, { detail: 'Session expired.' }]

    await expect(api.get('/library/')).rejects.toMatchObject({ response: { status: 401 } })
    expect(expired).toHaveBeenCalledTimes(1)
    expect(count('GET /api/library/')).toBe(1)
  })

  it('treats a refresh without a session as expired', async () => {
    const expired = vi.fn()
    setSessionExpiredHandler(expired)
    routes['GET /api/library/'] = () => [401, {}]
    routes['POST /api/auth/refresh/'] = () => [200, { access: null, user: null }]

    await expect(api.get('/library/')).rejects.toBeTruthy()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('does not try to refresh after a failed login', async () => {
    routes['POST /api/auth/login/'] = () => [401, { detail: 'No active account' }]
    await expect(api.post('/auth/login/', {})).rejects.toBeTruthy()
    expect(count('POST /api/auth/refresh/')).toBe(0)
  })

  it('serializes refreshes through a Web Lock when available', async () => {
    const request = vi.fn((name, fn) => fn())
    vi.stubGlobal('navigator', { locks: { request } })
    routes['POST /api/auth/refresh/'] = () => [200, { access: 'new', user: null }]

    await refreshSession()

    expect(request).toHaveBeenCalledWith('savestate-refresh', expect.any(Function))
  })
})

describe('cold starts', () => {
  it('retries GETs on network errors and gateway timeouts, signalling "waking"', async () => {
    vi.useFakeTimers()
    const states = []
    const unsubscribe = onServerWaking((waking) => states.push(waking))
    const answers = ['network', [504, ''], [200, 'finally']]
    routes['GET /api/library/'] = () => answers.shift()

    const pending = api.get('/library/')
    await vi.runAllTimersAsync()
    const res = await pending
    unsubscribe()

    expect(res.data).toBe('finally')
    expect(count('GET /api/library/')).toBe(3)
    expect(states).toContain(true)
    expect(states.at(-1)).toBe(false)
  })

  it('gives up after two retries', async () => {
    vi.useFakeTimers()
    routes['GET /api/library/'] = () => [503, '']
    const pending = api.get('/library/').catch((e) => e)
    await vi.runAllTimersAsync()
    expect((await pending).response.status).toBe(503)
    expect(count('GET /api/library/')).toBe(3)
  })

  it('never retries non-idempotent requests', async () => {
    routes['POST /api/library/'] = () => [503, '']
    await expect(api.post('/library/', {})).rejects.toBeTruthy()
    expect(count('POST /api/library/')).toBe(1)
  })

  it('signals "waking" while a request is slow', async () => {
    vi.useFakeTimers()
    const states = []
    const unsubscribe = onServerWaking((waking) => states.push(waking))
    let finish
    routes['GET /api/library/'] = () => new Promise((resolve) => (finish = resolve))

    const pending = api.get('/library/')
    await vi.advanceTimersByTimeAsync(SLOW_MS + 10)
    expect(states).toEqual([true])

    finish([200, []])
    await pending
    unsubscribe()
    expect(states).toEqual([true, false])
  })
})

describe('errorMessage', () => {
  const err = (status, data) => ({ response: { status, data } })

  it('handles missing responses, rate limits and detail messages', () => {
    expect(errorMessage({})).toMatch(/Cannot reach the server/)
    expect(errorMessage(err(429, { detail: 'Throttled' }))).toMatch(/Too many requests/)
    expect(errorMessage(err(400, { detail: 'Nope.' }))).toBe('Nope.')
  })

  it('joins field errors into one sentence', () => {
    expect(errorMessage(err(400, { email: ['This email is already in use.'], non_field_errors: ['Bad.'] }))).toBe(
      'email: This email is already in use. Bad.',
    )
  })

  it('falls back for non-JSON bodies', () => {
    expect(errorMessage(err(500, '<html>'), 'Fallback')).toBe('Fallback')
  })
})
