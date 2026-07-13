import { useState } from 'react'

export interface DiffField {
  key: string
  label: string
  oldValue: string
  newValue: string
}

interface EntryDiffReviewProps {
  title: string
  fields: DiffField[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onApply: (acceptedKeys: Set<string>) => void
}

// Every changed field must be explicitly Accepted or Rejected - neither is
// pre-selected. This is deliberate: the point is to force a real look at
// each change (e.g. a re-scrape overwriting a deliberate manual correction),
// not to let the user rubber-stamp past a default.
export function EntryDiffReview({ title, fields, saving, error, onCancel, onApply }: EntryDiffReviewProps) {
  const [decisions, setDecisions] = useState<Record<string, 'accept' | 'reject'>>({})

  const allDecided = fields.every((f) => decisions[f.key])

  function decide(key: string, decision: 'accept' | 'reject') {
    setDecisions((prev) => ({ ...prev, [key]: decision }))
  }

  function handleApply() {
    const accepted = new Set(fields.filter((f) => decisions[f.key] === 'accept').map((f) => f.key))
    onApply(accepted)
  }

  return (
    <div>
      <h2>{title}</h2>
      {fields.length === 0 ? (
        <p>No changes to review.</p>
      ) : (
        <>
          <p>Review each change before it's saved. Every row needs an explicit Accept or Reject.</p>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Current</th>
                <th>New</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.key}>
                  <td>{f.label}</td>
                  <td style={{ opacity: 0.7 }}>{f.oldValue || '—'}</td>
                  <td>{f.newValue || '—'}</td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => decide(f.key, 'accept')}
                      style={{ fontWeight: decisions[f.key] === 'accept' ? 700 : 400 }}
                      aria-pressed={decisions[f.key] === 'accept'}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => decide(f.key, 'reject')}
                      style={{ fontWeight: decisions[f.key] === 'reject' ? 700 : 400 }}
                      aria-pressed={decisions[f.key] === 'reject'}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <p style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        {fields.length > 0 && (
          <button onClick={handleApply} disabled={!allDecided || saving}>
            {saving ? 'Saving...' : 'Apply approved changes'}
          </button>
        )}
      </p>
    </div>
  )
}
