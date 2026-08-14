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
  "This will change your ranking order to match the ratings you have set. You'll still need to hit Save Rankings afterward to keep it. Are you sure?",
  "This action cannot be undone and you will lose the custom rankings you previously had set. Are you sure you're sure?",
  'Last chance - this will overwrite your current ranking order with one based purely on ratings. Continue?',
]

export function MyRankings() {
  const { currentUser } = useCurrentUser()
  const [items, setItems] = useState<RankedCoaster[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [confirmStep, setConfirmStep] = useState(0) // 0 = no modal, 1..N = which confirmation is showing
  const [selectedCoasterId, setSelectedCoasterId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [{ data: userCoasters }, { data: rankings }, { data: submitted }] = await Promise.all([
        supabase
          .from('user_coasters')
          .select('*, coaster:coasters(id, name, status, opened_date, closed_date, make, model, park:parks(id, name))')
          .eq('user_id', currentUser!.id),
        supabase
          .from('user_rankings')
          .select('coaster_id, position')
          .eq('user_id', currentUser!.id)
          .order('position'),
        supabase
          .from('submitted_rankings')
          .select('submitted_at')
          .eq('user_id', currentUser!.id)
          .order('submitted_at', { ascending: false })
          .limit(1),
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
      setSubmittedAt(submitted && submitted.length > 0 ? submitted[0].submitted_at : null)
      setDirty(false)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  // Just the DB write - doesn't touch `saving`/`dirty`, since the two save
  // actions below combine this with other work and manage that state themselves.
  async function persistRankings(newItems: RankedCoaster[]) {
    if (!currentUser) return
    await supabase.from('user_rankings').delete().eq('user_id', currentUser.id)
    const rows = newItems.map((item, index) => ({
      user_id: currentUser.id,
      coaster_id: item.coasterId,
      position: index,
    }))
    if (rows.length > 0) await supabase.from('user_rankings').insert(rows)
  }

  // Shared by the main list AND every sub-group list in the side panel: all of
  // them are just filtered views of this same master order, so resolving
  // active/over against the full `items` array keeps everything in sync no
  // matter which visible list the drag happened in. Deliberately local-only -
  // nothing is written to the database until Save Rankings / Save and Submit
  // is clicked, so mid-drag experimenting never touches anyone else's view.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.coasterId === active.id)
      const newIndex = prev.findIndex((i) => i.coasterId === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setDirty(true)
  }

  async function handleSaveRankings() {
    if (!currentUser) return
    setSaving(true)
    await persistRankings(items)
    setSaving(false)
    setDirty(false)
  }

  // Saves the personal order (same as above) AND replaces this user's
  // submitted_rankings snapshot - the only thing Combined Rankings reads from,
  // so a plain drag or a plain Save never moves the combined list, only this.
  async function handleSaveAndSubmit() {
    if (!currentUser) return
    setSaving(true)
    await persistRankings(items)
    const now = new Date().toISOString()
    await supabase.from('submitted_rankings').delete().eq('user_id', currentUser.id)
    const rows = items.map((item, index) => ({
      user_id: currentUser.id,
      coaster_id: item.coasterId,
      position: index,
      submitted_at: now,
    }))
    if (rows.length > 0) await supabase.from('submitted_rankings').insert(rows)
    setSaving(false)
    setDirty(false)
    setSubmittedAt(now)
  }

  function handleSortByRatingConfirm() {
    if (confirmStep < SORT_CONFIRM_STEPS.length) {
      setConfirmStep(confirmStep + 1)
      return
    }
    // Tiebreak by current position, not just whatever order .sort() happens to
    // leave ties in - so re-sorting after adding/rating a few new coasters slots
    // them in among their rating tier instead of reshuffling everything else.
    const sorted = items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (b.item.score ?? -1) - (a.item.score ?? -1) || a.index - b.index)
      .map(({ item }) => item)
    setItems(sorted)
    setDirty(true)
    setConfirmStep(0)
  }

  const ambiguousKeys = findAmbiguousKeys(items)
  const selectedCoaster = items.find((i) => i.coasterId === selectedCoasterId) ?? null

  return (
    <div>
      <h1>My Rankings</h1>
      <p>Drag to reorder your personal top list, or click a coaster to rank it against its park/manufacturer/model.</p>
      {!loading && items.length > 0 && (
        <>
          <p style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleSaveRankings} disabled={!dirty || saving}>
              {saving ? 'Saving...' : 'Save Rankings'}
            </button>
            <button onClick={handleSaveAndSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save and Submit'}
            </button>
            <button onClick={handleSortByRatingConfirm}>Sort by Rating</button>
          </p>
          <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
            {dirty && <span>You have unsaved changes. </span>}
            {submittedAt
              ? `Last submitted to Combined Rankings on ${new Date(submittedAt).toLocaleDateString()}.`
              : "You haven't submitted to Combined Rankings yet."}
          </p>
        </>
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
