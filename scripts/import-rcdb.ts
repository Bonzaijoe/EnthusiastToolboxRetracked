// One-time (re-runnable) ETL: pulls the fabianrguez/rcdb-api JSON dump and
// upserts it into our own Supabase tables, keyed on rcdb_id, so the app
// never depends on a third party at runtime.
//
// Usage: npm run import:rcdb
// Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { RcdbThemePark, RcdbRollerCoaster } from './rcdb-types'

const PARKS_URL =
  'https://raw.githubusercontent.com/fabianrguez/rcdb-api/main/db/theme-parks.json'
const COASTERS_URL =
  'https://raw.githubusercontent.com/fabianrguez/rcdb-api/main/db/coasters.json'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Fill in .env (see .env.example).',
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const CHUNK_SIZE = 500

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

async function importParks(parks: RcdbThemePark[]): Promise<Map<number, number>> {
  const rows = parks.map((p) => ({
    rcdb_id: p.id,
    name: p.name,
    city: p.city || null,
    state: p.state || null,
    country: p.country || null,
    lat: toNumberOrNull(p.coords?.lat),
    lng: toNumberOrNull(p.coords?.lng),
    main_picture_url: p.mainPicture?.url ?? null,
    social_media: p.socialMedia ?? null,
  }))

  console.log(`Upserting ${rows.length} parks...`)
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from('parks').upsert(batch, { onConflict: 'rcdb_id' })
    if (error) throw new Error(`Park upsert failed: ${error.message}`)
  }

  const { data, error } = await supabase.from('parks').select('id, rcdb_id')
  if (error) throw new Error(`Failed reading back parks: ${error.message}`)

  const rcdbIdToOurId = new Map<number, number>()
  for (const row of data ?? []) {
    if (row.rcdb_id !== null) rcdbIdToOurId.set(row.rcdb_id, row.id)
  }
  return rcdbIdToOurId
}

async function importCoasters(
  coasters: RcdbRollerCoaster[],
  parkIdByRcdbId: Map<number, number>,
) {
  const rows = coasters.map((c) => ({
    rcdb_id: c.id,
    name: c.name,
    park_id: c.park?.id !== undefined ? parkIdByRcdbId.get(c.park.id) ?? null : null,
    make: c.make || null,
    model: c.model || null,
    type: c.type || null,
    design: c.design || null,
    status: c.status?.state || null,
    opened_date: c.status?.date?.opened || null,
    closed_date: c.status?.date?.closed || null,
    stats: c.stats ?? null,
    main_picture_url: c.mainPicture?.url ?? null,
    pictures: c.pictures ?? null,
    lat: toNumberOrNull(c.coords?.lat),
    lng: toNumberOrNull(c.coords?.lng),
    rcdb_link: c.link || null,
  }))

  console.log(`Upserting ${rows.length} coasters...`)
  let done = 0
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from('coasters').upsert(batch, { onConflict: 'rcdb_id' })
    if (error) throw new Error(`Coaster upsert failed: ${error.message}`)
    done += batch.length
    console.log(`  ${done}/${rows.length}`)
  }
}

async function main() {
  console.log('Downloading RCDB dump...')
  const [parks, coasters] = await Promise.all([
    fetchJson<RcdbThemePark[]>(PARKS_URL),
    fetchJson<RcdbRollerCoaster[]>(COASTERS_URL),
  ])
  console.log(`Fetched ${parks.length} parks and ${coasters.length} coasters.`)

  const parkIdByRcdbId = await importParks(parks)
  await importCoasters(coasters, parkIdByRcdbId)

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
