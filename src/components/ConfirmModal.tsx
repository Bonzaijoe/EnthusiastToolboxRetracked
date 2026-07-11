interface ConfirmModalProps {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ message, confirmLabel = 'Continue', onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          background: 'Canvas',
          color: 'CanvasText',
          border: '1px solid rgba(128, 128, 128, 0.4)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 360,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ marginTop: 0 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} style={{ fontWeight: 600 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
