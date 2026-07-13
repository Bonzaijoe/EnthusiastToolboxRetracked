// Scrapes a single rcdb.com page (park or coaster) and returns structured
// data matching the shape our manual Add/Edit forms already use, so the
// client can feed it into the same diff/review screen.
//
// RCDB's robots.txt is wide open (`Disallow:`) and it has no rate-limit
// headers, but we self-throttle at ~1 request/second anyway as a courtesy -
// see RCDB_DELAY_MS below. A park scrape fetches the park page once, then
// each of its coasters' pages sequentially (paced), all within this one
// invocation, since the client only wants to make one round trip.
//
// Deployed with `npm run functions:deploy` (see package.json). Requires no
// secrets beyond the ones Supabase injects automatically.

const RCDB_DELAY_MS = 1000
const MAX_PARK_COASTERS = 60
const USER_AGENT = 'EnthusiastToolboxRetracked/1.0 (+private roller coaster tracker; low-volume, courtesy-paced)'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScrapedStats {
  [key: string]: string | string[]
}

interface ScrapedCoaster {
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
  stats: ScrapedStats | null
}

interface ScrapedPark {
  rcdb_id: number
  name: string
  city: string | null
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
  main_picture_url: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRcdbId(input: string): number | null {
  const trimmed = input.trim()
  const fromHtm = trimmed.match(/(\d+)\.htm/)
  if (fromHtm) return Number(fromHtm[1])
  const bare = trimmed.match(/^\d+$/)
  return bare ? Number(bare[0]) : null
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

async function fetchRcdbPage(rcdbId: number): Promise<string> {
  const res = await fetch(`https://rcdb.com/${rcdbId}.htm`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (res.status === 404) throw new Error(`No RCDB page found for id ${rcdbId}.`)
  if (!res.ok) throw new Error(`RCDB returned ${res.status} for id ${rcdbId}.`)
  return await res.text()
}

function parsePictureUrl(html: string): string | null {
  const jsonMatch = html.match(/<script type=application\/json id=pic_json>(.*?)<\/script>/s)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[1]) as { pictures?: { url: string; offset: number }[] }
    const pictures = parsed.pictures ?? []
    const main = pictures.find((p) => p.offset === 0) ?? pictures[0]
    return main ? `https://rcdb.com${main.url}` : null
  } catch {
    return null
  }
}

// RCDB's own "Former status" stats row (present once a ride has changed status
// at least once) records every past status span, most recent first, <br>-joined,
// e.g. a ride that reopened after a spell of SBNO shows THREE segments:
//   Operated from 2024-06-22 to 2025-11-02
//   SBNO from 2023 to 2024-06-21
//   Operated from 1995-05-20 to 2022
// The true opening date is the *earliest* "Operated from" across all segments,
// not just the first one listed - otherwise a reopening reads as the original
// opening. See parseStatusBlock for why this row matters at all.
function parseFormerStatus(html: string): { opened: string | null; closed: string | null } {
  const rowMatch = html.match(/<th>Former status<td>([\s\S]*?)(?:<tr>|<\/tbody>|<\/table>)/)
  if (!rowMatch) return { opened: null, closed: null }

  const operatedSpans: { from: string; to: string }[] = []
  for (const seg of rowMatch[1].split('<br>')) {
    const m = seg.match(/<a href="\/g\.htm\?id=\d+">([^<]*)<\/a> from <time datetime="([^"]*)"><\/time> to <time datetime="([^"]*)"><\/time>/)
    if (m && m[1] === 'Operated') operatedSpans.push({ from: m[2], to: m[3] })
  }
  if (operatedSpans.length === 0) return { opened: null, closed: null }

  const opened = operatedSpans.reduce((earliest, s) => (s.from < earliest ? s.from : earliest), operatedSpans[0].from)
  const closed = operatedSpans.reduce((latest, s) => (s.to > latest ? s.to : latest), operatedSpans[0].to)
  return { opened, closed }
}

function parseStatusBlock(html: string): { status: string | null; opened: string | null; closed: string | null } {
  const match = html.match(/<p>(?:[^<]*,\s*)?<a href="\/g\.htm\?id=\d+">([^<]+)<\/a>[^<]*(<time[\s\S]*?<\/p>)/)
  if (!match) return { status: null, opened: null, closed: null }
  const status = match[1]
  const dates = [...match[2].matchAll(/<time datetime="([^"]*)">/g)].map((m) => m[1])

  // Two dates on the main status line (e.g. "Removed, Operated from X to Y")
  // already give us the true opened/closed span directly.
  if (dates.length >= 2) return { status, opened: dates[0], closed: dates[1] }

  // A single "since X" date means X really is the opening date only while the
  // ride is still Operating. For any other status (SBNO, Under Construction,
  // In Storage, ...) that single date is when THAT status began - e.g. "SBNO
  // since 2025-11-03" is the day the park closed, not the day the ride opened.
  // Recover the real opening date from the Former status row instead of
  // letting a status change silently overwrite it.
  if (status === 'Operating') return { status, opened: dates[0] ?? null, closed: null }

  const former = parseFormerStatus(html)
  return { status, opened: former.opened, closed: former.closed ?? dates[0] ?? null }
}

function parseLocation(parenGroup: string): { city: string | null; state: string | null; country: string | null } {
  const parts = [...parenGroup.matchAll(/<a href="\/location\.htm\?id=\d+">([^<]+)<\/a>/g)].map((m) => m[1])
  if (parts.length === 0) return { city: null, state: null, country: null }
  const country = parts[parts.length - 1] ?? null
  const city = parts[0] ?? null
  const state = parts.length >= 3 ? parts.slice(1, -1).join(', ') : null
  return { city, state, country }
}

function parseStatsTables(html: string): ScrapedStats | null {
  const stats: ScrapedStats = {}
  const sectionRe = /<section><h3>[^<]*<\/h3><table class=stat-tbl>(.*?)<\/table><\/section>/gs
  const KEY_MAP: Record<string, string> = {
    length: 'length',
    height: 'height',
    speed: 'speed',
    inversions: 'inversions',
    duration: 'duration',
    'g-force': 'gForce',
    drop: 'drop',
    elements: 'elements',
    arrangement: 'arrangement',
    'built by': 'builtBy',
    capacity: 'capacity',
    dimensions: 'dimensions',
    designer: 'designer',
    'former names': 'formerNames',
    'vertical angle': 'verticalAngle',
    cost: 'cost',
  }

  for (const sectionMatch of html.matchAll(sectionRe)) {
    const tableInner = sectionMatch[1]
    const rows = tableInner.split(/<tr>/).slice(1)
    for (const row of rows) {
      const rowMatch = row.match(/<th>([^<]+)<td>([\s\S]*)/)
      if (!rowMatch) continue
      const label = rowMatch[1].trim().toLowerCase()
      // Already captured structurally as opened_date/closed_date by parseStatusBlock -
      // its <time> tags have no visible text, so keeping it here would just show up
      // as a broken-looking "Operated from  to " with the dates silently missing.
      if (label === 'former status') continue
      const rawValue = rowMatch[2].replace(/<\/tbody>|<\/table>|<\/section>/g, '')
      const segments = rawValue
        .split(/<br>|<li>/)
        .map((seg) => stripTags(seg))
        .filter(Boolean)
      if (segments.length === 0) continue
      const key = KEY_MAP[label] ?? label.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase())
      stats[key] = segments.length > 1 ? segments : segments[0]
    }
  }

