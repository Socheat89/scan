import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('user_token') || null)

  function login(userData, tokenData) {
    setUser(userData)
    setToken(tokenData)
    localStorage.setItem('user_user', JSON.stringify(userData))
    localStorage.setItem('user_token', tokenData)
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('user_user')
    localStorage.removeItem('user_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
