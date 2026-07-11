import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RankedCoaster } from '../types'

interface RankingRowProps {
  item: RankedCoaster
  index: number
  showYears: boolean
  onClick?: () => void
  highlighted?: boolean
}

export function RankingRow({ item, index, showYears, onClick, highlighted }: RankingRowProps) {
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
        gap: '0.5rem',
        alignItems: 'center',
        padding: '0.5rem',
        border: '1px solid rgba(128,128,128,0.2)',
        borderRadius: 6,
        marginBottom: '0.4rem',
        background: highlighted ? 'rgba(230, 57, 70, 0.15)' : 'var(--row-bg, transparent)',
      }}
    >
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', touchAction: 'none', padding: '0 0.25rem', opacity: 0.6 }}
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <strong style={{ width: '2rem' }}>#{index + 1}</strong>
      <span
        style={{ flex: 1, cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
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
