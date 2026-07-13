import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { EntryDiffReview, type DiffField } from './EntryDiffReview'
import { scrapeRcdb, type ScrapedCoaster, type ScrapedPark } from '../utils/rcdbScrape'
import type { Coaster, Park } from '../types'

interface ParkRcdbFormProps {
  mode: 'add' | 'edit'
  initialPark?: Park
  onDone: (saved: Park) => void
  onCancel: () => void
}

type Step = 'url' | 'loading' | 'park-preview' | 'park-review' | 'coasters'

interface CoasterRow {
  scraped: ScrapedCoaster
  existing: Coaster | null
  include: boolean
  diffFields: DiffField[]
}

function displayVal(v: unknown): string {
  return v === null || v === undefined ? '' : String(v)
}

const SCRAPED_COASTER_LABELS: Record<string, string> = {
  name: 'Name',
  make: 'Manufacturer',
  model: 'Model',
  type: 'Type',
  design: 'Design',
  status: 'Status',
  opened_date: 'Opened',
  closed_date: 'Closed',
  main_picture_url: 'Picture URL',
  stats: 'Stats',
}

// Diffs a scraped coaster against the row already in our DB (if any) so each
// row in the cascade checklist can show exactly what would change - not just
// a blanket "update" label. With no existing row, every non-empty scraped
// field shows as new so the same table doubles as a plain preview.
function buildCoasterDiff(scraped: ScrapedCoaster, existing: Coaster | null): DiffField[] {
  const draft: Record<string, unknown> = {
    name: scraped.name,
    make: scraped.make,
    model: scraped.model,
    type: scraped.type,
    design: scraped.design,
    status: scraped.status,
    opened_date: scraped.opened_date,
    closed_date: scraped.closed_date,
    main_picture_url: scraped.main_picture_url,
    stats: scraped.stats,
  }
  const original = (existing ?? {}) as unknown as Record<string, unknown>
  const fields: DiffField[] = []
  for (const [key, newValue] of Object.entries(draft)) {
    const oldStr = key === 'stats' ? JSON.stringify(original[key] ?? {}) : displayVal(original[key] ?? null)
    const newStr = key === 'stats' ? JSON.stringify(newValue ?? {}) : displayVal(newValue)
    if (oldStr === newStr) continue
    fields.push({ key, label: SCRAPED_COASTER_LABELS[key] ?? key, oldValue: oldStr, newValue: newStr })
  }
  return fields
}

