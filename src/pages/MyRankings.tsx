import { useEffect, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { duplicateKey, findAmbiguousKeys, formatYears } from '../utils/coasterDisplay'
import { ConfirmModal } from '../components/ConfirmModal'
import { RankingRow } from '../components/RankingRow'
import { RankingSidePanel } from '../components/RankingSidePanel'
import type { Coaster, Park, RankedCoaster, UserCoaster } from '../types'

const SORT_CONFIRM_STEPS = [
  "This will automatically change your rankings, based on the ratings you have set, and then save them after you do this. Are you sure?",
  "This action cannot be undone and you will lose the custom rankings you previously had set. Are you sure you're sure?",
  'Last chance - this will overwrite your current ranking order with one based purely on ratings. Continue?',
]

export function MyRankings() {
  const { currentUser } = useCurrentUser()
  const [items, setItems] = useState<RankedCoaster[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmStep, setConfirmStep] = useState(0) // 0 = no modal, 1..N = which confirmation is showing
  const [selectedCoasterId, setSelectedCoasterId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [{ data: userCoasters }, { data: rankings }] = await Promise.all([
        supabase
          .from('user_coasters')
          .select('*, coaster:coasters(id, name, status, opened_date, closed_date, make, model, park:parks(id, name))')
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
          parkId: row.coaster.park?.id ?? null,
          parkName: row.coaster.park?.name ?? null,
          make: row.coaster.make,
          model: row.coaster.model,
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

  // Shared by the main list AND every sub-group list in the side panel: all of
  // them are just filtered views of this same master order, so resolving
  // active/over against the full `items` array keeps everything in sync no
  // matter which visible list the drag happened in.
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
  const selectedCoaster = items.find((i) => i.coasterId === selectedCoasterId) ?? null

  return (
    <div>
      <h1>My Rankings</h1>
      <p>Drag to reorder your personal top list, or click a coaster to rank it against its park/manufacturer/model. {saving && <em>Saving...</em>}</p>
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
      {selectedCoaster && (
        <RankingSidePanel
          coaster={selectedCoaster}
          items={items}
          ambiguousKeys={ambiguousKeys}
          onDragEnd={handleDragEnd}
          onClose={() => setSelectedCoasterId(null)}
        />
      )}
      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p>Add some coasters on the My Coasters page first.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.coasterId)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map((item, index) => (
                <RankingRow
                  key={item.coasterId}
                  item={item}
                  index={index}
                  showYears={ambiguousKeys.has(duplicateKey(item))}
                  onClick={() =>
                    setSelectedCoasterId((prev) => (prev === item.coasterId ? null : item.coasterId))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
