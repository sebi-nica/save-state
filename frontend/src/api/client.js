import axios from 'axios'

// Centralized HTTP client. The access token lives only in memory; the refresh token is an
// HTTP-only cookie the browser sends to /api/auth/ automatically.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({ baseURL, withCredentials: true })

let accessToken = null
let refreshPromise = null
let onSessionExpired = () => {}

export function setAccessToken(token) {
  accessToken = token
}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

// --- "Server waking up" signal -------------------------------------------------------------
// Render's free tier sleeps when idle; the first request can take ~50s. Any request slower than
// SLOW_MS (or waiting to be retried) counts as "waking" so the UI can show a banner.
export const SLOW_MS = 4000
const RETRY_DELAYS_MS = [1500, 4000]
const RETRYABLE_STATUS = [502, 503, 504]
let wakingCount = 0
const wakingListeners = new Set()

export function onServerWaking(listener) {
  wakingListeners.add(listener)
  return () => wakingListeners.delete(listener)
}

function changeWaking(delta) {
  wakingCount = Math.max(0, wakingCount + delta)
  wakingListeners.forEach((listener) => listener(wakingCount > 0))
}

function trackSlow(promise) {
  let slow = false
  const timer = setTimeout(() => {
    slow = true
    changeWaking(1)
  }, SLOW_MS)
  return promise.finally(() => {
    clearTimeout(timer)
    if (slow) changeWaking(-1)
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function isTransientError(error) {
  return !axios.isCancel(error) && (!error.response || RETRYABLE_STATUS.includes(error.response.status))
}

// --- Session refresh -----------------------------------------------------------------------
function postRefresh() {
  return trackSlow(axios.post(`${baseURL}/auth/refresh/`, null, { withCredentials: true })).then((res) => {
    setAccessToken(res.data.access)
    return res.data
  })
}

// Concurrent callers in this tab share one in-flight refresh. Across tabs, a Web Lock makes
// refreshes take turns: refresh tokens rotate, so two tabs refreshing at once would otherwise
// send the same token and the second would be rejected as blacklisted.
export function refreshSession() {
  if (!refreshPromise) {
    const run =
      typeof navigator !== 'undefined' && navigator.locks?.request
        ? navigator.locks.request('savestate-refresh', postRefresh)
        : postRefresh()
    refreshPromise = run.finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// --- Interceptors --------------------------------------------------------------------------
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  config._slowTimer = setTimeout(() => {
    config._slow = true
    changeWaking(1)
  }, SLOW_MS)
  return config
})

function settle(config) {
  if (!config) return
  clearTimeout(config._slowTimer)
  if (config._slow) {
    config._slow = false
    changeWaking(-1)
  }
}

const NO_REFRESH = ['/auth/login/', '/auth/register/', '/auth/refresh/', '/auth/logout/']

api.interceptors.response.use(
  (response) => {
    settle(response.config)
    return response
  },
  async (error) => {
    const original = error.config
    settle(original)
    if (!original) return Promise.reject(error)

    // Cold start / gateway hiccup: retry safe (read-only) requests with backoff.
    const method = (original.method || 'get').toLowerCase()
    const attempt = original._attempt || 0
    if (isTransientError(error) && ['get', 'head'].includes(method) && attempt < RETRY_DELAYS_MS.length) {
      original._attempt = attempt + 1
      changeWaking(1)
      try {
        await sleep(RETRY_DELAYS_MS[attempt])
      } finally {
        changeWaking(-1)
      }
      return api(original)
    }

    // Expired access token: refresh once, then replay the request.
    if (error.response?.status === 401 && !original._retried && !NO_REFRESH.includes(original.url)) {
      original._retried = true
      try {
        const data = await refreshSession()
        if (!data.access) throw new Error('No session')
        return api(original)
      } catch {
        setAccessToken(null)
        onSessionExpired()
      }
    }
    return Promise.reject(error)
  },
)

// Turn a DRF error response into one readable sentence.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error?.response) return 'Cannot reach the server. It may be waking up - try again in a moment.'
  const data = error.response.data
  if (error.response.status === 429) return 'Too many requests. Please wait a minute and try again.'
  if (!data || typeof data !== 'object') return fallback
  if (typeof data.detail === 'string') return data.detail
  const parts = Object.entries(data).map(([field, value]) => {
    const text = Array.isArray(value) ? value.join(' ') : String(value)
    return field === 'non_field_errors' ? text : `${field.replace(/_/g, ' ')}: ${text}`
  })
  return parts.join(' ') || fallback
}

export default api
