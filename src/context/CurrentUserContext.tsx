import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AppUser } from '../types'

const STORAGE_KEY = 'enthusiast-toolbox:current-user'

interface CurrentUserContextValue {
  currentUser: AppUser | null
  login: (user: AppUser) => void
  logout: () => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(undefined)

function readStoredUser(): AppUser | null {
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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(readStoredUser)

  const login = (user: AppUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setCurrentUser(user)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUser(null)
  }

  return (
    <CurrentUserContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext)
  if (!ctx) throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  return ctx
}
