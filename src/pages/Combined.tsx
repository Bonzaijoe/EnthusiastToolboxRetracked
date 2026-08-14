import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatYears } from '../utils/coasterDisplay'
import type { Coaster, Park } from '../types'

type Mode = 'rankings' | 'ratings'

const TOP_N = 200

interface CoasterRow {
  coasterId: number
  name: string
  parkName: string | null
  years: string
  avgValue: number
  count: number
}

type CoasterWithPark = Coaster & { park: Park | null }

export function Combined() {
  const [mode, setMode] = useState<Mode>('ratings')
  const [rankRows, setRankRows] = useState<CoasterRow[]>([])
  const [rankPeopleCount, setRankPeopleCount] = useState(0)
  const [ratingRows, setRatingRows] = useState<CoasterRow[]>([])
  const [ratingPeopleCount, setRatingPeopleCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      // is_test_account excludes the Dev account from ever affecting either list.
      const [{ data: submitted }, { data: rated }] = await Promise.all([
        supabase
          .from('submitted_rankings')
          .select(
            'coaster_id, position, user_id, users!inner(is_test_account), coaster:coasters(name, status, opened_date, closed_date, park:parks(name))',
          )
          .eq('users.is_test_account', false),
        supabase
          .from('user_coasters')
          .select(
            'coaster_id, score, user_id, users!inner(is_test_account), coaster:coasters(name, status, opened_date, closed_date, park:parks(name))',
          )
          .eq('users.is_test_account', false)
          .not('score', 'is', null),
      ])

      if (cancelled) return

      const rankGrouped = new Map<number, { coaster: CoasterWithPark | null; values: number[] }>()
      const rankPeople = new Set<number>()
      for (const row of (submitted as unknown as {
        coaster_id: number
        position: number
        user_id: number
        coaster: CoasterWithPark | null
      }[]) ?? []) {
        rankPeople.add(row.user_id)
        const entry = rankGrouped.get(row.coaster_id) ?? { coaster: row.coaster, values: [] }
        entry.values.push(row.position + 1) // stored 0-indexed, display as rank #1, #2, ...
        rankGrouped.set(row.coaster_id, entry)
      }
      const rankCombined = buildRows(rankGrouped)
      rankCombined.sort((a, b) => a.avgValue - b.avgValue) // lower avg rank = better

      const ratingGrouped = new Map<number, { coaster: CoasterWithPark | null; values: number[] }>()
      const ratingPeople = new Set<number>()
      for (const row of (rated as unknown as {
        coaster_id: number
        score: number
        user_id: number
        coaster: CoasterWithPark | null
      }[]) ?? []) {
        ratingPeople.add(row.user_id)
        const entry = ratingGrouped.get(row.coaster_id) ?? { coaster: row.coaster, values: [] }
        entry.values.push(row.score)
        ratingGrouped.set(row.coaster_id, entry)
      }
      const ratingCombined = buildRows(ratingGrouped)
      ratingCombined.sort((a, b) => b.avgValue - a.avgValue) // higher avg rating = better

      setRankRows(rankCombined.slice(0, TOP_N))
      setRankPeopleCount(rankPeople.size)
      setRatingRows(ratingCombined.slice(0, TOP_N))
      setRatingPeopleCount(ratingPeople.size)
      setLoading(false)
    }

    function buildRows(grouped: Map<number, { coaster: CoasterWithPark | null; values: number[] }>): CoasterRow[] {
      return Array.from(grouped.entries())
        .filter(([, entry]) => entry.coaster)
        .map(([coasterId, entry]) => ({
          coasterId,
          name: entry.coaster!.name,
          parkName: entry.coaster!.park?.name ?? null,
          years: formatYears(entry.coaster!),
          avgValue: entry.values.reduce((sum, v) => sum + v, 0) / entry.values.length,
          count: entry.values.length,
        }))
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = mode === 'rankings' ? rankRows : ratingRows
  const peopleCount = mode === 'rankings' ? rankPeopleCount : ratingPeopleCount

  return (
    <div>
      <h1>Combined {mode === 'rankings' ? 'Rankings' : 'Ratings'} (Top {TOP_N})</h1>

      <div
        style={{
          display: 'inline-flex',
          border: '1px solid rgba(128,128,128,0.4)',
          borderRadius: 999,
          padding: 2,
          marginBottom: '1rem',
        }}
      >
        <button
          onClick={() => setMode('ratings')}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: 999,
            border: 'none',
            background: mode === 'ratings' ? 'CanvasText' : 'transparent',
            color: mode === 'ratings' ? 'Canvas' : 'inherit',
            cursor: 'pointer',
          }}
        >
          Ratings
        </button>
        <button
          onClick={() => setMode('rankings')}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: 999,
            border: 'none',
            background: mode === 'rankings' ? 'CanvasText' : 'transparent',
            color: mode === 'rankings' ? 'Canvas' : 'inherit',
            cursor: 'pointer',
          }}
        >
          Rankings
        </button>
      </div>

      {mode === 'rankings' ? (
        <p style={{ opacity: 0.7 }}>
          Averages everyone's submitted personal rankings into one group top list. Only counts rankings people have
          explicitly submitted from My Rankings - dragging or saving alone doesn't move this list.
        </p>
      ) : (
        <p style={{ opacity: 0.7 }}>
          Averages everyone's 1-10 ratings from My Coasters into one group top list, highest average first.
        </p>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>
          {mode === 'rankings'
            ? 'Nobody has submitted their rankings yet - hit "Save and Submit" on My Rankings to be the first.'
            : "Nobody has rated any coasters yet - add a rating from My Coasters to be the first."}
        </p>
      ) : (
        <>
          <p style={{ opacity: 0.7 }}>
            Based on {mode === 'rankings' ? 'submitted rankings' : 'ratings'} from {peopleCount}{' '}
            {peopleCount === 1 ? 'person' : 'people'}.
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {rows.map((row, index) => (
              <li
                key={row.coasterId}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.5rem',
                  border: '1px solid rgba(128,128,128,0.2)',
                  borderRadius: 6,
                  marginBottom: '0.4rem',
                }}
              >
                <strong style={{ width: '2rem' }}>#{index + 1}</strong>
                <span style={{ flex: 1 }}>
                  {row.name}
                  {row.parkName && (
                    <span style={{ opacity: 0.7 }}>
                      {' — '}
                      {[row.parkName, row.years].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                  {mode === 'rankings' ? `avg rank ${row.avgValue.toFixed(1)}` : `avg rating ${row.avgValue.toFixed(1)}`} (
                  {row.count} {row.count === 1 ? 'person' : 'people'})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
