import { supabase } from '../supabaseClient'
import type { CoasterStats } from '../types'

export interface ScrapedCoaster {
  rcdb_id: number
  rcdb_link: string
  name: string
  park: { rcdb_id: number; name: string } | null
  make: string | null
  model: string | null
  type: string | null
  design: string | null
  status: string | null
  opened_date: string | null
  closed_date: string | null
  main_picture_url: string | null
  stats: CoasterStats | null
}

export interface ScrapedPark {
  rcdb_id: number
  name: string
  city: string | null
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
  main_picture_url: string | null
}

export type ScrapeResult =
  | { type: 'coaster'; coaster: ScrapedCoaster }
  | { type: 'park'; park: ScrapedPark; coasters: ScrapedCoaster[] }

export async function scrapeRcdb(url: string): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-rcdb', { body: { url } })
  if (error) {
    // FunctionsHttpError carries the parsed JSON body (our { error: string }) on .context.
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    if (context?.json) {
      const body = await context.json().catch(() => null)
      if (body?.error) throw new Error(body.error)
    }
    throw new Error(error.message)
  }
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? 'Scrape failed for an unknown reason.')
  }
  return data as ScrapeResult
}
