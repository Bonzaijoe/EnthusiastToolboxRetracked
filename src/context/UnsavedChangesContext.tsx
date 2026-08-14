import { createContext, useContext, useState, type ReactNode } from 'react'

// Lets a page (currently just My Rankings) flag that it has unsaved changes,
// so the nav bar can confirm before navigating away and losing them - the nav
// lives outside the routed page, so this is the simplest way for the two to
// talk without threading a prop through every route.
interface UnsavedChangesContextValue {
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (value: boolean) => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | undefined>(undefined)

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges }}>
      {children}
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext)
  if (!ctx) throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider')
  return ctx
}
