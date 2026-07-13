import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { EntryDiffReview, type DiffField } from './EntryDiffReview'
import { CoasterManualForm } from './CoasterManualForm'
import { formatYears } from '../utils/coasterDisplay'
import type { Coaster, Park } from '../types'

interface ParkManualFormProps {
  mode: 'add' | 'edit'
  initialPark?: Park
  onDone: (saved: Park) => void
  onCancel: () => void
}

function extractRcdbId(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/(\d+)\.htm/) ?? trimmed.match(/^\d+$/)
  return match ? Number(match[0].match(/\d+/)![0]) : null
}

function displayVal(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

export function ParkManualForm({ mode, initialPark, onDone, onCancel }: ParkManualFormProps) {
  const { currentUser } = useCurrentUser()
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [diffFields, setDiffFields] = useState<DiffField[]>([])
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null)

  const [name, setName] = useState(initialPark?.name ?? '')
  const [city, setCity] = useState(initialPark?.city ?? '')
  const [state, setState] = useState(initialPark?.state ?? '')
  const [country, setCountry] = useState(initialPark?.country ?? '')
  const [lat, setLat] = useState(initialPark?.lat != null ? String(initialPark.lat) : '')
  const [lng, setLng] = useState(initialPark?.lng != null ? String(initialPark.lng) : '')
  const [mainPictureUrl, setMainPictureUrl] = useState(initialPark?.main_picture_url ?? '')
  const [rcdbInput, setRcdbInput] = useState(initialPark?.rcdb_id ? String(initialPark.rcdb_id) : '')

  // Coasters-at-this-park management (only meaningful once the park has a real id).
  const [parkCoasters, setParkCoasters] = useState<Coaster[]>([])
  const [editingCoaster, setEditingCoaster] = useState<Coaster | 'new' | null>(null)

  async function loadParkCoasters() {
    if (!initialPark) return
    const { data } = await supabase.from('coasters').select('*').eq('park_id', initialPark.id).order('name')
    setParkCoasters((data as Coaster[]) ?? [])
  }

  useEffect(() => {
    loadParkCoasters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPark?.id])

  function buildDraft() {
    return {
      name: name.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      country: country.trim() || null,
      lat: lat.trim() ? Number(lat) : null,
      lng: lng.trim() ? Number(lng) : null,
      main_picture_url: mainPictureUrl.trim() || null,
      rcdb_id: extractRcdbId(rcdbInput),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    const draft = buildDraft()

    if (mode === 'add' && draft.rcdb_id) {
      const { data: existing } = await supabase.from('parks').select('id, name').eq('rcdb_id', draft.rcdb_id).maybeSingle()
      if (existing) {
        setError(
          `A park with this RCDB link already exists in the database ("${existing.name}"). Use Edit Entry on it instead of adding a duplicate.`,
        )
        return
      }
    }

    // Adding is a fresh record - nothing to compare against, so save immediately.
    // Only edits (which can overwrite existing data) go through the diff review.
    if (mode === 'add') {
      if (!currentUser) return
      setSaving(true)
      const finalRow = {
        ...draft,
        last_edited_by: currentUser.name,
        last_edited_at: new Date().toISOString(),
      }
      const result = await supabase.from('parks').insert(finalRow).select('*').single()
      setSaving(false)
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Save failed.')
        return
      }
      onDone(result.data as Park)
      return
    }

    const original = (initialPark ?? {}) as unknown as Record<string, unknown>
    const labels: Record<string, string> = {
      name: 'Name',
      city: 'City',
      state: 'State',
      country: 'Country',
      lat: 'Latitude',
      lng: 'Longitude',
      main_picture_url: 'Picture URL',
      rcdb_id: 'RCDB ID',
    }

    const fields: DiffField[] = []
    for (const [key, newValue] of Object.entries(draft)) {
      const oldValue = original[key] ?? null
      const oldStr = displayVal(oldValue)
      const newStr = displayVal(newValue)
      if (oldStr === newStr) continue
      fields.push({ key, label: labels[key] ?? key, oldValue: oldStr, newValue: newStr })
    }

    setDiffFields(fields)
    setPendingDraft(draft)
    setStep('review')
  }

  async function handleApply(acceptedKeys: Set<string>) {
    if (!pendingDraft || !currentUser) return
    setSaving(true)
    setError(null)

    const finalRow: Record<string, unknown> = { ...(initialPark ?? {}) }
    for (const key of Object.keys(pendingDraft)) {
      if (acceptedKeys.has(key)) finalRow[key] = pendingDraft[key]
    }
    finalRow.last_edited_by = currentUser.name
    finalRow.last_edited_at = new Date().toISOString()

    const result = await supabase.from('parks').update(finalRow).eq('id', initialPark!.id).select('*').single()

    setSaving(false)
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Save failed.')
      return
    }
    onDone(result.data as Park)
  }

  if (editingCoaster) {
    return (
      <CoasterManualForm
        mode={editingCoaster === 'new' ? 'add' : 'edit'}
        initialCoaster={editingCoaster === 'new' ? undefined : editingCoaster}
        presetParkId={initialPark?.id}
        presetParkName={initialPark?.name}
        onDone={() => {
          setEditingCoaster(null)
          loadParkCoasters()
        }}
        onCancel={() => setEditingCoaster(null)}
      />
    )
  }

  if (step === 'review') {
    return (
      <EntryDiffReview
        title={`Review: ${name}`}
        fields={diffFields}
        saving={saving}
        error={error}
        onCancel={() => setStep('form')}
        onApply={handleApply}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2>{mode === 'add' ? 'Add Park' : 'Edit Park'}</h2>

      <label>
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%' }} />
      </label>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <label style={{ flex: 1 }}>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label style={{ flex: 1 }}>
          State
          <input value={state} onChange={(e) => setState(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label style={{ flex: 1 }}>
          Country
          <input value={country} onChange={(e) => setCountry(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <label style={{ flex: 1 }}>
          Latitude
          <input value={lat} onChange={(e) => setLat(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label style={{ flex: 1 }}>
          Longitude
          <input value={lng} onChange={(e) => setLng(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
      </div>

      <label>
        Main picture URL
        <input
          value={mainPictureUrl}
          onChange={(e) => setMainPictureUrl(e.target.value)}
          style={{ display: 'block', width: '100%' }}
        />
      </label>

      <label>
        RCDB ID or link
        <input
          value={rcdbInput}
          onChange={(e) => setRcdbInput(e.target.value)}
          placeholder="e.g. https://rcdb.com/4529.htm or 4529"
          style={{ display: 'block', width: '100%' }}
        />
      </label>

      {initialPark && (
        <>
          <h3>Coasters at this park</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {parkCoasters.map((c) => (
              <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <span>
                  {c.name} {formatYears(c) && <span style={{ opacity: 0.7 }}>({formatYears(c)})</span>}
                </span>
                <button type="button" onClick={() => setEditingCoaster(c)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
          <p>
            <button type="button" onClick={() => setEditingCoaster('new')}>
              + Add coaster to this park
            </button>
          </p>
        </>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <p style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : mode === 'add' ? 'Add Park' : 'Continue to Review'}
        </button>
      </p>
    </form>
  )
}
