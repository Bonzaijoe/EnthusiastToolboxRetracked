import { Link } from 'react-router-dom'

interface PatchEntry {
  date: string
  version: string // the version this day ended on - frozen once the day passes, see scripts/bump-version.mjs
  items: string[]
}

const PATCH_NOTES: PatchEntry[] = [
  {
    date: 'July 13, 2026',
    version: '0.8',
    items: [
      'Added a Database tab to search, browse, and directly maintain the park/coaster catalog',
      'Clicking a park or coaster now opens a detail panel with full info and an Add-to-my-list button',
      "A coaster's detail panel also shows who's ridden it, their rating, and where they've ranked it",
      'Added Add Entry / Edit Entry forms for parks and coasters — including editing which coasters belong to a park, right from the park form',
      'Edits require an explicit accept/reject review of every changed field before saving, so a correction can\'t get silently overwritten later; adding a brand-new entry just saves right away',
      'Added a check that blocks adding a duplicate park/coaster that already exists, pointing you to Edit instead',
      'Added a "Split Coaster Entry" tool for RCDB pages that actually cover two different rides (like Dragon Challenge, or Top Thrill Dragster/Top Thrill 2)',
      'Every park and coaster now links directly back to its RCDB page, and shows who last edited it',
      'Removed social media links from parks',
      'Replaced the "Added" text on a park\'s coaster list with a Remove button so an accidental add is a one-click fix',
      'Moved "Last edited by" to the bottom of park/coaster pages — useful, but shouldn\'t be the first thing you see',
      'Cleaned up spacing on Database search results and made them plain clickable text instead of cramped buttons',
      'RCDB link is now required when adding a new park/coaster (still optional when editing)',
      '"Already on your list" on a coaster page now reads "You\'ve Ridden This Ride" with a Remove button next to it',
      'Added "Add/Edit From RCDB" — paste a coaster or park link from rcdb.com and it pulls the data in for you instead of typing it all by hand',
      'Pasting a park link also pulls in every coaster listed at that park in one go, with a checklist to review what\'s new vs. already on file before saving',
      'Adding from RCDB shows a quick preview before saving; editing from RCDB goes through the same accept/reject review as a manual edit, so a re-scrape can\'t silently clobber a correction',
    ],
  },
  {
    date: 'July 11, 2026',
    version: '0.5',
    items: [
      '"Score" changed to "Rating"',
      'Added button to automatically sort rankings by rating',
      'Added this Patch Notes page',
      'My Rankings: click a coaster to rank it against others at the same park, manufacturer, and manufacturer+model in a side panel — drag any of them and it stays in sync everywhere',
      'Added a version number that bumps automatically on every deploy, shown here per day',
    ],
  },
  {
    date: 'July 10, 2026',
    version: '0.3',
    items: [
      'Built the core app: login (name + PIN), My Coasters, My Rankings, Friends, Combined Rankings placeholder, and Account Settings',
      'Imported the full RCDB dataset (5,580 parks, 12,000 coasters) so coaster data loads instantly without hitting an external API',
      'Added search-and-add and bulk-add-by-park flows for building your coaster list',
      'Built drag-and-drop personal rankings plus read-only friend profile views',
      'Set up automatic deployment to GitHub Pages',
    ],
  },
]

export function PatchNotes() {
  return (
    <div>
      <p>
        <Link to="/login">
          <button>&larr; Back to Login</button>
        </Link>
      </p>
      <h1>Patch Notes</h1>
      {PATCH_NOTES.map((entry) => (
        <section key={entry.date} style={{ marginBottom: '1.5rem' }}>
          <h2>
            {entry.date} <span style={{ opacity: 0.6, fontWeight: 'normal' }}>— v{entry.version}</span>
          </h2>
          <ul>
            {entry.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