  return Object.keys(stats).length > 0 ? stats : null
}

function parseCoasterPage(html: string, rcdbId: number): ScrapedCoaster {
  const nameMatch = html.match(/<h1>([^<]*)<\/h1>/)
  if (!nameMatch) throw new Error('Could not find a coaster name (<h1>) on this page.')
  const name = nameMatch[1]

  const afterH1 = html.slice((nameMatch.index ?? 0) + nameMatch[0].length)
  const parkLinkMatch = afterH1.match(/<a href=\/(\d+)\.htm>([^<]*)<\/a>\s*\(([^)]*)\)/)
  const park = parkLinkMatch ? { rcdb_id: Number(parkLinkMatch[1]), name: parkLinkMatch[2] } : null

  const { status, opened, closed } = parseStatusBlock(afterH1)

  // The first <ul class=ll> is category/type/design/scale (e.g. Roller Coaster,
  // Steel, Sit Down, Extreme). RCDB sometimes follows it with a *second* <ul>
  // of extra descriptors (Mirror, Single Helix, Shuttle, ...) - those describe
  // a specific layout/element, not the design itself, so they're deliberately
  // left out of `design` rather than appended onto it.
  const tagListMatch = afterH1.match(/<ul class=ll>((?:<li>.*?)+?)<\/ul>/)
  const tags = tagListMatch ? [...tagListMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]) : []
  const type = tags[1] ?? null
  const design = tags[2] ?? null

  const scrollMatch = afterH1.match(/<div class=scroll><p>(.*?)<\/p><\/div>/s)
  let make: string | null = null
  let model: string | null = null
  if (scrollMatch) {
    const lines = scrollMatch[1].split(/<br>/)
    for (const line of lines) {
      const makeMatch = line.match(/Make:\s*<a[^>]*>([^<]+)<\/a>/)
      if (makeMatch) make = makeMatch[1]
      const modelMatch = line.match(/Model:\s*(.+)/)
      if (modelMatch) {
        // RCDB sometimes lists "{main model} / {sub-model variant}", e.g.
        // "SLC / 689m Standard" - the sub-model is a specific configuration
        // of the main one, not a separate model, so keep only the first.
        const models = [...modelMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1])
        model = models[0] ?? null
      }
    }
  }

  return {
    rcdb_id: rcdbId,
    rcdb_link: `/${rcdbId}.htm`,
    name,
    park,
    make,
    model,
    type,
    design,
    status,
    opened_date: opened,
    closed_date: closed,
    main_picture_url: parsePictureUrl(html),
    stats: parseStatsTables(html),
  }
}