export function ParkRcdbForm({ mode, initialPark, onDone, onCancel }: ParkRcdbFormProps) {
  const { currentUser } = useCurrentUser()
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState(initialPark?.rcdb_id ? `https://rcdb.com/${initialPark.rcdb_id}.htm` : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [scrapedPark, setScrapedPark] = useState<ScrapedPark | null>(null)
  const [diffFields, setDiffFields] = useState<DiffField[]>([])
  const [pendingParkDraft, setPendingParkDraft] = useState<Record<string, unknown> | null>(null)
  const [acceptedParkKeys, setAcceptedParkKeys] = useState<Set<string>>(new Set())
  const [coasterRows, setCoasterRows] = useState<CoasterRow[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

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
      if (result.type !== 'park') {
        setError('That looks like a coaster link, not a park. Close this and use "Add Coaster"/"Edit Coaster" instead, or paste a link to the park\'s own page.')
        setStep('url')
        return
      }

      if (mode === 'add') {
        const { data: existing } = await supabase.from('parks').select('id, name').eq('rcdb_id', result.park.rcdb_id).maybeSingle()
        if (existing) {
          setError(`A park with this RCDB link already exists ("${existing.name}"). Use Edit Entry on it instead.`)
          setStep('url')
          return
        }
      }

      const scrapedIds = result.coasters.map((c) => c.rcdb_id)
      const { data: existingCoasters } =
        scrapedIds.length > 0
          ? await supabase.from('coasters').select('*').in('rcdb_id', scrapedIds)
          : { data: [] as Coaster[] }
      const existingByRcdbId = new Map((existingCoasters ?? []).map((c) => [c.rcdb_id, c as Coaster]))

      setScrapedPark(result.park)
      setExpandedIds(new Set())
      setCoasterRows(
        result.coasters.map((c) => {
          const existing = existingByRcdbId.get(c.rcdb_id) ?? null
          return { scraped: c, existing, include: true, diffFields: buildCoasterDiff(c, existing) }
        }),
      )

      if (mode === 'add') {
        setPendingParkDraft({
          name: result.park.name,
          city: result.park.city,
          state: result.park.state,
          country: result.park.country,
          lat: result.park.lat,
          lng: result.park.lng,
          main_picture_url: result.park.main_picture_url,
          rcdb_id: result.park.rcdb_id,
        })
        setStep('park-preview')
        return
      }

      const draft = {
        name: result.park.name,
        city: result.park.city,
        state: result.park.state,
        country: result.park.country,
        lat: result.park.lat,
        lng: result.park.lng,
        main_picture_url: result.park.main_picture_url,
        rcdb_id: result.park.rcdb_id,
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
      setPendingParkDraft(draft)
      setStep('park-review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrape failed.')
      setStep('url')
    }
  }

  function proceedToCoasters(acceptedKeys?: Set<string>) {
    if (acceptedKeys) setAcceptedParkKeys(acceptedKeys)
    else setAcceptedParkKeys(new Set(Object.keys(pendingParkDraft ?? {})))
    setStep('coasters')
  }

  function toggleCoaster(rcdbId: number) {
    setCoasterRows((prev) => prev.map((r) => (r.scraped.rcdb_id === rcdbId ? { ...r, include: !r.include } : r)))
  }

  function toggleExpanded(rcdbId: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(rcdbId)) next.delete(rcdbId)
      else next.add(rcdbId)
      return next
    })
  }

  async function handleFinalApply() {
    if (!pendingParkDraft || !currentUser) return
    setSaving(true)
    setError(null)

    let parkId: number
    if (mode === 'add') {
      const result = await supabase
        .from('parks')
        .insert({ ...pendingParkDraft, last_edited_by: currentUser.name, last_edited_at: new Date().toISOString() })
        .select('*')
        .single()
      if (result.error || !result.data) {
        setSaving(false)
        setError(result.error?.message ?? 'Failed to save the park.')
        return
      }
      parkId = result.data.id
    } else {
      const finalRow: Record<string, unknown> = { ...(initialPark ?? {}) }
      for (const key of Object.keys(pendingParkDraft)) {
        if (acceptedParkKeys.has(key)) finalRow[key] = pendingParkDraft[key]
      }
      finalRow.last_edited_by = currentUser.name
      finalRow.last_edited_at = new Date().toISOString()
      delete finalRow.id // identity column - can't be included in an update payload
      const result = await supabase.from('parks').update(finalRow).eq('id', initialPark!.id).select('*').single()
      if (result.error || !result.data) {
        setSaving(false)
        setError(result.error?.message ?? 'Failed to save the park.')
        return
      }
      parkId = result.data.id
    }

    for (const row of coasterRows) {
      if (!row.include) continue
      const c = row.scraped
      const coasterRow = {
        name: c.name,
        park_id: parkId,
        make: c.make,
        model: c.model,
        type: c.type,
        design: c.design,
        status: c.status,
        opened_date: c.opened_date,
        closed_date: c.closed_date,
        main_picture_url: c.main_picture_url,
        rcdb_id: c.rcdb_id,
        rcdb_link: c.rcdb_link,
        stats: c.stats,
        last_edited_by: currentUser.name,
        last_edited_at: new Date().toISOString(),
      }
      if (row.existing) {
        await supabase.from('coasters').update(coasterRow).eq('id', row.existing.id)
      } else {
        await supabase.from('coasters').insert(coasterRow)
      }
    }

    setSaving(false)
    const { data: savedPark } = await supabase.from('parks').select('*').eq('id', parkId).single()
    onDone((savedPark as Park) ?? { ...(initialPark as Park), id: parkId })
  }

  if (step === 'park-review') {
    return (
      <EntryDiffReview
        title={`Review park: ${scrapedPark?.name ?? ''}`}
        fields={diffFields}
        saving={false}
        error={error}
        onCancel={() => setStep('url')}
        onApply={proceedToCoasters}
      />
    )
  }

  if (step === 'park-preview' && scrapedPark) {
    return (
      <div>
        <h2>Add Park From RCDB</h2>
        <p>Found on RCDB - review before adding:</p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <li><strong>Name:</strong> {scrapedPark.name}</li>
          <li><strong>Location:</strong> {[scrapedPark.city, scrapedPark.state, scrapedPark.country].filter(Boolean).join(', ') || '—'}</li>
          <li><strong>Coordinates:</strong> {scrapedPark.lat && scrapedPark.lng ? `${scrapedPark.lat}, ${scrapedPark.lng}` : '—'}</li>
          <li><strong>Coasters found:</strong> {coasterRows.length}</li>
        </ul>
        <p style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" onClick={() => setStep('url')}>
            Back
          </button>
          <button type="button" onClick={() => proceedToCoasters()}>
            Continue
          </button>
        </p>
      </div>
    )
  }

  if (step === 'coasters') {
    const newCount = coasterRows.filter((r) => !r.existing).length
    const upToDateCount = coasterRows.filter((r) => r.existing && r.diffFields.length === 0).length
    const updateCount = coasterRows.filter((r) => r.existing && r.diffFields.length > 0).length
    return (
      <div>
        <h2>Coasters at {scrapedPark?.name}</h2>
        <p style={{ opacity: 0.8 }}>
          {newCount} new, {updateCount} with changes, {upToDateCount} already up to date. Use "Show Changes" to see exactly what's
          different before approving a row. Uncheck any you don't want touched.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, maxHeight: 320, overflowY: 'auto' }}>
          {coasterRows.map((row) => {
            const badge = !row.existing ? '(new)' : row.diffFields.length === 0 ? '(up to date)' : '(changes found)'
            const expanded = expandedIds.has(row.scraped.rcdb_id)
            return (
              <li key={row.scraped.rcdb_id} style={{ marginBottom: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={row.include} onChange={() => toggleCoaster(row.scraped.rcdb_id)} />
                    {row.scraped.name}
                    <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{badge}</span>
                  </label>
                  {row.diffFields.length > 0 && (
                    <button type="button" onClick={() => toggleExpanded(row.scraped.rcdb_id)} style={{ fontSize: '0.8rem' }}>
                      {expanded ? 'Hide Changes' : row.existing ? 'Show Changes' : 'Show Details'}
                    </button>
                  )}
                </div>
                {expanded && (
                  <table style={{ marginTop: '0.3rem', marginLeft: '1.5rem', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', paddingRight: '0.75rem' }}>Field</th>
                        {row.existing && <th style={{ textAlign: 'left', paddingRight: '0.75rem' }}>Current</th>}
                        <th style={{ textAlign: 'left' }}>New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.diffFields.map((f) => (
                        <tr key={f.key}>
                          <td style={{ paddingRight: '0.75rem' }}>{f.label}</td>
                          {row.existing && <td style={{ opacity: 0.7, paddingRight: '0.75rem' }}>{f.oldValue || '—'}</td>}
                          <td>{f.newValue || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            )
          })}
        </ul>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <p style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleFinalApply} disabled={saving}>
            {saving ? 'Saving...' : `Apply (park + ${coasterRows.filter((r) => r.include).length} coasters)`}
          </button>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleFetch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2>{mode === 'add' ? 'Add' : 'Edit'} Park From RCDB</h2>
      <label>
        RCDB URL or id
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="e.g. https://rcdb.com/4531.htm or 4531"
          style={{ display: 'block', width: '100%' }}
        />
      </label>

      {step === 'loading' && (
        <p>Fetching the park and each of its coasters from RCDB (paced to be a good citizen) - this may take up to 30 seconds to a minute...</p>
      )}
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
