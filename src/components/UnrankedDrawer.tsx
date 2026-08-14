import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RankedCoaster } from '../types'

export const UNRANKED_CONTAINER_ID = 'unranked-container'
// Same responsive trick as SidePanel's width: caps at 300px but shrinks to
// fill the viewport on mobile instead of leaving barely any room for the
// main list next to a fixed-width drawer.
export const DRAWER_WIDTH = 'min(300px, 100vw)'

function UnrankedRow({ item, showYears }: { item: RankedCoaster; showYears: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.coasterId })
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
        gap: '0.5rem',
        alignItems: 'center',
        padding: '0.5rem',
        border: '1px solid rgba(128,128,128,0.2)',
        borderRadius: 6,
        marginBottom: '0.4rem',
      }}
    >
      <span {...attributes} {...listeners} style={{ cursor: 'grab', touchAction: 'none', opacity: 0.6 }} aria-label="Drag to rank">
        ⠿
      </span>
      <span style={{ flex: 1 }}>
        {item.name}
        {item.parkName && (
          <span style={{ opacity: 0.7 }}>
            {' — '}
            {[item.parkName, showYears ? item.years : null].filter(Boolean).join(', ')}
          </span>
        )}
      </span>
    </li>
  )
}

interface UnrankedDrawerProps {
  items: RankedCoaster[]
  ambiguousKeys: Set<string>
  duplicateKey: (item: RankedCoaster) => string
  open: boolean
  onToggle: () => void
}

// Deliberately not a modal/overlay like SidePanel - it has to stay open
// alongside the main ranked list so you can drag between the two, and it
// scrolls independently (its own overflow-y) so opening it never disturbs
// wherever you've scrolled to in a 500+ item ranked list.
export function UnrankedDrawer({ items, ambiguousKeys, duplicateKey, open, onToggle }: UnrankedDrawerProps) {
  const { setNodeRef } = useDroppable({ id: UNRANKED_CONTAINER_ID })

  return (
    <>
      <button
        onClick={onToggle}
        aria-label={open ? 'Close unranked coasters' : 'Open unranked coasters'}
        style={{
          position: 'fixed',
          top: '50%',
          left: open ? DRAWER_WIDTH : 0,
          transform: 'translateY(-50%)',
          writingMode: 'vertical-rl',
          padding: '0.75rem 0.4rem',
          borderRadius: '0 6px 6px 0',
          border: '1px solid rgba(128,128,128,0.4)',
          borderLeft: 'none',
          background: 'Canvas',
          color: 'CanvasText',
          cursor: 'pointer',
          zIndex: 601,
          transition: 'left 0.2s',
        }}
      >
        Unranked ({items.length})
      </button>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: open ? 0 : `calc(-1 * ${DRAWER_WIDTH})`,
          height: '100vh',
          width: DRAWER_WIDTH,
          background: 'Canvas',
          color: 'CanvasText',
          borderRight: '1px solid rgba(128,128,128,0.4)',
          boxShadow: open ? '4px 0 24px rgba(0, 0, 0, 0.3)' : 'none',
          overflowY: 'auto',
          padding: '1rem',
          zIndex: 600,
          transition: 'left 0.2s',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Unranked Coasters</h3>
        <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>
          Coasters you haven't placed in your ranking yet. Drag one into your list on the right to place it exactly
          where you want it.
        </p>
        <SortableContext items={items.map((i) => i.coasterId)} strategy={verticalListSortingStrategy}>
          <ul ref={setNodeRef} style={{ listStyle: 'none', padding: 0, minHeight: 40 }}>
            {items.length === 0 && <li style={{ opacity: 0.6 }}>Nothing unranked right now.</li>}
            {items.map((item) => (
              <UnrankedRow key={item.coasterId} item={item} showYears={ambiguousKeys.has(duplicateKey(item))} />
            ))}
          </ul>
        </SortableContext>
      </div>
    </>
  )
}
