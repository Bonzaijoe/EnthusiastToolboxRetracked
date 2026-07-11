import { Link } from 'react-router-dom'

interface PatchEntry {
  date: string
  items: string[]
}

const PATCH_NOTES: PatchEntry[] = [
  {
    date: 'July 11, 2026',
    items: [
      '"Score" changed to "Rating"',
      'Added button to automatically sort rankings by rating',
      'Added this Patch Notes page',
      'My Rankings: click a coaster to rank it against others at the same park, manufacturer, and manufacturer+model in a side panel — drag any of them and it stays in sync everywhere',
    ],
  },
  {
    date: 'July 10, 2026',
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
          <h2>{entry.date}</h2>
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
