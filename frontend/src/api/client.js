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

// Concurrent callers share one in-flight refresh, so the rotating refresh token is used once.
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh/`, null, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.access)
        return res.data
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

const NO_RETRY = ['/auth/login/', '/auth/register/', '/auth/refresh/', '/auth/logout/']

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !NO_RETRY.includes(original.url)
    ) {
      original._retried = true
      try {
        await refreshSession()
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
  const data = error?.response?.data
  if (!error?.response) return 'Cannot reach the server. It may be waking up - try again in a moment.'
  if (!data || typeof data !== 'object') return fallback
  if (typeof data.detail === 'string') return data.detail
  const parts = Object.entries(data).map(([field, value]) => {
    const text = Array.isArray(value) ? value.join(' ') : String(value)
    return field === 'non_field_errors' ? text : `${field.replace(/_/g, ' ')}: ${text}`
  })
  return parts.join(' ') || fallback
}

export default api
