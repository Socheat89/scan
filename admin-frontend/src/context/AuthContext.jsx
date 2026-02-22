import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || null)

  function login(userData, tokenData) {
    setUser(userData)
    setToken(tokenData)
    localStorage.setItem('admin_user', JSON.stringify(userData))
    localStorage.setItem('admin_token', tokenData)
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
