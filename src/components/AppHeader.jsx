import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, SunMedium, X, Plus, Trash2, Menu, LogOut, FileBarChart, Sparkles } from 'lucide-react';
import UpgradeModal from './UpgradeModal';
import ReportModal from './ReportModal';

const PREDEFINED_COLORS = [
  '#ef4444', '#f87171', '#dc2626', '#f97316', '#fb923c', '#ea580c',
  '#f59e0b', '#fbbf24', '#d97706', '#84cc16', '#a3e635', '#65a30d',
  '#10b981', '#34d399', '#059669', '#06b6d4', '#22d3ee', '#0891b2',
  '#3b82f6', '#60a5fa', '#2563eb', '#6366f1', '#818cf8', '#4f46e5',
  '#8b5cf6', '#a78bfa', '#7c3aed', '#ec4899', '#f472b6', '#db2777',
  '#d946ef', '#e879f9', '#c026d3', '#64748b', '#94a3b8', '#475569',
];

/* ── Panel de Configuración: Clientes y Proyectos ─────────────────────────── */
export const SettingsPanel = ({ onClose }) => {
  const { clients, projects, addClient, removeClient, updateClient, addProject, removeProject, updateProject, getProjectsByClient, isFree, canAddClient, canAddProject, FREE_LIMITS } = useApp();
  const [newClient, setNewClient]   = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [newProject, setNewProject] = useState('');
  const [pickerTarget, setPickerTarget] = useState(null); // { id, type, color, x, y }
  const [upgradeReason, setUpgradeReason] = useState(null);

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
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <label className="form-label">Nuevo Cliente</label>
              {isFree && <span className="text-micro" style={{ color: canAddClient ? 'var(--text-tertiary)' : 'var(--accent-amber)' }}>{clients.length} de {FREE_LIMITS.clients}</span>}
            </div>
            <div className="flex-row-responsive" style={{ marginTop:4 }}>
              <input className="input" style={{flex:1, opacity: canAddClient ? 1 : 0.5}} placeholder="Ej. Acme Corp"
                disabled={!canAddClient}
                value={newClient} onChange={e => setNewClient(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter' && newClient.trim()) {
                  if(!canAddClient) { setUpgradeReason('clients'); return; }
                  addClient(newClient.trim(), PREDEFINED_COLORS[clients.length%PREDEFINED_COLORS.length]); setNewClient('');
                }}}/>
              <button className="btn btn-primary" onClick={() => {
                if(!canAddClient) { setUpgradeReason('clients'); return; }
                if(newClient.trim()){ addClient(newClient.trim(), PREDEFINED_COLORS[clients.length%PREDEFINED_COLORS.length]); setNewClient(''); }
              }}>
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
                  <input type="number" min="0" step="0.01" placeholder="$/h"
                    value={c.hourlyRate ?? ''} onChange={e => updateClient(c.id, { hourlyRate: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    title="Tarifa por hora"
                    style={{ width:60, fontSize:11, background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-xs)',
                      color:'var(--text-secondary)', padding:'2px 6px', textAlign:'right', outline:'none' }} />
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
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <label className="form-label">Nuevo Proyecto</label>
              {isFree && <span className="text-micro" style={{ color: canAddProject ? 'var(--text-tertiary)' : 'var(--accent-amber)' }}>{projects.length} de {FREE_LIMITS.projects}</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:4 }}>
              <select className="input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                <option value="">Seleccionar cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex-row-responsive">
                <input className="input" style={{flex:1, opacity: canAddProject ? 1 : 0.5}} placeholder="Nombre del proyecto"
                  disabled={!canAddProject}
                  value={newProject} onChange={e => setNewProject(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter' && newProject.trim() && selectedClient){
                    if(!canAddProject) { setUpgradeReason('projects'); return; }
                    addProject(selectedClient, newProject.trim()); setNewProject('');
                  }}}/>
                <button className="btn btn-primary" disabled={!selectedClient}
                  onClick={() => {
                    if(!canAddProject) { setUpgradeReason('projects'); return; }
                    if(newProject.trim() && selectedClient){ addProject(selectedClient, newProject.trim()); setNewProject(''); }
                  }}>
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

      <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />

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
  const { theme, setTheme, setIsMobileSidebarOpen, isFree } = useApp();
  const { signOut } = useAuth();
  const [showReport, setShowReport] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState(null);

  return (
    <header className="app-header">
      <div className="flex-row gap-2">
        <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setIsMobileSidebarOpen(true)}>
          <Menu size={18}/>
        </button>
        <span className="app-header-title" style={{ fontSize:18, fontWeight:700, letterSpacing:'-0.03em', color:'var(--text-primary)', display:'flex', alignItems:'center', gap: '8px' }}>
          <img src="/logo.png" alt="Logo" style={{ width:24, height:24, borderRadius:4 }} />
          Interstellar<span style={{ color:'var(--accent-blue)', marginLeft:'3px' }}>Mare</span>
        </span>
      </div>

      <div className="flex-row gap-2">
        {isFree ? (
          <button className="upgrade-pill" onClick={() => setUpgradeReason('reports')}>
            <Sparkles size={14} />
            <span>Prueba Pro</span>
          </button>
        ) : (
          <button className="btn btn-ghost btn-icon" title="Reportes" onClick={() => setShowReport(true)}>
            <FileBarChart size={16}/>
          </button>
        )}
        <button className="btn btn-ghost btn-icon"
          title={theme==='dark' ? 'Modo medio' : theme==='medium' ? 'Modo claro' : 'Modo oscuro'}
          onClick={() => setTheme(t => t==='dark' ? 'medium' : t==='medium' ? 'light' : 'dark')}>
          {theme === 'dark' ? <SunMedium size={16}/> : theme === 'medium' ? <Sun size={16}/> : <Moon size={16}/>}
        </button>
        <button className="btn btn-ghost btn-icon" title="Cerrar sesión" onClick={signOut}>
          <LogOut size={16}/>
        </button>
      </div>
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
      <UpgradeModal reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
    </header>
  );
};

export default AppHeader;
