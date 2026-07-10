import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'

function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin)
}

export function Account() {
  const { currentUser } = useCurrentUser()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!currentUser) return
    if (!isValidPin(newPin)) {
      setError('New PIN must be exactly 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setError("New PIN and confirmation don't match.")
      return
    }

    setSaving(true)
    const { data, error: fetchError } = await supabase
      .from('users')
      .select('pin')
      .eq('id', currentUser.id)
      .single()

    if (fetchError || !data) {
      setSaving(false)
      setError('Could not verify your current PIN. Try again.')
      return
    }
    if (data.pin !== currentPin) {
      setSaving(false)
      setError('Current PIN is incorrect.')
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('id', currentUser.id)

    setSaving(false)
    if (updateError) {
      setError('Could not update PIN. Try again.')
      return
    }

    setSuccess(true)
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
  }

  return (
    <div>
      <h1>Account Settings</h1>
      <p>Logged in as {currentUser?.name}.</p>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}
      >
        <label>
          Current PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          New PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          Confirm new PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {success && <p style={{ color: 'seagreen' }}>PIN updated.</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Change PIN'}
        </button>
      </form>
    </div>
  )
}
