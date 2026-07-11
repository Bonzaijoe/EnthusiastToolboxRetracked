import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { formatYears } from '../utils/coasterDisplay'
import { ConfirmModal } from '../components/ConfirmModal'
import type { Coaster, Park, UserCoaster } from '../types'

const SORT_CONFIRM_STEPS = [
  "This will automatically save your rankings after you do this. Are you sure?",
  "This action cannot be undone and you will lose the rankings you previously had set. Are you sure you're sure?",
  'Last chance - this will overwrite your current ranking order with one based purely on ratings. Continue?',
]

interface RankedCoaster {
  coasterId: number
  name: string
  parkName: string | null
  years: string
  score: number | null
}

function duplicateKey(item: Pick<RankedCoaster, 'name' | 'parkName'>): string {
  return `${item.name}::${item.parkName ?? ''}`
}

// Only show operating years when another item shares the same name + park -
// most coasters are unique enough that the years would just be clutter.
function findAmbiguousKeys(items: RankedCoaster[]): Set<string> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = duplicateKey(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key))
}

function SortableRow({
  item,
  index,
  showYears,
}: {
  item: RankedCoaster
  index: number
  showYears: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.coasterId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.5rem',
        border: '1px solid rgba(128,128,128,0.2)',
        borderRadius: 6,
        marginBottom: '0.4rem',
        background: 'var(--row-bg, transparent)',
        cursor: 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <strong style={{ width: '2rem' }}>#{index + 1}</strong>
      <span style={{ flex: 1 }}>
        {item.name}
        {item.parkName && (
          <span style={{ opacity: 0.7 }}>
            {' — '}
            {[item.parkName, showYears ? item.years : null].filter(Boolean).join(', ')}
          </span>
        )}
      </span>
      <span style={{ opacity: 0.7 }}>{item.score ?? '—'}</span>
    </li>
  )
}

export function MyRankings() {
  const { currentUser } = useCurrentUser()
  const [items, setItems] = useState<RankedCoaster[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmStep, setConfirmStep] = useState(0) // 0 = no modal, 1..N = which confirmation is showing

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [{ data: userCoasters }, { data: rankings }] = await Promise.all([
        supabase
          .from('user_coasters')
          .select('*, coaster:coasters(id, name, status, opened_date, closed_date, park:parks(name))')
          .eq('user_id', currentUser!.id),
        supabase
          .from('user_rankings')
          .select('coaster_id, position')
          .eq('user_id', currentUser!.id)
          .order('position'),
      ])

      if (cancelled) return

      const byId = new Map<number, RankedCoaster>()
      for (const row of (userCoasters as (UserCoaster & {
        coaster: Coaster & { park: Park | null }
      })[]) ?? []) {
        byId.set(row.coaster_id, {
          coasterId: row.coaster_id,
          name: row.coaster.name,
          parkName: row.coaster.park?.name ?? null,
          years: formatYears(row.coaster),
          score: row.score,
        })
      }

      let ordered: RankedCoaster[]
      if (rankings && rankings.length > 0) {
        ordered = rankings
          .map((r) => byId.get(r.coaster_id))
          .filter((r): r is RankedCoaster => Boolean(r))
        // Anything ridden since the last ranking save goes at the bottom.
        const rankedIds = new Set(rankings.map((r) => r.coaster_id))
        ordered.push(...Array.from(byId.values()).filter((r) => !rankedIds.has(r.coasterId)))
      } else {
        ordered = Array.from(byId.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      }

      setItems(ordered)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  async function persist(newItems: RankedCoaster[]) {
    if (!currentUser) return
    setSaving(true)
    await supabase.from('user_rankings').delete().eq('user_id', currentUser.id)
    const rows = newItems.map((item, index) => ({
      user_id: currentUser.id,
      coaster_id: item.coasterId,
      position: index,
    }))
    if (rows.length > 0) await supabase.from('user_rankings').insert(rows)
    setSaving(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.coasterId === active.id)
      const newIndex = prev.findIndex((i) => i.coasterId === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      persist(next)
      return next
    })
  }

  function handleSortByRatingConfirm() {
    if (confirmStep < SORT_CONFIRM_STEPS.length) {
      setConfirmStep(confirmStep + 1)
      return
    }
    const sorted = [...items].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    setItems(sorted)
    persist(sorted)
    setConfirmStep(0)
  }

  const ambiguousKeys = findAmbiguousKeys(items)

  return (
    <div>
      <h1>My Rankings</h1>
      <p>Drag to reorder your personal top list. {saving && <em>Saving...</em>}</p>
      {!loading && items.length > 0 && (
        <p>
          <button onClick={handleSortByRatingConfirm}>Sort by Rating</button>
        </p>
      )}
      {confirmStep > 0 && (
        <ConfirmModal
          message={SORT_CONFIRM_STEPS[confirmStep - 1]}
          confirmLabel={confirmStep < SORT_CONFIRM_STEPS.length ? 'Continue' : 'Yes, sort by rating'}
          onConfirm={handleSortByRatingConfirm}
          onCancel={() => setConfirmStep(0)}
        />
      )}
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p>Add some coasters on the My Coasters page first.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((i) => i.coasterId)}
            strategy={verticalListSortingStrategy}
          >
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map((item, index) => (
                <SortableRow
                  key={item.coasterId}
                  item={item}
                  index={index}
                  showYears={ambiguousKeys.has(duplicateKey(item))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
