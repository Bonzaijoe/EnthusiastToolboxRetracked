import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { SidePanel } from './SidePanel'
import { STATUS_LABELS, formatYears, groupByStatus, rcdbUrlFromId } from '../utils/coasterDisplay'
import type { Coaster, Park } from '../types'

interface ParkDetailPanelProps {
  park: Park
  onClose: () => void
  onEdit: () => void
}

export function ParkDetailPanel({ park, onClose, onEdit }: ParkDetailPanelProps) {
  const { currentUser } = useCurrentUser()
  const [coasters, setCoasters] = useState<Coaster[]>([])
  const [myCoasterIds, setMyCoasterIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: parkCoasters } = await supabase
      .from('coasters')
      .select('*')
      .eq('park_id', park.id)
      .order('name')
    setCoasters((parkCoasters as Coaster[]) ?? [])

    if (currentUser) {
      const { data: mine } = await supabase
        .from('user_coasters')
        .select('coaster_id')
        .eq('user_id', currentUser.id)
      setMyCoasterIds(new Set((mine ?? []).map((r) => r.coaster_id as number)))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park.id])

  async function addToMyList(coasterId: number) {
    if (!currentUser) return
    const { error } = await supabase
      .from('user_coasters')
      .insert({ user_id: currentUser.id, coaster_id: coasterId })
    if (!error) setMyCoasterIds((prev) => new Set(prev).add(coasterId))
  }

  const rcdbUrl = rcdbUrlFromId(park.rcdb_id)

  return (
    <SidePanel onClose={onClose}>
      <div>
        <button onClick={onEdit}>Edit Entry</button>
      </div>

      {rcdbUrl && (
        <p>
          <a href={rcdbUrl} target="_blank" rel="noreferrer">
            View on RCDB ↗
          </a>
        </p>
      )}

      <h2 style={{ marginBottom: 0 }}>{park.name}</h2>
      <p style={{ opacity: 0.7, marginTop: '0.25rem' }}>
        {[park.city, park.state, park.country].filter(Boolean).join(', ') || 'Location unknown'}
      </p>

      <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>
        Last edited by {park.last_edited_by}
        {park.last_edited_at && ` on ${new Date(park.last_edited_at).toLocaleDateString()}`}
      </p>

      <h3>Coasters</h3>
      {loading ? (
        <p>Loading...</p>
      ) : coasters.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No coasters on file for this park yet.</p>
      ) : (
        groupByStatus(coasters).map(([statusGroup, group]) => (
          <div key={statusGroup} style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.4rem' }}>
              {STATUS_LABELS[statusGroup]} ({group.length})
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {group.map((c) => {
                const years = formatYears(c)
                const already = myCoasterIds.has(c.id)
                return (
                  <li
                    key={c.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}
                  >
                    <span>
                      {c.name}
                      {years && <span style={{ opacity: 0.7 }}> ({years})</span>}
                    </span>
                    {already ? (
                      <em style={{ opacity: 0.6, fontSize: '0.85rem' }}>Added</em>
                    ) : (
                      <button onClick={() => addToMyList(c.id)}>Add</button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </SidePanel>
  )
}
