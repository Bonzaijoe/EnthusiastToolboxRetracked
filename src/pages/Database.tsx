import { useState, type CSSProperties } from 'react'
import { supabase } from '../supabaseClient'
import { ParkDetailPanel } from '../components/ParkDetailPanel'
import { CoasterDetailPanel } from '../components/CoasterDetailPanel'
import { EntryEditor } from '../components/EntryEditor'
import type { Coaster, Park } from '../types'

type CoasterWithPark = Coaster & { park: Park | null }

const clickableTextStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  textDecoration: 'underline',
  cursor: 'pointer',
}

interface EditorState {
  mode: 'add' | 'edit'
  type?: 'park' | 'coaster'
  target?: Park | Coaster
}

export function Database() {
  const [query, setQuery] = useState('')
  const [parkResults, setParkResults] = useState<Park[]>([])
  const [coasterResults, setCoasterResults] = useState<CoasterWithPark[]>([])
  const [searched, setSearched] = useState(false)

  const [parksTruncated, setParksTruncated] = useState(false)
  const [coastersTruncated, setCoastersTruncated] = useState(false)

  const [selectedPark, setSelectedPark] = useState<Park | null>(null)
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterWithPark | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  // Bumped whenever the editor closes (saved or cancelled) so the open detail
  // panel remounts and refetches - covers nested coaster add/edit within a
  // park's own form, which doesn't otherwise signal back up to here.
  const [panelKey, setPanelKey] = useState(0)

  function closeEditor() {
    setEditor(null)
    setPanelKey((k) => k + 1)
  }

  const SEARCH_LIMIT = 50

  async function search() {
    const q = query.trim()
    if (q.length < 2) {
      setParkResults([])
      setCoasterResults([])
      setSearched(false)
      return
    }

    // Fetch one extra row past the limit so we can tell whether results were
    // actually truncated, without it ever being shown.
    const [{ data: parks }, { data: coasters }] = await Promise.all([
      supabase.from('parks').select('*').ilike('name', `%${q}%`).order('name').limit(SEARCH_LIMIT + 1),
      supabase
        .from('coasters')
        .select('*, park:parks(*)')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(SEARCH_LIMIT + 1),
    ])

    const parkRows = (parks as Park[]) ?? []
    const coasterRows = (coasters as CoasterWithPark[]) ?? []

    setParksTruncated(parkRows.length > SEARCH_LIMIT)
    setCoastersTruncated(coasterRows.length > SEARCH_LIMIT)
    setParkResults(parkRows.slice(0, SEARCH_LIMIT))
    setCoasterResults(coasterRows.slice(0, SEARCH_LIMIT))
    setSearched(true)
  }

  function handleSaved(type: 'park' | 'coaster', saved: Park | Coaster) {
    if (type === 'park') {
      setSelectedCoaster(null)
      setSelectedPark(saved as Park)
    } else {
      setSelectedPark(null)
      setSelectedCoaster(saved as CoasterWithPark)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <h1>Database</h1>
        <button onClick={() => setEditor({ mode: 'add' })}>+ Add Entry</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          placeholder="Search parks or coasters..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <button onClick={search}>Search</button>
      </div>

      {searched && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section>
            <h2>Parks ({parkResults.length})</h2>
            {parksTruncated && (
              <p style={{ opacity: 0.7 }}>More than {SEARCH_LIMIT} results. Showing the first {SEARCH_LIMIT}...</p>
            )}
            {parkResults.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No matching parks.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {parkResults.map((p) => (
                  <li key={p.id} style={{ marginBottom: '0.6rem' }}>
                    <button style={clickableTextStyle} onClick={() => setSelectedPark(p)}>
                      {p.name}
                    </button>
                    {' — '}
                    {[p.city, p.state, p.country].filter(Boolean).join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Coasters ({coasterResults.length})</h2>
            {coastersTruncated && (
              <p style={{ opacity: 0.7 }}>More than {SEARCH_LIMIT} results. Showing the first {SEARCH_LIMIT}...</p>
            )}
            {coasterResults.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No matching coasters.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {coasterResults.map((c) => (
                  <li key={c.id} style={{ marginBottom: '0.6rem' }}>
                    <button style={clickableTextStyle} onClick={() => setSelectedCoaster(c)}>
                      {c.name}
                    </button>
                    {' — '}
                    {c.park?.name ?? 'Unknown park'}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {selectedPark && (
        <ParkDetailPanel
          key={panelKey}
          park={selectedPark}
          onClose={() => setSelectedPark(null)}
          onEdit={() => setEditor({ mode: 'edit', type: 'park', target: selectedPark })}
        />
      )}

      {selectedCoaster && (
        <CoasterDetailPanel
          key={panelKey}
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
          onEdit={() => setEditor({ mode: 'edit', type: 'coaster', target: selectedCoaster })}
          onSplit={(updated) => {
            setSelectedCoaster(updated)
            setPanelKey((k) => k + 1)
          }}
        />
      )}

      {editor && (
        <EntryEditor
          mode={editor.mode}
          initialType={editor.type}
          target={editor.target}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
