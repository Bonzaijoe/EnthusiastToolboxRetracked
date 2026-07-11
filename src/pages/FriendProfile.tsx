import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { AppUser, Coaster, Park, UserCoaster } from '../types'

interface ListRow extends UserCoaster {
  coaster: Coaster & { park: Park | null }
}

export function FriendProfile() {
  const { userId } = useParams()
  const [friend, setFriend] = useState<AppUser | null>(null)
  const [list, setList] = useState<ListRow[]>([])
  const [rankedOrder, setRankedOrder] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const id = Number(userId)

    async function load() {
      setLoading(true)

      const [{ data: userRow }, { data: userCoasters }, { data: rankings }] = await Promise.all([
        supabase.from('users').select('id, name').eq('id', id).single(),
        supabase
          .from('user_coasters')
          .select('*, coaster:coasters(*, park:parks(*))')
          .eq('user_id', id),
        supabase
          .from('user_rankings')
          .select('coaster_id')
          .eq('user_id', id)
          .order('position'),
      ])

      setFriend(userRow ?? null)
      setList((userCoasters as ListRow[]) ?? [])
      setRankedOrder((rankings ?? []).map((r) => r.coaster_id))
      setLoading(false)
    }

    load()
  }, [userId])

  if (loading) return <p>Loading...</p>
  if (!friend) return <p>User not found.</p>

  const byId = new Map(list.map((row) => [row.coaster_id, row]))
  const ordered =
    rankedOrder.length > 0
      ? [
          ...rankedOrder.map((id) => byId.get(id)).filter((r): r is ListRow => Boolean(r)),
          ...list.filter((r) => !rankedOrder.includes(r.coaster_id)),
        ]
      : [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  return (
    <div>
      <h1>{friend.name}'s Coasters</h1>
      <p>{list.length} coasters ridden.</p>
      {ordered.length === 0 ? (
        <p>No coasters added yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Coaster</th>
              <th>Park</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>{row.coaster.name}</td>
                <td>{row.coaster.park?.name ?? '—'}</td>
                <td>{row.score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
