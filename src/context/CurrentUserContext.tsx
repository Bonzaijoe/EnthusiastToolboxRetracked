import { createContext, useContext, useState, type ReactNode } from 'react'
import type { CurrentUser } from '../types'

const STORAGE_KEY = 'enthusiast-toolbox:current-user'

interface CurrentUserContextValue {
  currentUser: CurrentUser | null
  login: (user: CurrentUser) => void
  logout: () => void
  updateCurrentUser: (patch: Partial<CurrentUser>) => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(undefined)

function readStoredUser(): CurrentUser | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(readStoredUser)

  const login = (user: CurrentUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setCurrentUser(user)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUser(null)
  }

  // For settings saved elsewhere (e.g. Account) that should take effect
  // immediately without forcing a full re-login.
  const updateCurrentUser = (patch: Partial<CurrentUser>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <CurrentUserContext.Provider value={{ currentUser, login, logout, updateCurrentUser }}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext)
  if (!ctx) throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  return ctx
}
