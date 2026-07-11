import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import type { Coaster, Park, UserCoaster } from '../types'

interface MyListRow extends UserCoaster {
  coaster: Coaster & { park: Park | null }
}

// Order to display status groups in when splitting a park's coaster list -
// "Operating" first since that's what most people are adding, defunct ones last.
const STATUS_ORDER = ['Operating', 'Under Construction', 'SBNO', 'In Storage', 'Operated', 'Unknown']
const STATUS_LABELS: Record<string, string> = {
  Operating: 'Currently Operating',
  'Under Construction': 'Under Construction',
  SBNO: 'Standing But Not Operating (SBNO)',
  'In Storage': 'In Storage',
  Operated: 'Removed / Formerly Operated',
  Unknown: 'Unknown Status',
}

function statusKey(status: string | null): string {
  return status && STATUS_ORDER.includes(status) ? status : 'Unknown'
}

function yearOf(dateStr: string | null): string | null {
  return dateStr?.match(/\d{4}/)?.[0] ?? null
}

function formatYears(c: Coaster): string {
  const opened = yearOf(c.opened_date)
  const closed = yearOf(c.closed_date)
  if (closed) return opened ? `${opened}–${closed}` : `closed ${closed}`
  if (c.status === 'Operating') return opened ? `${opened}–present` : 'present'
  return opened ? `opened ${opened}` : ''
}

