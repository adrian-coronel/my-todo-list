import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sun, Moon, Settings, X, Plus, Trash2 } from 'lucide-react';

const PREDEFINED_COLORS = [
  '#ef4444', '#f87171', '#dc2626', '#f97316', '#fb923c', '#ea580c',
  '#f59e0b', '#fbbf24', '#d97706', '#84cc16', '#a3e635', '#65a30d',
  '#10b981', '#34d399', '#059669', '#06b6d4', '#22d3ee', '#0891b2',
  '#3b82f6', '#60a5fa', '#2563eb', '#6366f1', '#818cf8', '#4f46e5',
  '#8b5cf6', '#a78bfa', '#7c3aed', '#ec4899', '#f472b6', '#db2777',
  '#d946ef', '#e879f9', '#c026d3', '#64748b', '#94a3b8', '#475569',
];

/* ── Panel de Configuración: Clientes y Proyectos ─────────────────────────── */
const SettingsPanel = ({ onClose }) => {
  const { clients, projects, addClient, removeClient, updateClient, addProject, removeProject, updateProject, getProjectsByClient } = useApp();
  const [newClient, setNewClient]   = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [newProject, setNewProject] = useState('');
  const [pickerTarget, setPickerTarget] = useState(null); // { id, type, color, x, y }

  const COLORS = ['#4A90D9','#7B68EE','#4CAF89','#F0A500','#E05C5C','#00BCD4'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <h3 style={{ fontSize:15, fontWeight:600 }}>Clientes y Proyectos</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body" style={{ gap:16 }}>
          {/* Crear cliente */}
          <div>
            <label className="form-label">Nuevo Cliente</label>
            <div className="flex-row gap-2" style={{ marginTop:4 }}>
              <input className="input" style={{flex:1}} placeholder="Ej. Acme Corp"
                value={newClient} onChange={e => setNewClient(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter' && newClient.trim()) { addClient(newClient.trim(), COLORS[clients.length%COLORS.length]); setNewClient(''); }}}/>
              <button className="btn btn-primary" onClick={() => { if(newClient.trim()){ addClient(newClient.trim(), COLORS[clients.length%COLORS.length]); setNewClient(''); }}}>
                <Plus size={14}/> Agregar
              </button>
            </div>
          </div>

          {/* Lista de clientes */}
          {clients.length > 0 && (
            <div>
              <label className="form-label" style={{ display:'block', marginBottom:6 }}>Clientes registrados</label>
              {clients.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                  <div title="Cambiar color del cliente" 
                       onClick={(e) => {
                         const rect = e.currentTarget.getBoundingClientRect();
                         setPickerTarget({ id: c.id, type: 'client', color: c.color, x: rect.left, y: rect.bottom + 4 });
                       }}
                       style={{ width:12, height:12, borderRadius:2, background:c.color, cursor:'pointer', flexShrink:0 }} />
                  <input value={c.name} onChange={e => updateClient(c.id, { name: e.target.value })} title="Editar nombre de cliente"
                    style={{ flex:1, fontSize:13, background:'transparent', border:'none', color:'var(--text-primary)', outline:'none', fontWeight:500 }} />
                  <span className="text-micro">{getProjectsByClient(c.id).length} proyecto(s)</span>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{color:'var(--accent-red)'}} title="Eliminar cliente" onClick={() => removeClient(c.id)}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="divider"/>

          {/* Crear proyecto */}
          <div>
            <label className="form-label">Nuevo Proyecto</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:4 }}>
              <select className="input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                <option value="">Seleccionar cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex-row gap-2">
                <input className="input" style={{flex:1}} placeholder="Nombre del proyecto"
                  value={newProject} onChange={e => setNewProject(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter' && newProject.trim() && selectedClient){
                    addProject(selectedClient, newProject.trim()); setNewProject('');
                  }}}/>
                <button className="btn btn-primary" disabled={!selectedClient}
                  onClick={() => { if(newProject.trim() && selectedClient){ addProject(selectedClient, newProject.trim()); setNewProject(''); }}}>
                  <Plus size={14}/> Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Lista de proyectos */}
          {projects.length > 0 && (
            <div>
              <label className="form-label" style={{ display:'block', marginBottom:6 }}>Proyectos registrados</label>
              {clients.map(c => {
                const cProjects = getProjectsByClient(c.id);
                if (!cProjects.length) return null;
                return (
                  <div key={c.id} style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>{c.name}</div>
                    {cProjects.map(p => (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px', background:'var(--surface-1)', borderRadius:'var(--radius-xs)', marginBottom:3 }}>
                        <div title="Cambiar color del proyecto"
                             onClick={(e) => {
                               const rect = e.currentTarget.getBoundingClientRect();
                               setPickerTarget({ id: p.id, type: 'project', color: p.color, x: rect.left, y: rect.bottom + 4 });
                             }}
                             style={{ width:10, height:10, borderRadius:2, background:p.color, cursor:'pointer', flexShrink:0 }} />
                        <input value={p.name} onChange={e => updateProject(p.id, { name: e.target.value })} title="Editar nombre de proyecto"
                          style={{ flex:1, fontSize:13, background:'transparent', border:'none', color:'var(--text-secondary)', outline:'none' }} />
                        <button className="btn btn-ghost btn-icon btn-sm" style={{color:'var(--accent-red)'}} title="Eliminar proyecto" onClick={() => removeProject(p.id)}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Popover de ColorPicker */}
      {pickerTarget && (
        <>
          <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:1100 }} onClick={() => setPickerTarget(null)} />
          <div style={{
            position:'fixed', left: Math.min(pickerTarget.x, window.innerWidth - 160), top: Math.min(pickerTarget.y, window.innerHeight - 200),
            width: 154, maxHeight: 200, overflowY:'auto', background:'var(--bg-tertiary)', border:'1px solid var(--border-default)',
            padding: 8, borderRadius:'var(--radius-md)', zIndex:1101, boxShadow:'0 4px 12px rgba(0,0,0,0.2)',
            display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap: 4
          }}>
            {PREDEFINED_COLORS.map(color => (
              <div key={color} title="Elegir color" onClick={() => {
                  if (pickerTarget.type === 'client') updateClient(pickerTarget.id, { color });
                  if (pickerTarget.type === 'project') updateProject(pickerTarget.id, { color });
                  setPickerTarget(null);
                }}
                style={{
                  width:18, height:18, borderRadius:2, background:color, cursor:'pointer',
                  border: pickerTarget.color === color ? '2px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.1)',
                  transform: pickerTarget.color === color ? 'scale(1.15)' : 'none'
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ── Header ───────────────────────────────────────────────────────────────── */
const AppHeader = () => {
  const { theme, setTheme } = useApp();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="app-header">
        <div className="flex-row gap-2">
          <span style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)' }}>
            Chrono<span style={{ color:'var(--accent-blue)' }}>Tracker</span>
          </span>
        </div>

        <div className="flex-row gap-2">
          <button className="btn btn-ghost btn-icon" title="Configuración" onClick={() => setShowSettings(true)}>
            <Settings size={16}/>
          </button>
          <button className="btn btn-ghost btn-icon" title={theme==='dark' ? 'Modo claro' : 'Modo oscuro'}
            onClick={() => setTheme(t => t==='dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
          </button>
        </div>
      </header>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)}/>}
    </>
  );
};

export default AppHeader;
