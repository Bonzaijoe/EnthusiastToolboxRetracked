import type { DragEndEvent } from '@dnd-kit/core'
import { SubGroupList } from './SubGroupList'
import type { RankedCoaster } from '../types'

// Data-driven so adding a future sub-group (e.g. by track type or design) is
// just one more entry here - no changes to the panel, rows, or drag logic.
interface SubgroupDef {
  key: string
  label: (c: RankedCoaster) => string | null
  matches: (a: RankedCoaster, b: RankedCoaster) => boolean
}

const SUBGROUPS: SubgroupDef[] = [
  {
    key: 'park',
    label: (c) => (c.parkName ? `Ranked at ${c.parkName}` : null),
    matches: (a, b) => a.parkId !== null && a.parkId === b.parkId,
  },
  {
    key: 'manufacturer',
    label: (c) => (c.make ? `Ranked among ${c.make} coasters` : null),
    matches: (a, b) => a.make !== null && a.make === b.make,
  },
  {
    key: 'model',
    label: (c) => (c.make && c.model ? `Ranked among ${c.make} ${c.model} coasters` : null),
    matches: (a, b) => a.make !== null && a.model !== null && a.make === b.make && a.model === b.model,
  },
]

interface RankingSidePanelProps {
  coaster: RankedCoaster
  items: RankedCoaster[]
  ambiguousKeys: Set<string>
  onDragEnd: (event: DragEndEvent) => void
  onClose: () => void
}

export function RankingSidePanel({ coaster, items, ambiguousKeys, onDragEnd, onClose }: RankingSidePanelProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 900 }}
      onClick={onClose}
    >
      <div
        className="side-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(420px, 100%)',
          background: 'Canvas',
          color: 'CanvasText',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
          overflowY: 'auto',
          padding: '1.5rem',
          zIndex: 901,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ float: 'right' }} aria-label="Close">
          ✕
        </button>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>{coaster.name}</h2>
        {coaster.parkName && <p style={{ opacity: 0.7, marginTop: '0.25rem' }}>{coaster.parkName}</p>}

        {SUBGROUPS.map((def) => {
          const label = def.label(coaster)
          if (!label) return null
          const filtered = items.filter((i) => def.matches(i, coaster))
          return (
            <SubGroupList
              key={def.key}
              title={label}
              items={filtered}
              activeCoasterId={coaster.coasterId}
              ambiguousKeys={ambiguousKeys}
              onDragEnd={onDragEnd}
            />
          )
        })}
      </div>
    </div>
  )
}
