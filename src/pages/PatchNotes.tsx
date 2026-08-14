import { Link } from 'react-router-dom'

interface PatchEntry {
  date: string
  version: string // the version this day ended on - frozen once the day passes, see scripts/bump-version.mjs
  items: string[]
}

const PATCH_NOTES: PatchEntry[] = [
  {
    date: 'August 14, 2026',
    version: '0.22',
    items: [
      'Combined Ratings is now the default tab (was Rankings), and sits on the left of the toggle',
      'Combined Rankings/Ratings are now capped at the top 200 coasters',
      'Fixed accidentally changing a Rating on My Coasters by scrolling while your cursor happened to be over the number box',
      '"Sort by Rating" on My Rankings now explicitly keeps ties in their prior order, so rating a few new coasters and re-sorting slots them into place instead of reshuffling everything else',
      'Clicking a coaster on My Rankings now shows a "Move to #" box at the top of the panel, so you can send it straight to an exact rank instead of dragging the whole way',
      'Added a confirmation before leaving My Rankings with unsaved changes, whether that\'s clicking another tab, logging out, closing the tab, refreshing, or typing a new URL',
      'Added an "Unranked Coasters" drawer to My Rankings - a tab on the left edge that opens a separate list of everything you haven\'t placed yet, with its own scroll so opening it doesn\'t lose your spot in a long list. Drag one straight into your ranked list at the exact spot you want (or drag one back out if you change your mind) instead of hunting for it at the bottom of 500+ coasters',
      'Coasters you haven\'t placed now stay in the Unranked drawer across saves, instead of quietly becoming "ranked at the bottom" the first time you hit Save Rankings',
      'Added a "Ranking Threshold" setting on the Account page - set a minimum rating (1-10) and anything below it disappears from My Rankings, with a separate toggle for whether unrated coasters should still show. Nothing is deleted: raise the threshold back down and everything reappears exactly where it was',
    ],
  },
  {
    date: 'August 13, 2026',
    version: '0.14',
    items: [
      'Raised the Database search cap from 25 to 50 results, with a note when there are more than that',
      'My Rankings no longer saves every single drag automatically — hit "Save Rankings" to keep your order, or "Save and Submit" to also count it toward Combined Rankings, so mid-reorder experimenting never affects anyone else\'s view',
      'Added Combined Rankings: everyone\'s submitted personal rankings averaged into one group top list, with a toggle to switch to Combined Ratings (everyone\'s 1-10 ratings averaged instead) — both show how many people\'s data went into each number',
    ],
  },
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
