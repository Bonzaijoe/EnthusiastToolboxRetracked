import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { ToolboxIcon } from '../components/ToolboxIcon'
import type { AppUser } from '../types'

export function Login() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { currentUser, login } = useCurrentUser()
  const navigate = useNavigate()

  useEffect(() => {
    // Test accounts (e.g. "Dev") only show up in the login list during local
    // development - import.meta.env.DEV is false in the deployed GitHub Pages build.
    let query = supabase.from('users').select('id, name, is_test_account').order('name')
    if (!import.meta.env.DEV) query = query.eq('is_test_account', false)

    query.then(({ data, error }) => {
      if (error) {
        setError(error.message)
        return
      }
      setUsers(data ?? [])
      if (data && data.length > 0) setSelectedUserId(data[0].id)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedUserId === null) return
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('users')
      .select('id, name, pin')
      .eq('id', selectedUserId)
      .single()

    setLoading(false)

    if (error || !data) {
      setError('Could not check that PIN. Try again.')
      return
    }
    if (data.pin !== pin) {
      setError('Wrong PIN.')
      return
    }

    login({ id: data.id, name: data.name })
    navigate('/my-coasters')
  }

  if (currentUser) return <Navigate to="/my-coasters" replace />

  return (
    <div className="login-page">
      <div className="login-brand">
        <ToolboxIcon />
        <h1 className="brand-title">Enthusiast Toolbox</h1>
        <div className="brand-subtitle">Retracked</div>
      </div>
      <h2>Log in</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          Who are you?
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          PIN
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={loading || selectedUserId === null}>
          {loading ? 'Checking...' : 'Log in'}
        </button>
      </form>
      <Link to="/patch-notes" style={{ opacity: 0.7 }}>
        Patch Notes
      </Link>
    </div>
  )
}
