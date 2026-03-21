/**
 * GoogleCalendarSettings — UI de configuración para la integración con Google Calendar.
 * Feature Pro: usuarios Free ven UpgradeModal.
 */
import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import UpgradeModal from './UpgradeModal'

/* Ícono de Google Calendar (SVG inline, sin dependencia externa) */
const GCalIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.8"/>
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

/* Toggle switch accesible */
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    style={{
      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: checked ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0, outline: 'none',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <span style={{
      position: 'absolute', top: 2, left: checked ? 18 : 2,
      width: 16, height: 16, borderRadius: '50%',
      background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }}/>
  </button>
)

export default function GoogleCalendarSettings() {
  const { gcal, isFree } = useApp()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Mostrar UpgradeModal si el usuario es Free
  const guardPro = (fn) => {
    if (isFree) { setShowUpgrade(true); return }
    fn()
  }

  const handleConnect = () => guardPro(async () => {
    setConnecting(true)
    try { await gcal.connect() }
    finally { setConnecting(false) }
  })

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Google Calendar? Tus bloques de Kron no se eliminarán de Google.')) return
    await gcal.disconnect()
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Encabezado de sección */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-blue)',
        }}>
          <GCalIcon size={15}/>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
            Google Calendar
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Sincronización bidireccional
          </div>
        </div>
        {isFree && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
            background: 'var(--accent-amber)', color: '#000', borderRadius: 4, padding: '2px 6px',
          }}>PRO</span>
        )}
      </div>

      {gcal?.integrationLoading ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>Cargando…</div>
      ) : !gcal?.isConnected ? (
        /* ── Estado: no conectado ─────────────────────────────────────────── */
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
            Conecta tu cuenta de Google para sincronizar tus bloques de tiempo con Google Calendar y ver tus eventos de Google en Kron.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', gap: 8, justifyContent: 'center' }}
            onClick={handleConnect}
            disabled={connecting}
          >
            <GCalIcon size={14}/>
            {connecting ? 'Conectando…' : 'Conectar Google Calendar'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4 }}>
            Se abrirá la pantalla de autorización de Google. Si ya tenías una sesión activa, solo verás la pantalla de permisos.
          </p>
        </div>
      ) : (
        /* ── Estado: conectado ────────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Badge de estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green, #10b981)', flexShrink: 0 }}/>
            <span style={{ fontSize: 12, color: 'var(--accent-green, #10b981)', fontWeight: 600 }}>Conectado</span>
          </div>

          {/* Toggle: sincronizar bloques Kron → Google */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                Sincronizar bloques con Google
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Crea / edita / elimina eventos en tu Google Calendar
              </div>
            </div>
            <Toggle
              checked={gcal.syncToGoogle}
              onChange={gcal.toggleSyncToGoogle}
            />
          </div>

          {/* Toggle: mostrar eventos de Google en Kron */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                Mostrar eventos de Google en Kron
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Visible como bloques de solo lectura en el calendario
              </div>
            </div>
            <Toggle
              checked={gcal.showGoogleEvents}
              onChange={gcal.toggleShowGoogleEvents}
            />
          </div>

          {/* Botón desconectar */}
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4, alignSelf: 'flex-start' }}
            onClick={handleDisconnect}
          >
            Desconectar
          </button>
        </div>
      )}

      <UpgradeModal reason={showUpgrade ? 'integrations' : null} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
