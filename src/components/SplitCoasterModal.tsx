import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import type { Coaster, Park } from '../types'

interface SplitCoasterModalProps {
  coaster: Coaster & { park: Park | null }
  onClose: () => void
  onDone: (updatedOriginal: Coaster & { park: Park | null }) => void
}

// Some RCDB pages actually cover two distinct rides (e.g. Dragon Challenge,
// Top Thrill Dragster/Top Thrill 2). Splitting keeps the left/original entry
// - same id, same rcdb_id, all its existing ratings/rankings untouched - and
// creates a new right-hand entry with no rider history yet, sharing the same
// underlying RCDB page via a decimal-suffixed rcdb_id (123, 123.1, 123.2...)
// so the unique constraint on rcdb_id stays intact.
export function SplitCoasterModal({ coaster, onClose, onDone }: SplitCoasterModalProps) {
  const { currentUser } = useCurrentUser()
  const [leftName, setLeftName] = useState(coaster.name)
  const [rightName, setRightName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSplit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!leftName.trim() || !rightName.trim()) {
      setError('Both names are required.')
      return
    }
    if (!coaster.rcdb_id) {
      setError('This coaster has no RCDB link on file, so there is no shared page to split from.')
      return
    }
    if (!currentUser) return

    setSaving(true)

    const base = Math.floor(coaster.rcdb_id)
    const { data: siblings, error: siblingsError } = await supabase
      .from('coasters')
      .select('rcdb_id')
      .gte('rcdb_id', base)
      .lt('rcdb_id', base + 1)

    if (siblingsError) {
      setSaving(false)
      setError(siblingsError.message)
      return
    }

    const maxExisting = Math.max(base, ...(siblings ?? []).map((s) => Number(s.rcdb_id)))
    const newRcdbId = Math.round((maxExisting + 0.1) * 10) / 10

    const now = new Date().toISOString()

    const [updateResult, insertResult] = await Promise.all([
      supabase
        .from('coasters')
        .update({ name: leftName.trim(), last_edited_by: currentUser.name, last_edited_at: now })
        .eq('id', coaster.id)
        .select('*, park:parks(*)')
        .single(),
      supabase
        .from('coasters')
        .insert({
          name: rightName.trim(),
          park_id: coaster.park_id,
          make: coaster.make,
          model: coaster.model,
          type: coaster.type,
          design: coaster.design,
          status: coaster.status,
          opened_date: coaster.opened_date,
          closed_date: coaster.closed_date,
          stats: coaster.stats,
          main_picture_url: coaster.main_picture_url,
          rcdb_id: newRcdbId,
          rcdb_link: coaster.rcdb_link,
          last_edited_by: currentUser.name,
          last_edited_at: now,
        })
        .select('*, park:parks(*)')
        .single(),
    ])

    setSaving(false)

    if (updateResult.error || !updateResult.data) {
      setError(updateResult.error?.message ?? 'Failed to update the original entry.')
      return
    }
    if (insertResult.error || !insertResult.data) {
      setError(insertResult.error?.message ?? 'Failed to create the new entry.')
      return
    }

    onDone(updateResult.data as Coaster & { park: Park | null })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 960 }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          background: 'Canvas',
          color: 'CanvasText',
          border: '1px solid rgba(128, 128, 128, 0.4)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 480,
          width: '92%',
          margin: '4rem auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem' }} aria-label="Close">
          ✕
        </button>

        <h2>Split Coaster Entry</h2>
        <p style={{ opacity: 0.8 }}>
          For RCDB pages that actually cover two distinct rides. The left entry keeps this coaster's id and all
          existing ratings/rankings. The right entry is brand new with no rider history yet.
        </p>

        <form onSubmit={handleSplit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label>
            Left (keeps existing data)
            <input
              value={leftName}
              onChange={(e) => setLeftName(e.target.value)}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          <label>
            Right (new, no data yet)
            <input
              value={rightName}
              onChange={(e) => setRightName(e.target.value)}
              placeholder="Name for the new split-off entry"
              style={{ display: 'block', width: '100%' }}
            />
          </label>

          {error && <p style={{ color: 'crimson' }}>{error}</p>}

          <p>
            <button type="submit" disabled={saving}>
              {saving ? 'Splitting...' : 'Split Entry'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
