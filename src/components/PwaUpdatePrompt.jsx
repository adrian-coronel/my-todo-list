import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: '10px 16px', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: 13,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--text-primary)' }}>Nueva versión disponible</span>
      <button className="btn btn-primary btn-sm" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  );
}
