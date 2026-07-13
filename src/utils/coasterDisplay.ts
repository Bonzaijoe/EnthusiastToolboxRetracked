import type { Coaster, RankedCoaster } from '../types'

// Order to display status groups in when splitting a park's coaster list -
// "Operating" first since that's what most people are adding, defunct ones last.
export const STATUS_ORDER = ['Operating', 'Under Construction', 'SBNO', 'In Storage', 'Operated', 'Unknown']
export const STATUS_LABELS: Record<string, string> = {
  Operating: 'Currently Operating',
  'Under Construction': 'Under Construction',
  SBNO: 'Standing But Not Operating (SBNO)',
  'In Storage': 'In Storage',
  Operated: 'Removed / Formerly Operated',
  Unknown: 'Unknown Status',
}

export function statusKey(status: string | null): string {
  return status && STATUS_ORDER.includes(status) ? status : 'Unknown'
}

function yearOf(dateStr: string | null): string | null {
  return dateStr?.match(/\d{4}/)?.[0] ?? null
}

// Distinguishes same-named coasters (e.g. two "Wild Mouse" at the same park,
// one demolished decades ago and one built recently) with an operating year range.
export function formatYears(c: Pick<Coaster, 'status' | 'opened_date' | 'closed_date'>): string {
  const opened = yearOf(c.opened_date)
  const closed = yearOf(c.closed_date)
  if (closed) return opened ? `${opened}–${closed}` : `closed ${closed}`
  if (c.status === 'Operating') return opened ? `${opened}–present` : 'present'
  return opened ? `opened ${opened}` : ''
}

// Every RCDB page - park or coaster - lives at this same flat URL pattern.
// Split coasters (see Split Coaster Entry) share one physical RCDB page but
// are stored as e.g. 123 and 123.1 to stay unique, so floor() first to get
// back to the real page id.
export function rcdbUrlFromId(rcdbId: number | null): string | null {
  return rcdbId ? `https://rcdb.com/${Math.floor(rcdbId)}.htm` : null
}

export function groupByStatus(coasters: Coaster[]): [string, Coaster[]][] {
  const groups = new Map<string, Coaster[]>()
  for (const c of coasters) {
    const key = statusKey(c.status)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return STATUS_ORDER.filter((key) => groups.has(key)).map((key) => [key, groups.get(key)!])
}

export function duplicateKey(item: Pick<RankedCoaster, 'name' | 'parkName'>): string {
  return `${item.name}::${item.parkName ?? ''}`
}

// Only show operating years when another item shares the same name + park -
// most coasters are unique enough that the years would just be clutter.
export function findAmbiguousKeys(items: RankedCoaster[]): Set<string> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = duplicateKey(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key))
}