function groupByStatus(coasters: Coaster[]): [string, Coaster[]][] {
  const groups = new Map<string, Coaster[]>()
  for (const c of coasters) {
    const key = statusKey(c.status)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return STATUS_ORDER.filter((key) => groups.has(key)).map((key) => [key, groups.get(key)!])
}

export function MyCoasters() {
  const { currentUser } = useCurrentUser()
  const [myList, setMyList] = useState<MyListRow[]>([])
  const [loading, setLoading] = useState(true)

  const [coasterQuery, setCoasterQuery] = useState('')
  const [coasterResults, setCoasterResults] = useState<Coaster[]>([])

  const [parkQuery, setParkQuery] = useState('')
  const [parkResults, setParkResults] = useState<Park[]>([])
  const [selectedPark, setSelectedPark] = useState<Park | null>(null)
  const [parkCoasters, setParkCoasters] = useState<Coaster[]>([])
  const [checkedCoasterIds, setCheckedCoasterIds] = useState<Set<number>>(new Set())

  const myCoasterIds = new Set(myList.map((row) => row.coaster_id))

  async function loadMyList() {
    if (!currentUser) return
    setLoading(true)
    const { data, error } = await supabase
      .from('user_coasters')
      .select('*, coaster:coasters(*, park:parks(*))')
      .eq('user_id', currentUser.id)
      .order('added_at', { ascending: false })
    if (!error) setMyList((data as MyListRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadMyList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  async function searchCoasters() {
    if (coasterQuery.trim().length < 2) {
      setCoasterResults([])
      return
    }
    const { data } = await supabase
      .from('coasters')
      .select('*, park:parks(*)')
      .ilike('name', `%${coasterQuery.trim()}%`)
      .limit(20)
    setCoasterResults((data as Coaster[]) ?? [])
  }

  async function searchParks() {
    if (parkQuery.trim().length < 2) {
      setParkResults([])
      return
    }
    const { data } = await supabase
      .from('parks')
      .select('*')
      .ilike('name', `%${parkQuery.trim()}%`)
      .limit(20)
    setParkResults((data as Park[]) ?? [])
  }

  async function selectPark(park: Park) {
    setSelectedPark(park)
    setParkResults([])
    setParkQuery(park.name)
    const { data } = await supabase
      .from('coasters')
      .select('*')
      .eq('park_id', park.id)
      .order('name')
    setParkCoasters((data as Coaster[]) ?? [])
    setCheckedCoasterIds(new Set())
  }

  async function addSingleCoaster(coaster: Coaster) {
    if (!currentUser) return
    const { error } = await supabase
      .from('user_coasters')
      .insert({ user_id: currentUser.id, coaster_id: coaster.id })
    if (!error) loadMyList()
  }

  async function addBulkFromPark() {
    if (!currentUser || checkedCoasterIds.size === 0) return
    const rows = Array.from(checkedCoasterIds).map((coasterId) => ({
      user_id: currentUser.id,
      coaster_id: coasterId,
    }))
    const { error } = await supabase.from('user_coasters').insert(rows)
    if (!error) {
      setCheckedCoasterIds(new Set())
      loadMyList()
    }
  }

  async function updateScore(userCoasterId: number, score: number | null) {
    setMyList((prev) => prev.map((r) => (r.id === userCoasterId ? { ...r, score } : r)))
    await supabase.from('user_coasters').update({ score }).eq('id', userCoasterId)
  }

  async function removeCoaster(userCoasterId: number) {
    setMyList((prev) => prev.filter((r) => r.id !== userCoasterId))
    await supabase.from('user_coasters').delete().eq('id', userCoasterId)
  }

  function toggleChecked(id: number) {
    setCheckedCoasterIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <h1>My Coasters</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Add a single coaster</h2>
        <input
          placeholder="Search coaster name..."
          value={coasterQuery}
          onChange={(e) => setCoasterQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchCoasters()}
        />
        <button onClick={searchCoasters}>Search</button>
        <ul>
          {coasterResults.map((c) => {
            const years = formatYears(c)
            return (
              <li key={c.id}>
                {c.name} — {c.park?.name ?? 'Unknown park'}
                {' ('}
                {STATUS_LABELS[statusKey(c.status)]}
                {years && `, ${years}`}
                {') '}
                {myCoasterIds.has(c.id) ? (
                  <em>(already on your list)</em>
                ) : (
                  <button onClick={() => addSingleCoaster(c)}>Add</button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Bulk add from a park</h2>
        <input
          placeholder="Search park name..."
          value={parkQuery}
          onChange={(e) => {
            setParkQuery(e.target.value)
            setSelectedPark(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && searchParks()}
        />
        <button onClick={searchParks}>Search</button>
        {parkResults.length > 0 && (
          <ul>
            {parkResults.map((p) => (
              <li key={p.id}>
                <button onClick={() => selectPark(p)}>{p.name}</button> — {p.city}, {p.country}
              </li>
            ))}
          </ul>
        )}

        {selectedPark && (
          <div>
            <h3>{selectedPark.name}</h3>
            {parkCoasters.length === 0 && <p>No coasters found for this park.</p>}
            {groupByStatus(parkCoasters).map(([statusGroup, coasters]) => (
              <div key={statusGroup} style={{ marginBottom: '1rem' }}>
                <h4>
                  {STATUS_LABELS[statusGroup]} ({coasters.length})
                </h4>
                <ul>
                  {coasters.map((c) => {
                    const years = formatYears(c)
                    return (
                      <li key={c.id}>
                        <label>
                          <input
                            type="checkbox"
                            disabled={myCoasterIds.has(c.id)}
                            checked={checkedCoasterIds.has(c.id)}
                            onChange={() => toggleChecked(c.id)}
                          />{' '}
                          {c.name}
                          {years && <span style={{ opacity: 0.7 }}> ({years})</span>}{' '}
                          {myCoasterIds.has(c.id) && <em>(already added)</em>}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {parkCoasters.length > 0 && (
              <button onClick={addBulkFromPark} disabled={checkedCoasterIds.size === 0}>
                Add {checkedCoasterIds.size || ''} selected
              </button>
            )}
          </div>
        )}
      </section>

      <section>
        <h2>Your list ({myList.length})</h2>
        {loading ? (
          <p>Loading...</p>
        ) : myList.length === 0 ? (
          <p>You haven't added any coasters yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Coaster</th>
                <th>Park</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myList.map((row) => (
                <tr key={row.id}>
                  <td>{row.coaster.name}</td>
                  <td>{row.coaster.park?.name ?? '—'}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={row.score ?? ''}
                      placeholder="—"
                      style={{ width: '4.5rem' }}
                      onChange={(e) => {
                        const v = e.target.value
                        updateScore(row.id, v === '' ? null : Number(v))
                      }}
                    />
                  </td>
                  <td>
                    <button onClick={() => removeCoaster(row.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
