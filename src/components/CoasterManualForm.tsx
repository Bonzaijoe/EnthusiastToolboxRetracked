import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { EntryDiffReview, type DiffField } from './EntryDiffReview'
import type { Coaster, CoasterStats, Park } from '../types'

interface CoasterManualFormProps {
  mode: 'add' | 'edit'
  initialCoaster?: Coaster
  presetParkId?: number
  presetParkName?: string
  onDone: (saved: Coaster) => void
  onCancel: () => void
}

const COMMON_STAT_KEYS = ['height', 'speed', 'length', 'inversions', 'duration', 'gForce', 'drop', 'capacity'] as const
const STAT_LABELS: Record<string, string> = {
  height: 'Height',
  speed: 'Speed',
  length: 'Length',
  inversions: 'Inversions',
  duration: 'Duration',
  gForce: 'G-Force',
  drop: 'Drop',
  capacity: 'Capacity',
}

function extractRcdbId(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/(\d+)\.htm/) ?? trimmed.match(/^\d+$/)
  return match ? Number(match[0].match(/\d+/)![0]) : null
}

export function CoasterManualForm({
  mode,
  initialCoaster,
  presetParkId,
  presetParkName,
  onDone,
  onCancel,
}: CoasterManualFormProps) {
  const { currentUser } = useCurrentUser()
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [diffFields, setDiffFields] = useState<DiffField[]>([])
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null)

  const stats = (initialCoaster?.stats ?? {}) as CoasterStats
  const extraStats = Object.fromEntries(
    Object.entries(stats).filter(([k]) => !COMMON_STAT_KEYS.includes(k as (typeof COMMON_STAT_KEYS)[number])),
  )

  const [name, setName] = useState(initialCoaster?.name ?? '')
  const [parkId, setParkId] = useState<number | null>(initialCoaster?.park_id ?? presetParkId ?? null)
  const [parkQuery, setParkQuery] = useState(initialCoaster?.park?.name ?? presetParkName ?? '')
  const [parkResults, setParkResults] = useState<Park[]>([])
  const [make, setMake] = useState(initialCoaster?.make ?? '')
  const [model, setModel] = useState(initialCoaster?.model ?? '')
  const [type, setType] = useState(initialCoaster?.type ?? '')
  const [design, setDesign] = useState(initialCoaster?.design ?? '')
  const [status, setStatus] = useState(initialCoaster?.status ?? '')
  const [openedDate, setOpenedDate] = useState(initialCoaster?.opened_date ?? '')
  const [closedDate, setClosedDate] = useState(initialCoaster?.closed_date ?? '')
  const [mainPictureUrl, setMainPictureUrl] = useState(initialCoaster?.main_picture_url ?? '')
  const [rcdbInput, setRcdbInput] = useState(initialCoaster?.rcdb_id ? String(initialCoaster.rcdb_id) : '')
  const [statCommon, setStatCommon] = useState<Record<string, string>>(
    Object.fromEntries(COMMON_STAT_KEYS.map((k) => [k, (stats[k] as string) ?? ''])),
  )
  const [extraStatsJson, setExtraStatsJson] = useState(
    Object.keys(extraStats).length > 0 ? JSON.stringify(extraStats, null, 2) : '',
  )

  async function searchParks() {
    if (parkQuery.trim().length < 2) {
      setParkResults([])
      return
    }
    const { data } = await supabase.from('parks').select('*').ilike('name', `%${parkQuery.trim()}%`).limit(10)
    setParkResults((data as Park[]) ?? [])
  }

  function pickPark(p: Park) {
    setParkId(p.id)
    setParkQuery(p.name)
    setParkResults([])
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!parkId) {
      setError('Park is required - search and select one above.')
      return
    }

    const rcdbId = extractRcdbId(rcdbInput)

    if (mode === 'add' && !rcdbId) {
      setError('RCDB ID or link is required when adding a new coaster.')
      return
    }

    if (mode === 'add' && rcdbId) {
      const { data: existing } = await supabase.from('coasters').select('id, name').eq('rcdb_id', rcdbId).maybeSingle()
      if (existing) {
        setError(
          `A coaster with this RCDB link already exists in the database ("${existing.name}"). Use Edit Entry on it instead of adding a duplicate.`,
        )
        return
      }
    }

    let mergedStats: CoasterStats | null = null
    const extraParsed = extraStatsJson.trim() ? safeParseJson(extraStatsJson.trim()) : {}
    if (extraParsed === undefined) {
      setError('Additional stats JSON is not valid JSON.')
      return
    }
    const commonFiltered = Object.fromEntries(Object.entries(statCommon).filter(([, v]) => v.trim() !== ''))
    if (Object.keys(commonFiltered).length > 0 || Object.keys(extraParsed).length > 0) {
      mergedStats = { ...commonFiltered, ...extraParsed }
    }

    const draft = {
      name: name.trim(),
      park_id: parkId,
      make: make.trim() || null,
      model: model.trim() || null,
      type: type.trim() || null,
      design: design.trim() || null,
      status: status.trim() || null,
      opened_date: openedDate.trim() || null,
      closed_date: closedDate.trim() || null,
      main_picture_url: mainPictureUrl.trim() || null,
      rcdb_id: rcdbId,
      rcdb_link: rcdbId ? `/${rcdbId}.htm` : null,
      stats: mergedStats,
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
      const result = await supabase.from('coasters').insert(finalRow).select('*, park:parks(*)').single()
      setSaving(false)
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Save failed.')
        return
      }
      onDone(result.data as Coaster)
      return
    }

    const original = (initialCoaster ?? {}) as unknown as Record<string, unknown>
    const labels: Record<string, string> = {
      name: 'Name',
      park_id: 'Park',
      make: 'Manufacturer',
      model: 'Model',
      type: 'Type',
      design: 'Design',
      status: 'Status',
      opened_date: 'Opened',
      closed_date: 'Closed',
      main_picture_url: 'Picture URL',
      rcdb_id: 'RCDB ID',
      stats: 'Stats',
    }

    const fields: DiffField[] = []
    for (const [key, newValue] of Object.entries(draft)) {
      if (key === 'rcdb_link') continue
      const oldValue = original[key] ?? null
      const oldStr = key === 'stats' ? JSON.stringify(oldValue ?? {}) : displayVal(oldValue)
      const newStr =
        key === 'stats' ? JSON.stringify(newValue ?? {}) : key === 'park_id' ? parkQuery : displayVal(newValue)
      const oldCompare = key === 'park_id' ? String(original.park_id ?? '') : oldStr
      const newCompare = key === 'park_id' ? String(newValue ?? '') : newStr
      if (oldCompare === newCompare) continue
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

    const finalRow: Record<string, unknown> = { ...(initialCoaster ?? {}) }
    for (const key of Object.keys(pendingDraft)) {
      if (acceptedKeys.has(key)) finalRow[key] = pendingDraft[key]
    }
    if (acceptedKeys.has('rcdb_id')) finalRow.rcdb_link = pendingDraft.rcdb_link
    finalRow.last_edited_by = currentUser.name
    finalRow.last_edited_at = new Date().toISOString()
    delete finalRow.park // drop any embedded relation from initialCoaster
    delete finalRow.id // identity column - can't be included in an update payload

    const result = await supabase
      .from('coasters')
      .update(finalRow)
      .eq('id', initialCoaster!.id)
      .select('*, park:parks(*)')
      .single()

    setSaving(false)
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Save failed.')
      return
    }
    onDone(result.data as Coaster)
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
    <form onSubmit={handleContinue} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2>{mode === 'add' ? 'Add Coaster' : 'Edit Coaster'}</h2>

      <label>
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%' }} />
      </label>

      <label>
        Park *
        <input
          value={parkQuery}
          onChange={(e) => {
            setParkQuery(e.target.value)
            setParkId(null)
          }}
          onBlur={searchParks}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchParks())}
          placeholder="Search for a park..."
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      {parkResults.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, border: '1px solid rgba(128,128,128,0.3)' }}>
          {parkResults.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pickPark(p)}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <label style={{ flex: 1 }}>
          Manufacturer
          <input value={make} onChange={(e) => setMake(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label style={{ flex: 1 }}>
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <label style={{ flex: 1 }}>
          Type
          <input value={type} onChange={(e) => setType(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label style={{ flex: 1 }}>
          Design
          <input value={design} onChange={(e) => setDesign(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
      </div>

      <label>
        Status
        <input
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          list="status-options"
          placeholder="e.g. Operating, Removed, SBNO"
          style={{ display: 'block', width: '100%' }}
        />
        <datalist id="status-options">
          <option value="Operating" />
          <option value="Operated" />
          <option value="Under Construction" />
          <option value="SBNO" />
          <option value="In Storage" />
        </datalist>
      </label>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <label style={{ flex: 1 }}>
          Opened
          <input value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} style={{ display: 'block', width: '100%' }} />
        </label>
        <label style={{ flex: 1 }}>
          Closed
          <input value={closedDate} onChange={(e) => setClosedDate(e.target.value)} style={{ display: 'block', width: '100%' }} />
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
        RCDB ID or link{mode === 'add' && ' *'}
        <input
          value={rcdbInput}
          onChange={(e) => setRcdbInput(e.target.value)}
          placeholder="e.g. https://rcdb.com/18313.htm or 18313"
          style={{ display: 'block', width: '100%' }}
        />
      </label>

      <h3>Stats (optional)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {COMMON_STAT_KEYS.map((key) => (
          <label key={key}>
            {STAT_LABELS[key]}
            <input
              value={statCommon[key]}
              onChange={(e) => setStatCommon((prev) => ({ ...prev, [key]: e.target.value }))}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        ))}
      </div>
      <label>
        Additional stats (JSON, optional)
        <textarea
          value={extraStatsJson}
          onChange={(e) => setExtraStatsJson(e.target.value)}
          rows={3}
          style={{ display: 'block', width: '100%', fontFamily: 'monospace' }}
        />
      </label>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <p style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : mode === 'add' ? 'Add Coaster' : 'Continue to Review'}
        </button>
      </p>
    </form>
  )
}

function displayVal(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function safeParseJson(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}
