import { useState } from 'react'
import { ParkManualForm } from './ParkManualForm'
import { CoasterManualForm } from './CoasterManualForm'
import type { Coaster, Park } from '../types'

type EntryType = 'park' | 'coaster'
type Source = 'manual' | 'rcdb'
type Step = 'type' | 'source' | 'manual-form' | 'rcdb-stub'

interface EntryEditorProps {
  mode: 'add' | 'edit'
  initialType?: EntryType
  target?: Park | Coaster
  onClose: () => void
  onSaved: (type: EntryType, saved: Park | Coaster) => void
}

export function EntryEditor({ mode, initialType, target, onClose, onSaved }: EntryEditorProps) {
  const [entryType, setEntryType] = useState<EntryType | null>(initialType ?? null)
  const [step, setStep] = useState<Step>(mode === 'edit' ? 'source' : 'type')

  function chooseType(type: EntryType) {
    setEntryType(type)
    setStep('source')
  }

  function chooseSource(source: Source) {
    setStep(source === 'manual' ? 'manual-form' : 'rcdb-stub')
  }

  function handleDone(saved: Park | Coaster) {
    onSaved(entryType!, saved)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 950, overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          background: 'Canvas',
          color: 'CanvasText',
          border: '1px solid rgba(128, 128, 128, 0.4)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 600,
          width: '92%',
          margin: '3rem auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem' }} aria-label="Close">
          ✕
        </button>

        {step === 'type' && (
          <div>
            <h2>{mode === 'add' ? 'Add Entry' : 'Edit Entry'}</h2>
            <p>What do you want to add?</p>
            <p style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => chooseType('park')}>Park</button>
              <button onClick={() => chooseType('coaster')}>Coaster</button>
            </p>
          </div>
        )}

        {step === 'source' && (
          <div>
            <h2>
              {mode === 'add' ? 'Add' : 'Edit'} {entryType === 'park' ? 'Park' : 'Coaster'}
            </h2>
            <p>How do you want to {mode === 'add' ? 'add' : 'edit'} this {entryType}?</p>
            <p style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => chooseSource('rcdb')}>
                {mode === 'add' ? 'Add' : 'Edit'} From RCDB
              </button>
              <button onClick={() => chooseSource('manual')}>
                {mode === 'add' ? 'Add' : 'Edit'} Manually
              </button>
            </p>
          </div>
        )}

        {step === 'manual-form' && entryType === 'park' && (
          <ParkManualForm
            mode={mode}
            initialPark={mode === 'edit' ? (target as Park) : undefined}
            onDone={handleDone}
            onCancel={onClose}
          />
        )}

        {step === 'manual-form' && entryType === 'coaster' && (
          <CoasterManualForm
            mode={mode}
            initialCoaster={mode === 'edit' ? (target as Coaster) : undefined}
            onDone={handleDone}
            onCancel={onClose}
          />
        )}

        {step === 'rcdb-stub' && (
          <div>
            <h2>{mode === 'add' ? 'Add' : 'Edit'} From RCDB</h2>
            <p>Coming in the next version - pulling data straight from RCDB isn't wired up yet. Use "Manually" for now.</p>
            <button onClick={() => setStep('source')}>Back</button>
          </div>
        )}
      </div>
    </div>
  )
}
