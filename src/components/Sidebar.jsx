import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Check, ChevronDown, ChevronRight, X, PanelLeftClose, PanelRightClose, Briefcase } from 'lucide-react';
import { SettingsPanel } from './AppHeader';

const PALETTE = ['#4A90D9','#7B68EE','#4CAF89','#F0A500','#E05C5C','#00BCD4','#E91E8C','#FF6B35'];

/* ────────────────────────────────────────────────────────────────────────────
   Modal crear / editar Tarea
   — El color se hereda del proyecto por defecto, pero se puede sobreescribir   #4
──────────────────────────────────────────────────────────────────────────── */
const TaskModal = ({ onClose, editTask }) => {
  const { clients, projects, getProjectsByClient, addTask, updateTask } = useApp();

  const [form, setForm] = useState(() => {
    if (editTask) {
      return {
        title:       editTask.title,
        description: editTask.description || '',
        clientId:    editTask.clientId    || '',
        projectId:   editTask.projectId   || '',
        color:       editTask.color       || PALETTE[0],
        colorOverride: !!editTask.colorOverride, // si el user eligió color manualmente
        isAllDay:    !!editTask.isAllDay,
      };
    }
    return { title:'', description:'', clientId:'', projectId:'', color: PALETTE[0], colorOverride: false, isAllDay: false };
  });

  const availableProjects = getProjectsByClient(form.clientId);

  // Al cambiar proyecto, auto-asignar su color (a menos que el usuario haya overrideado) — #4
  useEffect(() => {
    if (form.colorOverride) return;
    const proj = projects.find(p => p.id === form.projectId);
    if (proj?.color) setForm(f => ({ ...f, color: proj.color }));
    else {
      const client = clients.find(c => c.id === form.clientId);
      if (client?.color) setForm(f => ({ ...f, color: client.color }));
    }
  }, [form.projectId, form.clientId, form.colorOverride]);

  // ESC cierra — #6
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleSave = () => {
    if (!form.title.trim()) return;
    const data = { title:form.title, description:form.description, clientId:form.clientId, projectId:form.projectId, color:form.color, colorOverride:form.colorOverride, isAllDay:form.isAllDay };
    if (editTask) updateTask(editTask.id, data);
    else addTask(data);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:440, minHeight:'auto' }}>
        <div className="modal-header">
          <h3 style={{ fontSize:15, fontWeight:600 }}>{editTask ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="input" placeholder="Nombre de la tarea..." value={form.title} autoFocus
              onChange={e => setForm(f => ({...f, title:e.target.value}))}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}/>
          </div>

          <div className="flex-stack-group flex-row-responsive" style={{ display:'flex', gap:10 }}>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Cliente</label>
              <select className="input" value={form.clientId}
                onChange={e => setForm(f => ({...f, clientId:e.target.value, projectId:'', colorOverride:false}))}>
                <option value="">— Sin cliente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Proyecto</label>
              <select className="input" value={form.projectId} disabled={!form.clientId}
                onChange={e => setForm(f => ({...f, projectId:e.target.value, colorOverride:false}))}>
                <option value="">— Sin proyecto —</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="input" rows={2} placeholder="Descripción opcional..."
              value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))}/>
          </div>

          <div className="form-group">
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px',
              background:'var(--surface-1)', borderRadius:'var(--radius-sm)', marginBottom:4 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flex:1, userSelect:'none' }}>
                <div
                  onClick={() => setForm(f => ({ ...f, isAllDay: !f.isAllDay }))}
                  style={{
                    width:32, height:18, borderRadius:9, cursor:'pointer', flexShrink:0,
                    background: form.isAllDay ? 'var(--accent-blue)' : 'var(--border-default)',
                    position:'relative', transition:'background .2s',
                  }}>
                  <div style={{
                    position:'absolute', top:2, left: form.isAllDay ? 16 : 2,
                    width:14, height:14, borderRadius:'50%', background:'#fff',
                    transition:'left .2s', boxShadow:'0 1px 2px rgba(0,0,0,0.2)',
                  }}/>
                </div>
                <span style={{ fontSize:13, color:'var(--text-primary)', fontWeight: form.isAllDay ? 600 : 400 }}>
                  Tarea de todo el día
                </span>
              </label>
              {form.isAllDay && (
                <span style={{ fontSize:10, color:'var(--accent-blue)', fontWeight:500 }}>
                  PREDETERMINADO
                </span>
              )}
            </div>
          </div>

          {/* Color: muestra el color heredado + opción de personalizar — #4 */}
          <div className="form-group">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <label className="form-label" style={{ margin:0 }}>Color</label>
              {form.colorOverride && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize:10 }}
                  onClick={() => setForm(f => ({...f, colorOverride:false, projectId:f.projectId}))}>
                  ↩ Resetear al proyecto
                </button>
              )}
            </div>
            {!form.colorOverride && (
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:4 }}>
                {form.projectId ? '🎨 Heredado del proyecto' : form.clientId ? '🎨 Heredado del cliente' : 'Elige un color personalizado'}
              </div>
            )}
            <div className="flex-row gap-2" style={{ flexWrap:'wrap' }}>
              {/* Vista previa del color actual */}
              <div style={{ width:24, height:24, borderRadius:'50%', background:form.color, border:'3px solid rgba(255,255,255,0.3)', flexShrink:0 }}/>
              <div style={{ width:1, height:20, background:'var(--border-default)' }}/>
              {PALETTE.map(c => (
                <button key={c} title="Personalizar color"
                  onClick={() => setForm(f => ({...f, color:c, colorOverride:true}))}
                  style={{ width:20, height:20, borderRadius:'50%', background:c,
                    border: (form.colorOverride && form.color===c) ? '2px solid #fff' : '2px solid transparent',
                    cursor:'pointer', flexShrink:0, opacity: form.colorOverride && form.color!==c ? 0.6 : 1 }}/>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>{editTask ? 'Guardar' : 'Crear Tarea'}</button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
   Ítem de Tarea en el Sidebar
──────────────────────────────────────────────────────────────────────────── */
const TaskItem = React.memo(({ task, onEdit, onEditSubtask, isSelected, onSelect, selectedIds }) => {
  const { addSubtask, updateSubtask, toggleSubtask, removeSubtask, removeTask, getClient, getProject, updateTask } = useApp();
  const [expanded, setExpanded]   = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [hovered, setHovered]     = useState(false);

  const client    = getClient(task.clientId);
  const project   = getProject(task.projectId);
  const subtasks  = task.subtasks || [];
  const doneCount = subtasks.filter(s => s.done).length;
  const totalCount = subtasks.length;

  // Drag de la TAREA completa al calendario
  // Si hay múltiples seleccionadas y esta está en la selección, arrastra todas
  const handleTaskDragStart = (e) => {
    if (isSelected && selectedIds && selectedIds.size > 1) {
      e.dataTransfer.setData('application/json', JSON.stringify({ type:'tasks', taskIds:[...selectedIds] }));
    } else {
      e.dataTransfer.setData('application/json', JSON.stringify({ type:'task', taskId:task.id }));
    }
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Drag de una SUBTAREA al calendario — #1
  const handleSubtaskDragStart = (e, subtask) => {
    e.stopPropagation(); // no propagar al drag de la tarea padre
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'subtask',
      taskId: task.id,
      subtaskId: subtask.id,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    addSubtask(task.id, newSubtask.trim());
    setNewSubtask('');
  };

  return (
    <div
      className={`task-item${task.status==='done'?' is-done':''}${isSelected?' task-selected':''}`}
      style={{ borderLeftColor: task.color || 'transparent' }}
      draggable
      onDragStart={handleTaskDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect && onSelect(task.id)}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit(task); }}
      title="Clic para seleccionar · Doble clic para editar"
    >
      {/* ─── Fila principal ─── */}
      <div className="flex-row gap-2" style={{ justifyContent:'space-between' }}>
        <div className="flex-row gap-2" style={{ minWidth:0, flex:1 }}>
          <div
            className={`check-circle${task.status==='done'?' done':''}`}
            style={{ flexShrink:0 }}
            onClick={e => { e.stopPropagation(); updateTask(task.id, { status: task.status==='done'?'pending':'done' }); }}
          >
            {task.status === 'done' && <Check size={10} color="#fff"/>}
          </div>
          <span className="task-title truncate"
            style={{ textDecoration: task.status==='done'?'line-through':'none', flex:1 }}>
            {task.title}
          </span>
        </div>

        <div className="flex-row gap-1" style={{ flexShrink:0 }}>
          {hovered && (
            <>
              <button className="btn btn-ghost btn-icon btn-sm" title="Editar"
                onClick={e => { e.stopPropagation(); onEdit(task); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" title="Eliminar" style={{ color:'var(--accent-red)' }}
                onClick={e => { e.stopPropagation(); removeTask(task.id); }}>
                <X size={12}/>
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-icon btn-sm"
            title={expanded ? 'Colapsar' : 'Ver subtareas'}
            onClick={e => { e.stopPropagation(); setExpanded(p=>!p); }}>
            {expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
          </button>
        </div>
      </div>

      {/* Metadatos */}
      {(client || project) && (
        <div className="task-meta truncate" style={{ marginLeft:22 }}>
          {client?.name}{project && ` › ${project.name}`}
        </div>
      )}

      {/* Barra de progreso colapsada */}
      {totalCount > 0 && !expanded && (
        <div style={{ marginLeft:22, marginTop:4 }}>
          <div style={{ height:3, borderRadius:3, background:task.color||'var(--accent-blue)', opacity:0.25, width:'100%' }}>
            <div style={{ height:'100%', borderRadius:3, background:task.color||'var(--accent-blue)', width:`${(doneCount/totalCount)*100}%` }}/>
          </div>
          <span className="text-micro">{doneCount}/{totalCount} subtareas</span>
        </div>
      )}

      {/* ─── Panel expandido ─── */}
      {expanded && (
        <div style={{ marginLeft:22, marginTop:8, display:'flex', flexDirection:'column', gap:3 }}>

          {subtasks.map(st => (
            <div
              key={st.id}
              className={`subtask-item${st.done?' done':''}`}
              draggable                                          /* Drag subtarea — #1 */
              onDragStart={e => handleSubtaskDragStart(e, st)}
              onClick={() => toggleSubtask(task.id, st.id)}
              onDoubleClick={e => { e.stopPropagation(); onEditSubtask(task, st); }}
              title="Arrastra para asignar tiempo. Doble clic para editar."
            >
              <div className={`check-circle${st.done?' done':''}`} style={{ width:14, height:14, flexShrink:0 }}>
                {st.done && <Check size={9} color="#fff"/>}
              </div>
              {/* Barra de color del padre para identificar visualmente — #1 */}
              <div style={{ width:3, height:14, borderRadius:2, background:task.color||'var(--accent-blue)', flexShrink:0, opacity:0.7 }}/>
              <span style={{ flex:1, display:'flex', flexDirection:'column', gap:1, minWidth:0 }}>
                <span>{st.title}</span>
                {st.description && (
                  <span style={{ fontSize:11, color:'var(--text-tertiary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {st.description}
                  </span>
                )}
              </span>
              <button className="btn btn-ghost btn-icon btn-sm"
                onClick={e => { e.stopPropagation(); removeSubtask(task.id, st.id); }}>
                <X size={10}/>
              </button>
            </div>
          ))}

          {/* Input nueva subtarea */}
          <div className="flex-row gap-1" style={{ marginTop: totalCount>0?6:0 }}>
            <input
              className="input"
              style={{ flex:1, padding:'4px 8px', fontSize:12 }}
              placeholder="Nueva subtarea... (Enter)"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') handleAddSubtask(); e.stopPropagation(); }}
              onClick={e => e.stopPropagation()}
            />
            {newSubtask.trim() && (
              <button className="btn btn-primary btn-sm"
                onClick={e => { e.stopPropagation(); handleAddSubtask(); }}>
                <Plus size={12}/>
              </button>
            )}
          </div>

          {/* Barra de progreso expandida */}
          {totalCount > 0 && (
            <div style={{ marginTop:4 }}>
              <div style={{ height:3, borderRadius:3, background:task.color||'var(--accent-blue)', opacity:0.25, width:'100%' }}>
                <div style={{ height:'100%', borderRadius:3, background:task.color||'var(--accent-blue)', width:`${(doneCount/totalCount)*100}%` }}/>
              </div>
              <span className="text-micro">{doneCount}/{totalCount} completadas</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────────────
   Sidebar Principal
──────────────────────────────────────────────────────────────────────────── */
const Sidebar = () => {
  const { tasks, updateSubtask, isMobileSidebarOpen, setIsMobileSidebarOpen } = useApp();
  const [showModal, setShowModal]           = useState(false);
  const [editingTask, setEditingTask]       = useState(null);
  const [editingSubtask, setEditingSubtask] = useState(null); // { task, subtask }
  const [filter, setFilter]                 = useState('all');
  const [collapsed, setCollapsed]           = useState(false);
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());

  const toggleSelect = useCallback((taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleEdit = useCallback((task) => { setEditingTask(task); setShowModal(true); }, []);
  const handleEditSubtask = useCallback((task, subtask) => setEditingSubtask({ task, subtask }), []);

  // Subtask Edit Input State
  const [stEditTitle, setStEditTitle] = useState('');
  const [stEditDesc,  setStEditDesc]  = useState('');
  useEffect(() => {
    if (editingSubtask) {
      setStEditTitle(editingSubtask.subtask.title);
      setStEditDesc(editingSubtask.subtask.description || '');
    }
  }, [editingSubtask]);

  const filtered = useMemo(() => tasks.filter(t => {
    if (filter === 'pending') return t.status !== 'done';
    if (filter === 'done')    return t.status === 'done';
    return true;
  }), [tasks, filter]);

  // Touch Swipes para cerrar y abrir Sidebar
  const [touchX, setTouchX] = useState(null);
  const handleTouchStart = e => setTouchX(e.touches[0].clientX);
  const handleTouchMoveClose = e => {
    if (touchX !== null && touchX - e.touches[0].clientX > 40) {
      setIsMobileSidebarOpen(false); setTouchX(null);
    }
  };
  const handleTouchMoveOpen = e => {
    if (touchX !== null && e.touches[0].clientX - touchX > 40) {
      setIsMobileSidebarOpen(true); setTouchX(null);
    }
  };
  const handleTouchEnd = () => setTouchX(null);

  return (
    <>
      {/* Trigger Edge para abrir menú con el dedo */}
      {!isMobileSidebarOpen && (
        <div className="mobile-only" style={{ position:'fixed', top:50, bottom:0, left:0, width:15, zIndex:100 }}
             onTouchStart={handleTouchStart} onTouchMove={handleTouchMoveOpen} onTouchEnd={handleTouchEnd} />
      )}
      
      <div className={`sidebar-overlay ${isMobileSidebarOpen ? 'visible' : ''}`} onClick={() => setIsMobileSidebarOpen(false)} />
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${isMobileSidebarOpen ? ' mobile-open' : ''}`}
             onTouchStart={handleTouchStart} onTouchMove={handleTouchMoveClose} onTouchEnd={handleTouchEnd}>
      <div className="sidebar-header" style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '12px 0' : '12px 16px' }}>
        {!collapsed && <span style={{ fontWeight:600, fontSize:13 }}>Tareas</span>}
        <div className="flex-row gap-1">
          {!collapsed && (
            <>
              <button className="btn btn-ghost btn-icon btn-sm" title="Clientes y Proyectos"
                onClick={() => setShowClientPanel(true)}>
                <Briefcase size={15}/>
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" title="Nueva tarea"
                onClick={() => { setEditingTask(null); setShowModal(true); }}>
                <Plus size={16}/>
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-icon btn-sm desktop-only" title={collapsed ? "Expandir" : "Contraer panel"}
            onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelRightClose size={16}/> : <PanelLeftClose size={16}/>}
          </button>
          <button className="btn btn-ghost btn-icon btn-sm mobile-only" title="Cerrar panel" onClick={() => setIsMobileSidebarOpen(false)}>
            <X size={16}/>
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Filtros */}
          <div className="flex-row gap-1" style={{ padding:'6px 12px', flexShrink:0 }}>
            {[['all','Todas'],['pending','Activas'],['done','Listas']].map(([id,lbl]) => (
              <button key={id} onClick={() => setFilter(id)}
                className={`btn btn-sm ${filter===id?'btn-primary':'btn-ghost'}`}
                style={{ flex:1, justifyContent:'center', fontSize:11 }}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="divider" style={{ margin:'4px 0' }}/>

          {selectedTaskIds.size > 0 ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'5px 12px', background:'var(--surface-2)', borderBottom:'1px solid var(--border-subtle)',
              flexShrink:0 }}>
              <span style={{ fontSize:11, color:'var(--accent-blue)', fontWeight:600 }}>
                {selectedTaskIds.size} seleccionada{selectedTaskIds.size > 1 ? 's' : ''}
              </span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:10, padding:'2px 6px' }}
                onClick={() => setSelectedTaskIds(new Set())}>
                Limpiar
              </button>
            </div>
          ) : (
            <p className="text-micro" style={{ padding:'4px 16px', opacity:0.6 }}>
              Clic para seleccionar · Arrastra al calendario
            </p>
          )}

          <div className="sidebar-content">
            {filtered.length === 0 ? (
              <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--text-tertiary)' }}>
                <p style={{ fontSize:13 }}>Sin tareas {filter==='done'?'completadas':filter==='pending'?'activas':'creadas'}</p>
                <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={() => setShowModal(true)}>
                  <Plus size={13}/> Nueva tarea
                </button>
              </div>
            ) : filtered.map(t => (
              <TaskItem key={t.id} task={t}
                onEdit={handleEdit}
                onEditSubtask={handleEditSubtask}
                isSelected={selectedTaskIds.has(t.id)}
                onSelect={toggleSelect}
                selectedIds={selectedTaskIds}/>
            ))}
          </div>
        </>
      )}
    </aside>

    {/* Popups desplazados fuera del "aside" para evitar contención de transforms */}
    {/* Tarea Modal */}
    {showModal && (
      <TaskModal
        editTask={editingTask}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
      />
    )}

    {/* Panel Clientes y Proyectos */}
    {showClientPanel && <SettingsPanel onClose={() => setShowClientPanel(false)}/>}

    {/* Subtarea Edit Modal */}
    {editingSubtask && (
      <div className="modal-overlay" style={{ background:'rgba(0,0,0,0.4)', zIndex:1100 }} onClick={(e) => e.target === e.currentTarget && setEditingSubtask(null)}>
        <div className="modal" style={{ maxWidth: 340, padding:16, animation:'fadeIn 0.1s' }}>
          <div style={{ fontWeight:600, marginBottom:12, fontSize:13 }}>Editar subtarea</div>
          <div className="form-group" style={{ marginBottom:10 }}>
            <label className="form-label">Título</label>
            <input className="input" autoFocus value={stEditTitle}
              onChange={e => setStEditTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditingSubtask(null); }} />
          </div>
          <div className="form-group" style={{ marginBottom:12 }}>
            <label className="form-label">Descripción</label>
            <textarea className="input" rows={3}
              style={{ resize:'vertical', fontSize:13 }}
              placeholder="Detalle de la subtarea..."
              value={stEditDesc}
              onChange={e => setStEditDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditingSubtask(null); }} />
          </div>
          <div className="flex-row gap-1" style={{ justifyContent:'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingSubtask(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={async () => {
              if (!stEditTitle.trim()) return;
              await updateSubtask(editingSubtask.task.id, editingSubtask.subtask.id, { title: stEditTitle.trim(), description: stEditDesc.trim() });
              setEditingSubtask(null);
            }}>Guardar</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Sidebar;
