import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { SidePanel } from './SidePanel'
import { SplitCoasterModal } from './SplitCoasterModal'
import { STATUS_LABELS, formatYears, rcdbUrlFromId, statusKey } from '../utils/coasterDisplay'
import type { Coaster, CoasterStats, Park } from '../types'

interface CoasterDetailPanelProps {
  coaster: Coaster & { park: Park | null }
  onClose: () => void
  onEdit: () => void
  onSplit: (updatedOriginal: Coaster & { park: Park | null }) => void
}

const STAT_LABELS: Record<string, string> = {
  length: 'Length',
  height: 'Height',
  speed: 'Speed',
  inversions: 'Inversions',
  duration: 'Duration',
  arrangement: 'Arrangement',
  capacity: 'Capacity',
  designer: 'Designer',
  verticalAngle: 'Vertical Angle',
  gForce: 'G-Force',
  drop: 'Drop',
  cost: 'Cost',
  builtBy: 'Built By',
  elements: 'Elements',
  formerNames: 'Former Names',
}

function formatStatValue(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

interface RiddenByRow {
  userId: number
  name: string
  score: number | null
  rank: number | null
}

export function CoasterDetailPanel({ coaster, onClose, onEdit, onSplit }: CoasterDetailPanelProps) {
  const { currentUser } = useCurrentUser()
  const [alreadyAdded, setAlreadyAdded] = useState(false)
  const [riddenBy, setRiddenBy] = useState<RiddenByRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showSplit, setShowSplit] = useState(false)

  async function load() {
    setLoading(true)

    const [{ data: userCoasters }, { data: rankings }] = await Promise.all([
      supabase
        .from('user_coasters')
        .select('user_id, score, users!inner(id, name, is_test_account)')
        .eq('coaster_id', coaster.id)
        .eq('users.is_test_account', false),
      supabase.from('user_rankings').select('user_id, position').eq('coaster_id', coaster.id),
    ])

    const rankByUser = new Map((rankings ?? []).map((r) => [r.user_id as number, r.position as number]))

    const rows: RiddenByRow[] = ((userCoasters as unknown as { user_id: number; score: number | null; users: { name: string } }[]) ?? []).map(
      (row) => ({
        userId: row.user_id,
        name: row.users.name,
        score: row.score,
        rank: rankByUser.has(row.user_id) ? rankByUser.get(row.user_id)! + 1 : null,
      }),
    )
    setRiddenBy(rows)

    if (currentUser) {
      setAlreadyAdded(rows.some((r) => r.userId === currentUser.id))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaster.id])

  async function addToMyList() {
    if (!currentUser) return
    const { error } = await supabase
      .from('user_coasters')
      .insert({ user_id: currentUser.id, coaster_id: coaster.id })
    if (!error) load()
  }

  async function removeFromMyList() {
    if (!currentUser) return
    const { error } = await supabase
      .from('user_coasters')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('coaster_id', coaster.id)
    if (!error) load()
  }

  const years = formatYears(coaster)
  const stats = (coaster.stats ?? {}) as CoasterStats
  const statEntries = Object.entries(stats).filter(([, v]) => v !== undefined && v !== null && v !== '')

  const rcdbUrl = rcdbUrlFromId(coaster.rcdb_id)

  return (
    <SidePanel onClose={onClose}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onEdit}>Edit Entry</button>
        <button onClick={() => setShowSplit(true)}>Split Entry</button>
      </div>

      {showSplit && (
        <SplitCoasterModal
          coaster={coaster}
          onClose={() => setShowSplit(false)}
          onDone={(updated) => {
            setShowSplit(false)
            onSplit(updated)
          }}
        />
      )}

      {rcdbUrl && (
        <p>
          <a href={rcdbUrl} target="_blank" rel="noreferrer">
            View on RCDB ↗
          </a>
        </p>
      )}

      <h2 style={{ marginBottom: 0 }}>{coaster.name}</h2>
      <p style={{ opacity: 0.7, marginTop: '0.25rem' }}>{coaster.park?.name ?? 'Unknown park'}</p>

      <p>
        {STATUS_LABELS[statusKey(coaster.status)]}
        {years && ` · ${years}`}
      </p>
      {(coaster.make || coaster.model) && (
        <p style={{ opacity: 0.8 }}>
          {[coaster.make, coaster.model].filter(Boolean).join(' — ')}
        </p>
      )}
      {(coaster.type || coaster.design) && (
        <p style={{ opacity: 0.8 }}>{[coaster.type, coaster.design].filter(Boolean).join(' · ')}</p>
      )}

      {alreadyAdded ? (
        <p style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <strong>You've Ridden This Ride</strong>
          <button onClick={removeFromMyList}>Remove</button>
        </p>
      ) : (
        <p>
          <button onClick={addToMyList}>Add to my list</button>
        </p>
      )}

      <h3>Ridden By</h3>
      {loading ? (
        <p>Loading...</p>
      ) : riddenBy.length === 0 ? (
        <p style={{ opacity: 0.7 }}>Nobody's ridden this one yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {riddenBy.map((r) => (
            <li key={r.userId}>
              {r.name} — {r.score ?? 'not rated'} · {r.rank ? `ranked #${r.rank}` : 'not yet ranked'}
            </li>
          ))}
        </ul>
      )}

      {statEntries.length > 0 && (
        <>
          <h3>Stats</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {statEntries.map(([key, value]) => (
              <li key={key}>
                <strong>{STAT_LABELS[key] ?? key}:</strong> {formatStatValue(value)}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Combined Ranking</h3>
      <p style={{ opacity: 0.7 }}>Placeholder — coming later, once combined community rankings exist.</p>

      <p style={{ opacity: 0.6, fontSize: '0.85rem', marginTop: '1.5rem' }}>
        Last edited by {coaster.last_edited_by}
        {coaster.last_edited_at && ` on ${new Date(coaster.last_edited_at).toLocaleDateString()}`}
      </p>
    </SidePanel>
  )
}
