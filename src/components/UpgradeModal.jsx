import { useEffect } from 'react'
import { X, Crown } from 'lucide-react'

const MESSAGES = {
  clients:      'Has alcanzado el límite de 3 clientes en el plan gratuito.',
  projects:     'Has alcanzado el límite de 5 proyectos en el plan gratuito.',
  reports:      'Los reportes de tiempo son una funcionalidad Pro.',
  pdf:          'La exportación a PDF es una funcionalidad Pro.',
  integrations: 'Las integraciones de calendario son una funcionalidad Pro.',
}

export default function UpgradeModal({ reason, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!reason) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crown size={18} style={{ color: 'var(--accent-amber)' }} />
            Funcionalidad Pro
          </h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 16, textAlign: 'center', padding: '24px 20px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto',
          }}>
            <Crown size={28} style={{ color: 'var(--accent-amber)' }} />
          </div>

          <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
            {MESSAGES[reason] || 'Esta funcionalidad requiere un plan Pro.'}
          </p>

          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            Actualiza tu plan para desbloquear acceso ilimitado y funcionalidades premium.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={onClose}>Ver planes</button>
        </div>
      </div>
    </div>
  )
}
