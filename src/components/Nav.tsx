import { NavLink, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../context/CurrentUserContext'

export function Nav() {
  const { currentUser, logout } = useCurrentUser()
  const navigate = useNavigate()

  if (!currentUser) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav>
      <NavLink to="/my-coasters">My Coasters</NavLink>
      <NavLink to="/my-rankings">My Rankings</NavLink>
      <NavLink to="/friends">Friends</NavLink>
      <NavLink to="/combined">Combined Rankings</NavLink>
      <NavLink to="/account">Account</NavLink>
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
        {currentUser.name} · <button onClick={handleLogout}>Log out</button>
      </span>
    </nav>
  )
}
