import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { EntryDiffReview, type DiffField } from './EntryDiffReview'
import { scrapeRcdb, type ScrapedCoaster } from '../utils/rcdbScrape'
import type { Coaster, CoasterStats } from '../types'

interface CoasterRcdbFormProps {
  mode: 'add' | 'edit'
  initialCoaster?: Coaster
  onDone: (saved: Coaster) => void
  onCancel: () => void
}

type Step = 'url' | 'loading' | 'preview' | 'review'

function displayVal(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

function statsSummary(stats: CoasterStats | null): string {
  if (!stats) return '—'
  return Object.entries(stats)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('; ')
}

export function CoasterRcdbForm({ mode, initialCoaster, onDone, onCancel }: CoasterRcdbFormProps) {
  const { currentUser } = useCurrentUser()
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState(initialCoaster?.rcdb_id ? `https://rcdb.com/${Math.floor(initialCoaster.rcdb_id)}.htm` : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [scraped, setScraped] = useState<ScrapedCoaster | null>(null)
  const [parkId, setParkId] = useState<number | null>(null)
  const [parkNeedsCreate, setParkNeedsCreate] = useState<{ name: string; rcdb_id: number } | null>(null)
  const [diffFields, setDiffFields] = useState<DiffField[]>([])
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null)

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!url.trim()) {
      setError('Paste an RCDB URL or id first.')
      return
    }
    setStep('loading')
    try {
      const result = await scrapeRcdb(url.trim())
      if (result.type !== 'coaster') {
        setError('That looks like a park link, not a coaster. Close this and use "Add Park"/"Edit Park" instead, or paste a link to the specific coaster page.')
        setStep('url')
        return
      }
      const coaster = result.coaster

      if (mode === 'add') {
        const { data: existing } = await supabase
          .from('coasters')
          .select('id, name')
          .eq('rcdb_id', coaster.rcdb_id)
          .maybeSingle()
        if (existing) {
          setError(`A coaster with this RCDB link already exists ("${existing.name}"). Use Edit Entry on it instead.`)
          setStep('url')
          return
        }
      }

      let resolvedParkId: number | null = null
      if (coaster.park) {
        const { data: parkRow } = await supabase.from('parks').select('id').eq('rcdb_id', coaster.park.rcdb_id).maybeSingle()
        if (parkRow) {
          resolvedParkId = parkRow.id
          setParkNeedsCreate(null)
        } else {
          setParkNeedsCreate({ name: coaster.park.name, rcdb_id: coaster.park.rcdb_id })
        }
      } else if (mode === 'edit') {
        resolvedParkId = initialCoaster?.park_id ?? null
      }
      setParkId(resolvedParkId)
      setScraped(coaster)

      if (mode === 'add') {
        setStep('preview')
        return
      }

      const draft = {
        name: coaster.name,
        park_id: resolvedParkId,
        make: coaster.make,
        model: coaster.model,
        type: coaster.type,
        design: coaster.design,
        status: coaster.status,
        opened_date: coaster.opened_date,
        closed_date: coaster.closed_date,
        main_picture_url: coaster.main_picture_url,
        rcdb_id: coaster.rcdb_id,
        rcdb_link: coaster.rcdb_link,
        stats: coaster.stats,
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
        const newStr = key === 'stats' ? JSON.stringify(newValue ?? {}) : key === 'park_id' ? coaster.park?.name ?? '' : displayVal(newValue)
        const oldCompare = key === 'park_id' ? String(original.park_id ?? '') : oldStr
        const newCompare = key === 'park_id' ? String(newValue ?? '') : newStr
        if (oldCompare === newCompare) continue
        fields.push({ key, label: labels[key] ?? key, oldValue: oldStr, newValue: newStr })
      }

      setDiffFields(fields)
      setPendingDraft(draft)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrape failed.')
      setStep('url')
    }
  }

  async function ensurePark(): Promise<number | null> {
    if (parkId) return parkId
    if (!parkNeedsCreate || !currentUser) return null
    const { data, error: insertError } = await supabase
      .from('parks')
      .insert({
        name: parkNeedsCreate.name,
        rcdb_id: parkNeedsCreate.rcdb_id,
        last_edited_by: currentUser.name,
        last_edited_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insertError || !data) {
      setError(`Could not create the park "${parkNeedsCreate.name}": ${insertError?.message ?? 'unknown error'}`)
      return null
    }
    return data.id
  }

  async function handleConfirmAdd() {
    if (!scraped || !currentUser) return
    setSaving(true)
    setError(null)

    const resolvedParkId = await ensurePark()
    if (!resolvedParkId) {
      setSaving(false)
      return
    }

    const finalRow = {
      name: scraped.name,
      park_id: resolvedParkId,
      make: scraped.make,
      model: scraped.model,
      type: scraped.type,
      design: scraped.design,
      status: scraped.status,
      opened_date: scraped.opened_date,
      closed_date: scraped.closed_date,
      main_picture_url: scraped.main_picture_url,
      rcdb_id: scraped.rcdb_id,
      rcdb_link: scraped.rcdb_link,
      stats: scraped.stats,
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
  }

  async function handleApplyEdit(acceptedKeys: Set<string>) {
    if (!pendingDraft || !currentUser || !initialCoaster) return
    setSaving(true)
    setError(null)

    let resolvedParkId = pendingDraft.park_id as number | null
    if (acceptedKeys.has('park_id') && parkNeedsCreate) {
      resolvedParkId = await ensurePark()
      if (!resolvedParkId) {
        setSaving(false)
        return
      }
    }

    const finalRow: Record<string, unknown> = { ...initialCoaster }
    for (const key of Object.keys(pendingDraft)) {
      if (!acceptedKeys.has(key)) continue
      finalRow[key] = key === 'park_id' ? resolvedParkId : pendingDraft[key]
    }
    finalRow.last_edited_by = currentUser.name
    finalRow.last_edited_at = new Date().toISOString()
    delete finalRow.park
    delete finalRow.id // identity column - can't be included in an update payload

    const result = await supabase
      .from('coasters')
      .update(finalRow)
      .eq('id', initialCoaster.id)
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
        title={`Review: ${scraped?.name ?? ''}`}
        fields={diffFields}
        saving={saving}
        error={error}
        onCancel={() => setStep('url')}
        onApply={handleApplyEdit}
      />
    )
  }

  if (step === 'preview' && scraped) {
    return (
      <div>
        <h2>Add Coaster From RCDB</h2>
        <p>Found on RCDB - review before adding:</p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <li><strong>Name:</strong> {scraped.name}</li>
          <li>
            <strong>Park:</strong> {scraped.park?.name ?? 'Unknown'}
            {parkNeedsCreate && <span style={{ opacity: 0.7 }}> (new - will also be added)</span>}
          </li>
          <li><strong>Manufacturer:</strong> {scraped.make || '—'}</li>
          <li><strong>Model:</strong> {scraped.model || '—'}</li>
          <li><strong>Type / Design:</strong> {[scraped.type, scraped.design].filter(Boolean).join(' / ') || '—'}</li>
          <li><strong>Status:</strong> {scraped.status || '—'}</li>
          <li><strong>Opened / Closed:</strong> {scraped.opened_date || '—'} / {scraped.closed_date || '—'}</li>
          <li><strong>Stats:</strong> {statsSummary(scraped.stats)}</li>
        </ul>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <p style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" onClick={() => setStep('url')} disabled={saving}>
            Back
          </button>
          <button type="button" onClick={handleConfirmAdd} disabled={saving}>
            {saving ? 'Adding...' : 'Looks good - Add it'}
          </button>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleFetch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2>{mode === 'add' ? 'Add' : 'Edit'} Coaster From RCDB</h2>
      <label>
        RCDB URL or id
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="e.g. https://rcdb.com/18313.htm or 18313"
          style={{ display: 'block', width: '100%' }}
        />
      </label>

      {step === 'loading' && <p>Fetching from RCDB - this may take a few seconds...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <p style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" onClick={onCancel} disabled={step === 'loading'}>
          Cancel
        </button>
        <button type="submit" disabled={step === 'loading'}>
          {step === 'loading' ? 'Fetching...' : 'Fetch from RCDB'}
        </button>
      </p>
    </form>
  )
}
