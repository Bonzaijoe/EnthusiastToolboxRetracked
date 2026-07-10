import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import type { AppUser } from '../types'

interface FriendSummary extends AppUser {
  coasterCount: number
}

export function Friends() {
  const { currentUser } = useCurrentUser()
  const [friends, setFriends] = useState<FriendSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: users } = await supabase.from('users').select('id, name').order('name')
      const others = (users ?? []).filter((u) => u.id !== currentUser?.id)

      const withCounts = await Promise.all(
        others.map(async (u) => {
          const { count } = await supabase
            .from('user_coasters')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', u.id)
          return { ...u, coasterCount: count ?? 0 }
        }),
      )

      setFriends(withCounts)
      setLoading(false)
    }
    load()
  }, [currentUser])

  return (
    <div>
      <h1>Friends</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {friends.map((f) => (
            <li key={f.id}>
              <Link to={`/friends/${f.id}`}>{f.name}</Link> — {f.coasterCount} coasters ridden
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
