import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { RankingRow } from './RankingRow'
import { duplicateKey } from '../utils/coasterDisplay'
import type { RankedCoaster } from '../types'

interface SubGroupListProps {
  title: string
  items: RankedCoaster[]
  activeCoasterId: number
  ambiguousKeys: Set<string>
  onDragEnd: (event: DragEndEvent) => void
}

export function SubGroupList({ title, items, activeCoasterId, ambiguousKeys, onDragEnd }: SubGroupListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
      {items.length <= 1 ? (
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>No other coasters ranked here yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.coasterId)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((item, index) => (
                <RankingRow
                  key={item.coasterId}
                  item={item}
                  index={index}
                  showYears={ambiguousKeys.has(duplicateKey(item))}
                  highlighted={item.coasterId === activeCoasterId}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
