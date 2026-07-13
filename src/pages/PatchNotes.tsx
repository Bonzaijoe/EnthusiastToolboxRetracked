import { Link } from 'react-router-dom'

interface PatchEntry {
  date: string
  version: string // the version this day ended on - frozen once the day passes, see scripts/bump-version.mjs
  items: string[]
}

const PATCH_NOTES: PatchEntry[] = [
  {
    date: 'July 13, 2026',
    version: '0.13',
    items: [
      'Added a Database tab to search, browse, and directly maintain the park/coaster catalog — clicking a park or coaster opens a detail panel with full info, who\'s ridden it, their rating/ranking, and an Add-to-my-list button',
      'Added Add Entry / Edit Entry forms for parks and coasters (including managing a park\'s own coasters right from its form) — edits go through an accept/reject review of every changed field so a correction can\'t get silently overwritten, adding a brand-new entry just saves right away, an RCDB link is required when adding (optional when editing), and duplicates are blocked with a pointer to Edit instead',
      'Added "Add/Edit From RCDB" — paste a coaster or park link from rcdb.com and it pulls the data in for you; pasting a park link also pulls in every coaster listed there with a checklist (new vs. already-on-file, with a "Show Changes" button per coaster) to review before saving; adding shows a quick preview, editing goes through the same accept/reject review as a manual edit',
      'Added a "Split Coaster Entry" tool for RCDB pages that actually cover two different rides (like Dragon Challenge, or Top Thrill Dragster/Top Thrill 2)',
      'Every park and coaster now links back to its RCDB page and shows who last edited it; removed social media links from parks',
      'Polished the Database tab: cleaner search result spacing, "Last edited by" moved to the bottom of park/coaster pages, an accidental add can be undone with a Remove button, and "Already on your list" now reads "You\'ve Ridden This Ride"',
      'Fixed direct links (like sharing this Patch Notes page) 404ing instead of loading the app',
      'My Coasters: added a "Sort by" option to order your list by coaster name, park name, or your personal ranking, not just date added',
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
