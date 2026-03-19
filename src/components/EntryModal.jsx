import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { X } from 'lucide-react';

/* Modal para crear o editar una entrada de tiempo */
const EntryModal = ({ data, onClose }) => {
  const { tasks, clients, getProjectsByClient, addEntry, updateEntry, removeEntry } = useApp();

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const isEdit = !!data.entry;
  const existingEntry = data.entry;
  const today = format(new Date(), 'yyyy-MM-dd');

  const [form, setForm] = useState(isEdit ? {
    taskId:    existingEntry.taskId    || '',
    subtaskId: existingEntry.subtaskId || '',
    clientId:  existingEntry.clientId  || '',
    projectId: existingEntry.projectId || '',
    date:      existingEntry.date      || today,
    startTime: existingEntry.startTime || '09:00',
    endTime:   existingEntry.endTime   || '10:00',
    notes:     existingEntry.notes     || '',
  } : {
    taskId:    '',
    subtaskId: '',
    clientId:  '',
    projectId: '',
    date:      data.date      || today,
    startTime: data.startTime || '09:00',
    endTime:   data.endTime   || '10:00',
    notes:     '',
  });

  const projects = getProjectsByClient(form.clientId);
  const selectedTask = tasks.find(t => t.id === form.taskId);
  const taskSubtasks = selectedTask?.subtasks || [];

  const handleTaskChange = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    setForm(p => ({
      ...p,
      taskId,
      subtaskId: '', // reset subtarea al cambiar tarea
      clientId:  task?.clientId  || p.clientId,
      projectId: task?.projectId || p.projectId,
    }));
  };

  const handleSave = () => {
    if (!form.taskId && !form.clientId) return;
    const entryData = { ...form };
    // Incluir subtaskTitle como caché si hay subtarea seleccionada
    if (form.subtaskId) {
      const st = taskSubtasks.find(s => s.id === form.subtaskId);
      entryData.subtaskTitle = st?.title || '';
      entryData.isSubtask = true;
    } else {
      entryData.subtaskId = null;
      entryData.subtaskTitle = '';
      entryData.isSubtask = false;
    }
    if (isEdit) {
      updateEntry(existingEntry.id, entryData);
    } else {
      addEntry(entryData);
    }
    onClose();
  };

  const handleDelete = () => {
    removeEntry(existingEntry.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3 style={{ fontSize:15, fontWeight:600 }}>
            {isEdit ? 'Editar entrada de tiempo' : 'Registrar tiempo'}
          </h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Tarea</label>
            <select className="input" value={form.taskId} onChange={e => handleTaskChange(e.target.value)}>
              <option value="">— Sin tarea específica —</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

          {taskSubtasks.length > 0 && (
            <div className="form-group">
              <label className="form-label">Subtarea</label>
              <select className="input" value={form.subtaskId}
                onChange={e => setForm(p => ({ ...p, subtaskId: e.target.value }))}>
                <option value="">— Tarea completa —</option>
                {taskSubtasks.map(st => (
                  <option key={st.id} value={st.id}>{st.title}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Cliente</label>
              <select className="input" value={form.clientId}
                onChange={e => setForm(p => ({...p, clientId: e.target.value, projectId:''}))}>
                <option value="">— Sin cliente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Proyecto</label>
              <select className="input" value={form.projectId}
                onChange={e => setForm(p => ({...p, projectId: e.target.value}))}
                disabled={!form.clientId}>
                <option value="">— Sin proyecto —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(p => ({...p, date: e.target.value}))}/>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Hora Inicio</label>
              <input type="time" className="input" value={form.startTime}
                onChange={e => setForm(p => ({...p, startTime: e.target.value}))}/>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">Hora Fin</label>
              <input type="time" className="input" value={form.endTime}
                onChange={e => setForm(p => ({...p, endTime: e.target.value}))}/>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas / Descripción</label>
            <textarea className="input" rows={2} placeholder="¿Qué hiciste en este bloque?"
              value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}/>
          </div>
        </div>

        <div className="modal-footer">
          {isEdit && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{marginRight:'auto'}}>
              Eliminar
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isEdit ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntryModal;
