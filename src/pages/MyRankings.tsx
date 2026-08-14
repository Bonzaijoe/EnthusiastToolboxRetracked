import { useEffect, useState } from 'react'
import { DndContext, closestCenter, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../supabaseClient'
import { useCurrentUser } from '../context/CurrentUserContext'
import { useUnsavedChanges } from '../context/UnsavedChangesContext'
import { duplicateKey, findAmbiguousKeys, formatYears } from '../utils/coasterDisplay'
import { ConfirmModal } from '../components/ConfirmModal'
import { RankingRow } from '../components/RankingRow'
import { RankingSidePanel } from '../components/RankingSidePanel'
import { UnrankedDrawer, UNRANKED_CONTAINER_ID, DRAWER_WIDTH } from '../components/UnrankedDrawer'
import type { Coaster, Park, RankedCoaster, UserCoaster } from '../types'

const SORT_CONFIRM_STEPS = [
  "This will change your ranking order to match the ratings you have set. You'll still need to hit Save Rankings afterward to keep it. Are you sure?",
  "This action cannot be undone and you will lose the custom rankings you previously had set. Are you sure you're sure?",
  'Last chance - this will overwrite your current ranking order with one based purely on ratings. Continue?',
]

const RANKED_CONTAINER_ID = 'ranked-container'

// A coaster passes if it's unrated (and the user still wants those shown) or
// its rating clears the threshold. Coasters that fail never enter rankedItems/
// unrankedItems at all - see hiddenRankedItems below for how their existing
// position data is protected from being lost on save.
function passesThreshold(item: RankedCoaster, threshold: number, includeUnrated: boolean) {
  if (item.score === null) return includeUnrated
  return item.score >= threshold
}

export function MyRankings() {
  const { currentUser } = useCurrentUser()
  const { setHasUnsavedChanges } = useUnsavedChanges()
  const [rankedItems, setRankedItems] = useState<RankedCoaster[]>([])
  const [unrankedItems, setUnrankedItems] = useState<RankedCoaster[]>([])
  // Ranked coasters filtered out by the threshold/unrated settings. Never
  // rendered or draggable, but kept so their saved position isn't lost -
  // persistRankings tacks them back on below everything visible instead of
  // deleting their row outright.
  const [hiddenRankedItems, setHiddenRankedItems] = useState<RankedCoaster[]>([])
  // Total coasters filtered out by the threshold/unrated settings (ranked +
  // unranked), just for the "N hidden" note - hiddenRankedItems above is the
  // subset that actually needs save-time data protection.
  const [hiddenCount, setHiddenCount] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [confirmStep, setConfirmStep] = useState(0) // 0 = no modal, 1..N = which confirmation is showing
  const [selectedCoasterId, setSelectedCoasterId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { setNodeRef: setRankedDropRef } = useDroppable({ id: RANKED_CONTAINER_ID })

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

      // Fall back if this session's stored user predates these settings
      // (e.g. someone already logged in when this feature shipped) - without
      // this, undefined would fail every threshold check and blank the page.
      const threshold = currentUser!.rankingThreshold ?? 1
      const includeUnrated = currentUser!.includeUnrated ?? true
      const passes = (r: RankedCoaster) => passesThreshold(r, threshold, includeUnrated)

      let ranked: RankedCoaster[]
      let unranked: RankedCoaster[]
      let hidden: RankedCoaster[]
      if (rankings && rankings.length > 0) {
        const allRanked = rankings
          .map((r) => byId.get(r.coaster_id))
          .filter((r): r is RankedCoaster => Boolean(r))
        ranked = allRanked.filter(passes)
        hidden = allRanked.filter((r) => !passes(r))
        // No user_rankings row at all = genuinely unranked, and stays that way
        // across saves now (see persistRankings) instead of just getting
        // dumped at the bottom of the list the first time you save.
        const rankedIds = new Set(rankings.map((r) => r.coaster_id))
        unranked = Array.from(byId.values()).filter((r) => !rankedIds.has(r.coasterId) && passes(r))
      } else {
        // First time using My Rankings at all - seed a sensible starting order
        // from ratings rather than dumping everything into "unranked".
        ranked = Array.from(byId.values())
          .filter(passes)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        unranked = []
        hidden = []
      }

      setRankedItems(ranked)
      setUnrankedItems(unranked)
      setHiddenRankedItems(hidden)
      setHiddenCount(byId.size - ranked.length - unranked.length)
      setSubmittedAt(submitted && submitted.length > 0 ? submitted[0].submitted_at : null)
      setDirty(false)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUser])

  // Mirrors `dirty` into the shared context so the nav bar can confirm before
  // navigating away - and clears it on unmount so it doesn't leak into other
  // pages if this one goes away some way other than a guarded nav click
  // (e.g. the browser's own back/forward buttons).
  useEffect(() => {
    setHasUnsavedChanges(dirty)
    return () => setHasUnsavedChanges(false)
  }, [dirty, setHasUnsavedChanges])

  // Covers leaving via tab close, refresh, or a typed URL/bookmark - none of
  // which the nav bar's guardedNavigate ever sees. The browser controls the
  // actual prompt text; e.returnValue is what triggers it.
  useEffect(() => {
    if (!dirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  // Only ranked items get a position written - anything still sitting in the
  // Unranked drawer stays row-less, so "unranked" survives across saves
  // instead of silently becoming "ranked at the bottom" the moment you save.
  // Coasters hidden by the ranking threshold are tacked on after everything
  // visible (rather than dropped) so their position row - and their spot in
  // Combined Rankings - survives; raising the threshold back up later just
  // reveals them at the bottom instead of bumping them to Unranked.
  async function persistRankings(newRankedItems: RankedCoaster[]) {
    if (!currentUser) return
    const fullOrder = [...newRankedItems, ...hiddenRankedItems]
    await supabase.from('user_rankings').delete().eq('user_id', currentUser.id)
    const rows = fullOrder.map((item, index) => ({
      user_id: currentUser.id,
      coaster_id: item.coasterId,
      position: index,
    }))
    if (rows.length > 0) await supabase.from('user_rankings').insert(rows)
  }

  // Shared by the main list, every sub-group list in the side panel, AND the
  // Unranked drawer - resolving active/over against whichever of the two
  // arrays they actually belong to covers plain reordering (both ends in the
  // same array) and dragging a coaster across from Unranked into an exact
  // spot in the ranked list (or back out, if you change your mind).
  // Deliberately local-only - nothing is written to the database until Save
  // Rankings / Save and Submit is clicked.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = active.id as number
    const overId = over.id
    const activeInRanked = rankedItems.some((i) => i.coasterId === activeId)
    const overInRanked = overId === RANKED_CONTAINER_ID || rankedItems.some((i) => i.coasterId === overId)
    const overInUnranked = overId === UNRANKED_CONTAINER_ID || unrankedItems.some((i) => i.coasterId === overId)

    if (activeInRanked && overInRanked) {
      setRankedItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.coasterId === activeId)
        const overIndex = prev.findIndex((i) => i.coasterId === overId)
        const newIndex = overIndex === -1 ? prev.length - 1 : overIndex
        return arrayMove(prev, oldIndex, newIndex)
      })
      setDirty(true)
      return
    }

    if (!activeInRanked && overInRanked) {
      const moved = unrankedItems.find((i) => i.coasterId === activeId)
      if (!moved) return
      setUnrankedItems((prev) => prev.filter((i) => i.coasterId !== activeId))
      setRankedItems((prev) => {
        const overIndex = prev.findIndex((i) => i.coasterId === overId)
        const insertAt = overIndex === -1 ? prev.length : overIndex
        const next = [...prev]
        next.splice(insertAt, 0, moved)
        return next
      })
      setDirty(true)
      return
    }

    if (activeInRanked && overInUnranked) {
      const moved = rankedItems.find((i) => i.coasterId === activeId)
      if (!moved) return
      setRankedItems((prev) => prev.filter((i) => i.coasterId !== activeId))
      setUnrankedItems((prev) => [...prev, moved])
      setDirty(true)
    }
  }

  // Same local-only, no-auto-persist behavior as handleDragEnd - just driven by
  // a typed target position instead of a drag. targetPosition is 1-indexed to
  // match what's shown on screen (#1, #2, ...). Only applies to already-ranked
  // coasters - moving an unranked one in is a drag-from-the-drawer action,
  // since you need to see the surrounding coasters to pick a confident spot.
  function handleJumpToPosition(coasterId: number, targetPosition: number) {
    setRankedItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.coasterId === coasterId)
      if (oldIndex === -1) return prev
      const newIndex = Math.min(Math.max(targetPosition - 1, 0), prev.length - 1)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setDirty(true)
  }

  async function handleSaveRankings() {
    if (!currentUser) return
    setSaving(true)
    await persistRankings(rankedItems)
    setSaving(false)
    setDirty(false)
  }

  // Saves the personal order (same as above) AND replaces this user's
  // submitted_rankings snapshot - the only thing Combined Rankings reads from,
  // so a plain drag or a plain Save never moves the combined list, only this.
  async function handleSaveAndSubmit() {
    if (!currentUser) return
    setSaving(true)
    await persistRankings(rankedItems)
    const now = new Date().toISOString()
    // Same fold-hidden-items-in treatment as persistRankings, for the same
    // reason - threshold-hidden coasters keep their spot in Combined
    // Rankings instead of quietly falling out of it.
    const fullOrder = [...rankedItems, ...hiddenRankedItems]
    await supabase.from('submitted_rankings').delete().eq('user_id', currentUser.id)
    const rows = fullOrder.map((item, index) => ({
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
    const sorted = rankedItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (b.item.score ?? -1) - (a.item.score ?? -1) || a.index - b.index)
      .map(({ item }) => item)
    setRankedItems(sorted)
    setDirty(true)
    setConfirmStep(0)
  }

  const ambiguousKeys = findAmbiguousKeys([...rankedItems, ...unrankedItems])
  const selectedCoaster = rankedItems.find((i) => i.coasterId === selectedCoasterId) ?? null

  return (
    <div>
      {!loading && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <UnrankedDrawer
            items={unrankedItems}
            ambiguousKeys={ambiguousKeys}
            duplicateKey={duplicateKey}
            open={drawerOpen}
            onToggle={() => setDrawerOpen((o) => !o)}
          />
          <div style={{ marginLeft: drawerOpen ? DRAWER_WIDTH : 0, transition: 'margin-left 0.2s' }}>
            <h1>My Rankings</h1>
            <p>Drag to reorder your personal top list, or click a coaster to rank it against its park/manufacturer/model.</p>
            {hiddenCount > 0 && (
              <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                {hiddenCount} coaster{hiddenCount === 1 ? '' : 's'} hidden by your Ranking Threshold - adjust it on
                the Account page.
              </p>
            )}
            {rankedItems.length > 0 && (
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
            {rankedItems.length === 0 && unrankedItems.length === 0 ? (
              <p>Add some coasters on the My Coasters page first.</p>
            ) : (
              <SortableContext items={rankedItems.map((i) => i.coasterId)} strategy={verticalListSortingStrategy}>
                <ul ref={setRankedDropRef} style={{ listStyle: 'none', padding: 0, minHeight: 40 }}>
                  {rankedItems.map((item, index) => (
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
            )}
          </div>
        </DndContext>
      )}
      {loading && <p>Loading...</p>}
      {/* Deliberately outside the DndContext above: each sub-group list here
          owns its own independent DndContext (see SubGroupList.tsx), and
          nesting that inside the drawer/main-list one risks sensor conflicts
          between the two - keeping this a sibling avoids that entirely. */}
      {selectedCoaster && (
        <RankingSidePanel
          coaster={selectedCoaster}
          items={rankedItems}
          ambiguousKeys={ambiguousKeys}
          onDragEnd={handleDragEnd}
          onJumpToPosition={handleJumpToPosition}
          onClose={() => setSelectedCoasterId(null)}
        />
      )}
    </div>
  )
}
