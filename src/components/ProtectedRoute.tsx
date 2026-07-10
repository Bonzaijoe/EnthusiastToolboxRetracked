import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../context/CurrentUserContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser } = useCurrentUser()
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}
