import type { ReactNode } from 'react'

interface SidePanelProps {
  onClose: () => void
  children: ReactNode
}

// Generic right-anchored slide-out drawer shell, shared by RankingSidePanel,
// ParkDetailPanel, and CoasterDetailPanel - they supply their own header/body
// as children; this just owns the overlay, positioning, and dismiss behavior.
export function SidePanel({ onClose, children }: SidePanelProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 900 }}
      onClick={onClose}
    >
      <div
        className="side-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(420px, 100%)',
          background: 'Canvas',
          color: 'CanvasText',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
          overflowY: 'auto',
          padding: '1.5rem',
          zIndex: 901,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} style={{ float: 'right' }} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