function parseParkPage(html: string): { park: ScrapedPark; coasterRefs: { rcdb_id: number; name: string }[] } {
  const nameMatch = html.match(/<h1>([^<]*)<\/h1>/)
  if (!nameMatch) throw new Error('Could not find a park name (<h1>) on this page.')
  const name = nameMatch[1]

  const headerEnd = html.indexOf('<div class="map-tpl')
  const headerRegion = html.slice(nameMatch.index ?? 0, headerEnd > -1 ? headerEnd : undefined)

  const parenMatch = headerRegion.match(/<\/h1>[^(]*\(([^)]*)\)|<a href="\/location\.htm[\s\S]*?<br>/)
  const { city, state, country } = parseLocation(parenMatch ? parenMatch[0] : headerRegion)

  const mapsMatch = html.match(/google\.com\/maps\/place\/(-?[\d.]+),(-?[\d.]+)/)
  const lat = mapsMatch ? Number(mapsMatch[1]) : null
  const lng = mapsMatch ? Number(mapsMatch[2]) : null

  const rcdbIdMatch = html.match(/<a href="\/(\d+)\.htm#p=0" id=pic-lnk/) ?? html.match(/<link rel=canonical href="\/(\d+)\.htm">/)

  // Coaster links only live inside these "<h4>...Roller Coasters: N</h4><div class=stdtbl>...</div>"
  // sections. Scanning the whole page also picks up unrelated /{id}.htm links - e.g. the park's
  // Operator (a company page, same flat URL scheme) - which aren't coasters at all.
  const coasterRefs: { rcdb_id: number; name: string }[] = []
  const seen = new Set<number>()
  const sectionRe = /<section><h4>[^<]*Roller Coasters:[\s\S]*?<\/section>/g
  outer: for (const sectionMatch of html.matchAll(sectionRe)) {
    for (const m of sectionMatch[0].matchAll(/<a href=\/(\d+)\.htm>([^<]+)<\/a>/g)) {
      const id = Number(m[1])
      if (seen.has(id)) continue
      seen.add(id)
      coasterRefs.push({ rcdb_id: id, name: m[2] })
      if (coasterRefs.length >= MAX_PARK_COASTERS) break outer
    }
  }

  return {
    park: {
      rcdb_id: rcdbIdMatch ? Number(rcdbIdMatch[1]) : 0,
      name,
      city,
      state,
      country,
      lat,
      lng,
      main_picture_url: parsePictureUrl(html),
    },
    coasterRefs,
  }
}

function detectPageType(html: string): 'park' | 'coaster' {
  if (html.includes('<div class=scroll><p>Make:')) return 'coaster'
  if (/Roller Coasters?:\s*<a href="\/r\.htm/.test(html)) return 'park'
  if (html.includes('<table class=stat-tbl>')) return 'coaster'
  throw new Error("Could not tell whether this RCDB page is a park or a coaster - RCDB may have changed its page layout.")
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { url } = (await req.json()) as { url?: string }
    if (!url) throw new Error('Missing "url" in request body.')

    const rcdbId = extractRcdbId(url)
    if (!rcdbId) throw new Error('Could not find a numeric RCDB id in that URL - paste a link like https://rcdb.com/12345.htm or just the number.')

    const html = await fetchRcdbPage(rcdbId)
    const pageType = detectPageType(html)

    if (pageType === 'coaster') {
      const coaster = parseCoasterPage(html, rcdbId)
      return new Response(JSON.stringify({ type: 'coaster', coaster }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { park, coasterRefs } = parseParkPage(html)
    if (!park.rcdb_id) park.rcdb_id = rcdbId

    const coasters: ScrapedCoaster[] = []
    for (const ref of coasterRefs) {
      if (coasters.length > 0) await sleep(RCDB_DELAY_MS)
      try {
        const coasterHtml = await fetchRcdbPage(ref.rcdb_id)
        coasters.push(parseCoasterPage(coasterHtml, ref.rcdb_id))
      } catch (err) {
        // Skip a single bad coaster page rather than failing the whole park scrape.
        console.error(`Failed to scrape coaster ${ref.rcdb_id} (${ref.name}):`, err)
      }
    }

    return new Response(JSON.stringify({ type: 'park', park, coasters }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while scraping RCDB.'
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
