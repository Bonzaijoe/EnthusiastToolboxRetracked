import { NavLink, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../context/CurrentUserContext'
import { useUnsavedChanges } from '../context/UnsavedChangesContext'

const UNSAVED_WARNING = "You have unsaved changes on My Rankings that haven't been saved. Leave anyway?"

export function Nav() {
  const { currentUser, logout } = useCurrentUser()
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges()
  const navigate = useNavigate()

  if (!currentUser) return null

  // Every nav link and Log out goes through this - react-router's plain
  // <BrowserRouter> (not a data router) has no built-in navigation blocking,
  // so this in-app confirm plus the beforeunload guard in MyRankings.tsx
  // (for tab close/refresh/typed URLs) together cover both ways of leaving.
  function guardedNavigate(to: string) {
    if (hasUnsavedChanges && !window.confirm(UNSAVED_WARNING)) return
    setHasUnsavedChanges(false)
    navigate(to)
  }

  const handleLogout = () => {
    if (hasUnsavedChanges && !window.confirm(UNSAVED_WARNING)) return
    setHasUnsavedChanges(false)
    logout()
    navigate('/login')
  }

  function navLink(to: string, label: string) {
    return (
      <NavLink
        to={to}
        onClick={(e) => {
          e.preventDefault()
          guardedNavigate(to)
        }}
      >
        {label}
      </NavLink>
    )
  }

  return (
    <nav>
      {navLink('/my-coasters', 'My Coasters')}
      {navLink('/my-rankings', 'My Rankings')}
      {navLink('/database', 'Database')}
      {navLink('/friends', 'Friends')}
      {navLink('/combined', 'Combined Rankings')}
      {navLink('/account', 'Account')}
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
        {currentUser.name} · <button onClick={handleLogout}>Log out</button>
      </span>
    </nav>
  )
}
