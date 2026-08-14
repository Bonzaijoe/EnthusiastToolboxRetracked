import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'

function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin)
}

export function Account() {
  const { currentUser, updateCurrentUser } = useCurrentUser()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const [rankingThreshold, setRankingThreshold] = useState(currentUser?.rankingThreshold ?? 1)
  const [includeUnrated, setIncludeUnrated] = useState(currentUser?.includeUnrated ?? true)
  const [filtersError, setFiltersError] = useState<string | null>(null)
  const [filtersSuccess, setFiltersSuccess] = useState(false)
  const [savingFilters, setSavingFilters] = useState(false)

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

  async function handleSaveFilters(e: React.FormEvent) {
    e.preventDefault()
    setFiltersError(null)
    setFiltersSuccess(false)
    if (!currentUser) return

    setSavingFilters(true)
    const { error: updateError } = await supabase
      .from('users')
      .update({ ranking_threshold: rankingThreshold, include_unrated: includeUnrated })
      .eq('id', currentUser.id)
    setSavingFilters(false)

    if (updateError) {
      setFiltersError('Could not save these settings. Try again.')
      return
    }

    updateCurrentUser({ rankingThreshold, includeUnrated })
    setFiltersSuccess(true)
  }

  return (
    <div>
      <h1>Account Settings</h1>
      <p>Logged in as {currentUser?.name}.</p>

      <h2>My Rankings Filters</h2>
      <p>Don't want to rank all of your coasters? Set a minimum rating to filter out the garbage!</p>
      <form
        onSubmit={handleSaveFilters}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320, marginBottom: '2rem' }}
      >
        <label>
          Ranking Threshold (1-10)
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={rankingThreshold}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => setRankingThreshold(Math.min(10, Math.max(1, Number(e.target.value))))}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          Unrated Coasters
          <select
            value={includeUnrated ? 'include' : 'exclude'}
            onChange={(e) => setIncludeUnrated(e.target.value === 'include')}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          >
            <option value="include">Include on My Rankings Page</option>
            <option value="exclude">Exclude on My Rankings Page</option>
          </select>
        </label>
        {filtersError && <p style={{ color: 'crimson' }}>{filtersError}</p>}
        {filtersSuccess && <p style={{ color: 'seagreen' }}>Settings saved.</p>}
        <button type="submit" disabled={savingFilters}>
          {savingFilters ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <h2>Change PIN</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 320 }}
      >
        <label>
          Current PIN
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          New PIN
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          Confirm new PIN
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
