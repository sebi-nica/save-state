import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, { refreshSession, setAccessToken, setSessionExpiredHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the refresh cookie on page load.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null))
    refreshSession()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const startSession = useCallback((data) => {
    setAccessToken(data.access)
    setUser(data.user)
    return data.user
  }, [])

  const login = useCallback(
    async (username, password) => startSession((await api.post('/auth/login/', { username, password })).data),
    [startSession],
  )

  const register = useCallback(
    async (fields) => startSession((await api.post('/auth/register/', fields)).data),
    [startSession],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout/')
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, startSession, setUser }),
    [user, loading, login, register, logout, startSession],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
