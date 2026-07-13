import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { ParkDetailPanel } from '../components/ParkDetailPanel'
import { CoasterDetailPanel } from '../components/CoasterDetailPanel'
import { EntryEditor } from '../components/EntryEditor'
import type { Coaster, Park } from '../types'

type CoasterWithPark = Coaster & { park: Park | null }

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

  async function search() {
    const q = query.trim()
    if (q.length < 2) {
      setParkResults([])
      setCoasterResults([])
      setSearched(false)
      return
    }

    const [{ data: parks }, { data: coasters }] = await Promise.all([
      supabase.from('parks').select('*').ilike('name', `%${q}%`).order('name').limit(25),
      supabase
        .from('coasters')
        .select('*, park:parks(*)')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(25),
    ])

    setParkResults((parks as Park[]) ?? [])
    setCoasterResults((coasters as CoasterWithPark[]) ?? [])
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
            {parkResults.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No matching parks.</p>
            ) : (
              <ul>
                {parkResults.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setSelectedPark(p)}>{p.name}</button>
                    {' — '}
                    {[p.city, p.state, p.country].filter(Boolean).join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Coasters ({coasterResults.length})</h2>
            {coasterResults.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No matching coasters.</p>
            ) : (
              <ul>
                {coasterResults.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setSelectedCoaster(c)}>{c.name}</button>
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
