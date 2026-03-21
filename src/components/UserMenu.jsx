/**
 * UserMenu — avatar clickeable en el header que abre un panel de cuenta.
 * Consolida: info de usuario, plan, Google Calendar, tema y cerrar sesión.
 */
import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Sun, Moon, SunMedium, Calendar, Settings, LogOut, CreditCard, ChevronRight } from 'lucide-react'
import GoogleCalendarSettings from './GoogleCalendarSettings'
import UpgradeModal from './UpgradeModal'

/* ── Avatar ──────────────────────────────────────────────────────────────── */
const UserAvatar = ({ user, size = 32 }) => {
  const avatarUrl = user?.user_metadata?.avatar_url
  const name = user?.user_metadata?.full_name || user?.email || ''
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || '?'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent-purple)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 600, color: '#fff',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}

/* ── Plan Badge ──────────────────────────────────────────────────────────── */
const PlanBadge = ({ plan, isFree }) => {
  if (plan === 'lifetime') {
    return <span className="plan-badge plan-badge-lifetime">Lifetime ✓</span>
  }
  if (!isFree) {
    return <span className="plan-badge plan-badge-pro">Pro ✓</span>
  }
  return <span className="plan-badge plan-badge-free">Free</span>
}

/* ── UserMenu ────────────────────────────────────────────────────────────── */
export default function UserMenu() {
  const { theme, setTheme, isFree, plan } = useApp()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(null) // null | 'gcal' | 'settings'
  const [showUpgrade, setShowUpgrade] = useState(false)
  const menuRef = useRef(null)

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const email = user?.email || ''

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') { setOpen(false); setSection(null) } }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setSection(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggleSection = (name) => setSection(s => s === name ? null : name)

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      {/* Trigger: avatar */}
      <button
        className="btn btn-ghost btn-icon user-menu-trigger"
        onClick={() => setOpen(v => !v)}
        title="Cuenta"
        aria-label="Abrir menú de cuenta"
        aria-expanded={open}
      >
        <UserAvatar user={user} size={28} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="user-menu-dropdown" role="menu">

          {/* ── Usuario + Plan ─────────────────────────────────────────── */}
          <div className="user-menu-header">
            <UserAvatar user={user} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
            </div>
            <PlanBadge plan={plan} isFree={isFree} />
          </div>

          <div className="user-menu-divider" />

          {/* ── Navegación ────────────────────────────────────────────── */}
          <div className="user-menu-section">
            {/* Google Calendar */}
            <button
              className={`user-menu-item${section === 'gcal' ? ' active' : ''}`}
              onClick={() => toggleSection('gcal')}
              aria-expanded={section === 'gcal'}
            >
              <Calendar size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Google Calendar</span>
              <ChevronRight size={12} style={{ transition: 'transform var(--t-fast)', transform: section === 'gcal' ? 'rotate(90deg)' : 'none', color: 'var(--text-tertiary)' }} />
            </button>

            {section === 'gcal' && (
              <div className="user-menu-subsection">
                <GoogleCalendarSettings />
              </div>
            )}

            {/* Configuración (tema) */}
            <button
              className={`user-menu-item${section === 'settings' ? ' active' : ''}`}
              onClick={() => toggleSection('settings')}
              aria-expanded={section === 'settings'}
            >
              <Settings size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Configuración</span>
              <ChevronRight size={12} style={{ transition: 'transform var(--t-fast)', transform: section === 'settings' ? 'rotate(90deg)' : 'none', color: 'var(--text-tertiary)' }} />
            </button>

            {section === 'settings' && (
              <div className="user-menu-subsection">
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Apariencia
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { value: 'dark',   label: 'Dark',   icon: <Moon size={13}/> },
                    { value: 'medium', label: 'Medio',  icon: <SunMedium size={13}/> },
                    { value: 'light',  label: 'Claro',  icon: <Sun size={13}/> },
                  ].map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        padding: '8px 4px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                        transition: 'all var(--t-fast)',
                        borderColor: theme === value ? 'var(--accent-blue)' : 'var(--border-subtle)',
                        background: theme === value ? 'rgba(74,144,217,0.12)' : 'transparent',
                        color: theme === value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        fontWeight: theme === value ? 600 : 400,
                      }}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Upgrade (solo Free) ────────────────────────────────────── */}
          {isFree && (
            <>
              <div className="user-menu-divider" />
              <div className="user-menu-section">
                <button
                  className="user-menu-item user-menu-item-upgrade"
                  onClick={() => setShowUpgrade(true)}
                >
                  <CreditCard size={14} style={{ flexShrink: 0 }} />
                  <span>Ver planes</span>
                </button>
              </div>
            </>
          )}

          <div className="user-menu-divider" />

          {/* ── Cerrar sesión ──────────────────────────────────────────── */}
          <div className="user-menu-section">
            <button className="user-menu-item user-menu-item-danger" onClick={signOut}>
              <LogOut size={14} style={{ flexShrink: 0 }} />
              <span>Cerrar sesión</span>
            </button>
          </div>

        </div>
      )}

      <UpgradeModal reason={showUpgrade ? 'reports' : null} onClose={() => setShowUpgrade(false)} />
    </div>
  )
}
