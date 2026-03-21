import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Copy, Check, Clock } from 'lucide-react';

const fmt = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const DailySummaryModal = ({ dateStr, onClose }) => {
  const { getDailySummary, getTask, getClient, getProject } = useApp();
  const [copied, setCopied] = useState(false);

  const summary = getDailySummary(dateStr);
  const totalMinutes = summary.reduce((acc, g) => acc + g.totalMinutes, 0);

  const dateLabel = format(new Date(dateStr + 'T12:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

  const copyToClipboard = () => {
    const lines = [];
    lines.push(`📅 Resumen del ${dateLabel}`);
    lines.push(`⏱ Total trabajado: ${fmt(totalMinutes)}`);
    lines.push('');

    summary.forEach((g) => {
      const task   = g.task;
      const client = g.client;
      const project = g.project;

      const context = [client?.name, project?.name].filter(Boolean).join(' › ');
      const contextStr = context ? ` (${context})` : '';
      lines.push(`• ${task?.title || 'Sin tarea'} — ${fmt(g.totalMinutes)}${contextStr}`);

      // Calcular tiempo por subtarea a partir de los entries que tienen subtaskId
      const subtaskMinutes = {};
      g.entries.forEach(e => {
        if (!e.subtaskId || !e.startTime || !e.endTime) return;
        const [sh, sm] = e.startTime.split(':').map(Number);
        const [eh, em] = e.endTime.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60;
        subtaskMinutes[e.subtaskId] = (subtaskMinutes[e.subtaskId] || 0) + diff;
      });

      const doneSubtasks = (task?.subtasks || []).filter(st => st.done);
      doneSubtasks.forEach(st => {
        const mins = subtaskMinutes[st.id];
        const timeStr = mins ? ` (${fmt(mins)})` : '';
        lines.push(`   • ${st.title}${timeStr}`);
      });

      if (task?.description) lines.push(`   ${task.description}`);
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal summary-modal" style={{ maxWidth:600 }}>
        
        <div className="modal-header">
          <div>
            <div className="text-micro" style={{ textTransform:'capitalize', marginBottom:2 }}>Resumen del día</div>
            <h2 className="summary-header-date" style={{ textTransform:'capitalize' }}>{dateLabel}</h2>
          </div>
          <div className="flex-row gap-2">
            <button className="btn btn-outline btn-sm" onClick={copyToClipboard}>
              {copied ? <Check size={13} color="var(--accent-green)"/> : <Copy size={13}/>}
              {copied ? 'Copiado' : 'Copiar resumen'}
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16}/></button>
          </div>
        </div>

        {/* Total */}
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{ background:'var(--surface-2)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
            <Clock size={32} color="var(--accent-green)" strokeWidth={1.5}/>
            <div>
              <div className="text-micro">Total trabajado</div>
              <div className="summary-total-hours">{fmt(totalMinutes)}</div>
            </div>
            <div style={{ marginLeft:'auto', textAlign:'right' }}>
              <div className="text-micro">Tareas</div>
              <div style={{ fontSize:'1.4rem', fontWeight:700 }}>{summary.length}</div>
            </div>
          </div>
        </div>

        {/* Lista de tareas */}
        <div className="modal-body" style={{ gap:0 }}>
          {summary.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'var(--text-tertiary)' }}>
              <p>No hay actividad registrada para este día.</p>
            </div>
          ) : (
            summary.map((g, idx) => {
              const task   = g.task;
              const client = g.client;
              const project= g.project;
              const taskColor = task?.color || client?.color || '#4A90D9';

              return (
                <div key={idx} className="summary-task-row">
                  <div className="flex-row gap-2" style={{ justifyContent:'space-between', marginBottom:6 }}>
                    <div className="flex-row gap-2">
                      <div style={{ width:4, height:20, borderRadius:2, background:taskColor, flexShrink:0 }}/>
                      <div>
                        <div className="summary-task-name">{task?.title || 'Tiempo libre'}</div>
                        {(client || project) && (
                          <div className="text-micro">{client?.name}{project && ` › ${project.name}`}</div>
                        )}
                      </div>
                    </div>
                    <span className="summary-task-hours">{fmt(g.totalMinutes)}</span>
                  </div>

                  {/* Subtareas completadas */}
                  {task?.subtasks?.length > 0 && (
                    <div style={{ marginLeft:12, marginBottom:8 }}>
                      {task.subtasks.filter(st => st.done).map(st => (
                        <div key={st.id} className="flex-row gap-1" style={{ fontSize:12, color:'var(--text-secondary)', padding:'1px 0' }}>
                          <Check size={11} color="var(--accent-green)"/>
                          <span>{st.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Entradas de tiempo */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginLeft:12 }}>
                    {g.entries.map((e, ei) => (
                      <div key={ei} className="summary-entry-chip">
                        <Clock size={10}/>
                        {e.startTime}–{e.endTime}
                        {e.notes && <span style={{ color:'var(--text-primary)' }}>· {e.notes}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Descripción / notas generales */}
                  {task?.description && (
                    <p style={{ marginLeft:12, marginTop:6, fontSize:12, color:'var(--text-tertiary)', lineHeight:1.6, fontStyle:'italic' }}>
                      {task.description}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DailySummaryModal;
