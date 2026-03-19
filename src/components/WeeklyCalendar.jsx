import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  startOfWeek, addDays, format,
  startOfMonth, endOfMonth, getDaysInMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, ZoomIn, ZoomOut } from 'lucide-react';
import DailySummaryModal from './DailySummaryModal';
import EntryModal from './EntryModal';
import ContextMenu from './ContextMenu';

/* ── Constantes clave ─────────────────────────────────────────────────────── */
const DEFAULT_PPH = 64;   // px por hora por defecto
const MIN_PPH     = 32;   // zoom mínimo
const MAX_PPH     = 384;  // zoom máximo
const MINUTE_SNAP  = 15;
const DAY_LABEL_H  = 56;
const ALL_DAY_H    = 32;
const HEADER_H     = DAY_LABEL_H + ALL_DAY_H; // 88px total

/* ── Utilitarios ──────────────────────────────────────────────────────────── */
const timeToY = (t, pxh) => {
  const [h, m] = t.split(':').map(Number);
  return h * pxh + m * (pxh / 60);
};
const minsToTime = (mins) => {
  const mm = Math.max(0, Math.min(1439, Math.round(mins / MINUTE_SNAP) * MINUTE_SNAP));
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};
const luminance = (hex) => {
  const c = (hex || '#3B82F6').replace('#', '');
  const r = parseInt(c.slice(0,2),16)/255, g = parseInt(c.slice(2,4),16)/255, b = parseInt(c.slice(4,6),16)/255;
  return 0.299*r + 0.587*g + 0.114*b;
};
const getTouchDist = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

/* ── Labels de hora dinámicos según zoom ──────────────────────────────────── */
const HourLines = ({ pxh }) => {
  const marks = [];
  for (let h = 0; h < 24; h++) {
    // Línea de hora principal + label
    const showLabel = pxh < 48 ? h % 2 === 0 : true;
    marks.push(
      <React.Fragment key={h}>
        <div className="hour-line" style={{ top: h * pxh }}/>
        {showLabel && (
          <div className="time-label" style={{ top: h * pxh }}>{String(h).padStart(2,'0')}:00</div>
        )}
        {/* :30 — visible con zoom ≥ 100 */}
        {pxh >= 100 && (
          <div className="hour-line half" style={{ top: h * pxh + pxh * 0.5 }}/>
        )}
        {/* :15 y :45 — visible con zoom ≥ 200 */}
        {pxh >= 200 && (
          <>
            <div className="hour-line half" style={{ top: h * pxh + pxh * 0.25, opacity: 0.4 }}/>
            <div className="hour-line half" style={{ top: h * pxh + pxh * 0.75, opacity: 0.4 }}/>
          </>
        )}
        {/* Labels de minutos en zoom alto */}
        {pxh >= 160 && (
          <div className="time-label" style={{ top: h * pxh + pxh * 0.5, opacity: 0.55, fontSize: 10 }}>
            {String(h).padStart(2,'0')}:30
          </div>
        )}
        {pxh >= 280 && (
          <>
            <div className="time-label" style={{ top: h * pxh + pxh * 0.25, opacity: 0.4, fontSize: 9 }}>
              {String(h).padStart(2,'0')}:15
            </div>
            <div className="time-label" style={{ top: h * pxh + pxh * 0.75, opacity: 0.4, fontSize: 9 }}>
              {String(h).padStart(2,'0')}:45
            </div>
          </>
        )}
      </React.Fragment>
    );
  }
  return <>{marks}</>;
};

/* ════════════════════════════════════════════════════════════════════════════
   EventBlock
════════════════════════════════════════════════════════════════════════════ */
const EventBlock = ({ entry, colWidth, weekDays, pxPerHour, onContextMenu, onOpenEdit }) => {
  const { updateEntry, getEntryColor, getTask } = useApp();
  const outerRef = useRef(null);

  const task      = getTask(entry.taskId);
  const color     = getEntryColor(entry);
  const textColor = luminance(color) > 0.45 ? '#111' : '#fff';
  const isSubtask = !!entry.subtaskId;

  const dayDiff = weekDays.findIndex(d => format(d, 'yyyy-MM-dd') === entry.date);
  if (dayDiff === -1) return null;
  if (entry.isAllDay) return null; // las tareas del día se renderizan en la fila all-day

  const y0     = timeToY(entry.startTime, pxPerHour);
  const y1     = timeToY(entry.endTime,   pxPerHour);
  const blockH = Math.max(y1 - y0, pxPerHour / 4);

  const baseLeft = dayDiff * colWidth + 2;
  const baseTop  = HEADER_H + y0;

  // ── DRAG ─────────────────────────────────────────────────────────────────
  const onMouseDownDrag = (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const ox = e.clientX, oy = e.clientY;
    const snapH = MINUTE_SNAP * (pxPerHour / 60);

    const onMove = (mv) => {
      const el = outerRef.current; if (!el) return;
      const dx = mv.clientX - ox, dy = mv.clientY - oy;
      el.style.transform = `translate(${Math.round(dx / colWidth) * colWidth}px, ${Math.round(dy / snapH) * snapH}px)`;
      el.style.opacity = '0.75';
      el.style.zIndex  = '50';
    };
    const onUp = (mu) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      const el = outerRef.current; if (!el) return;
      el.style.transform = '';
      el.style.opacity   = '';
      el.style.zIndex    = '';

      const dx = mu.clientX - ox, dy = mu.clientY - oy;
      const colDelta  = Math.round(dx / colWidth);
      const snapDy    = Math.round(dy / snapH) * MINUTE_SNAP;

      const [sh, sm] = entry.startTime.split(':').map(Number);
      const [eh, em] = entry.endTime.split(':').map(Number);
      const durMin   = (eh * 60 + em) - (sh * 60 + sm);

      const newStartMins = (sh * 60 + sm) + snapDy;
      const newDay = Math.max(0, Math.min(weekDays.length - 1, dayDiff + colDelta));
      updateEntry(entry.id, {
        date:      format(weekDays[newDay], 'yyyy-MM-dd'),
        startTime: minsToTime(newStartMins),
        endTime:   minsToTime(newStartMins + durMin),
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  // ── RESIZE bottom ────────────────────────────────────────────────────────
  const onMouseDownResizeBottom = (e) => {
    e.preventDefault(); e.stopPropagation();
    const oy    = e.clientY;
    const snapH = MINUTE_SNAP * (pxPerHour / 60);
    const [sh, sm] = entry.startTime.split(':').map(Number);
    const [eh, em] = entry.endTime.split(':').map(Number);

    const onMove = (mv) => {
      const el = outerRef.current; if (!el) return;
      const dy = mv.clientY - oy;
      el.style.height = `${Math.max(pxPerHour / 4, blockH + Math.round(dy / snapH) * snapH)}px`;
    };
    const onUp = (mu) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      const el = outerRef.current; if (el) el.style.height = '';
      const dy   = mu.clientY - oy;
      const snap = Math.round(dy / (MINUTE_SNAP * (pxPerHour / 60))) * MINUTE_SNAP;
      const newEnd = (eh * 60 + em) + snap;
      updateEntry(entry.id, { endTime: minsToTime(Math.max((sh*60+sm)+MINUTE_SNAP, newEnd)) });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  // ── RESIZE top ──────────────────────────────────────────────────────────
  const onMouseDownResizeTop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const oy    = e.clientY;
    const snapH = MINUTE_SNAP * (pxPerHour / 60);
    const [sh, sm] = entry.startTime.split(':').map(Number);
    const [eh, em] = entry.endTime.split(':').map(Number);

    const onMove = (mv) => {
      const el = outerRef.current; if (!el) return;
      const dy = mv.clientY - oy;
      const snapped = Math.round(dy / snapH) * snapH;
      el.style.top    = `${baseTop + snapped}px`;
      el.style.height = `${Math.max(pxPerHour / 4, blockH - snapped)}px`;
    };
    const onUp = (mu) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      const el = outerRef.current; if (el) { el.style.top=''; el.style.height=''; }
      const dy   = mu.clientY - oy;
      const snap = Math.round(dy / (MINUTE_SNAP * (pxPerHour / 60))) * MINUTE_SNAP;
      const newStart = (sh * 60 + sm) + snap;
      updateEntry(entry.id, { startTime: minsToTime(Math.min((eh*60+em)-MINUTE_SNAP, newStart)) });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  const subtaskTitle = isSubtask
    ? (entry.subtaskTitle || task?.subtasks?.find(s => s.id === entry.subtaskId)?.title || 'Subtarea')
    : null;

  const isDone = isSubtask
    ? task?.subtasks?.find(s => s.id === entry.subtaskId)?.done
    : task?.status === 'done';

  return (
    <div
      ref={outerRef}
      style={{
        position: 'absolute',
        left:    baseLeft,
        top:     baseTop,
        width:   colWidth - 4,
        height:  blockH,
        zIndex:  10,
        boxSizing: 'border-box',
      }}
    >
      <div className="resize-handle-top" onMouseDown={onMouseDownResizeTop}/>
      <div
        className={`event-block-inner${isSubtask ? ' is-subtask' : ''}${isDone ? ' is-done' : ''}`}
        style={{ background: color, color: textColor, borderColor: `${color}55` }}
        onMouseDown={onMouseDownDrag}
        onDoubleClick={e => { e.stopPropagation(); onOpenEdit && onOpenEdit(entry); }}
        onContextMenu={e => { e.preventDefault(); onContextMenu(e, entry); }}
      >
        {isSubtask && task && (
          <div className="event-parent-label">↳ {task.title}</div>
        )}
        <div className="event-title">{isSubtask ? subtaskTitle : (task?.title || 'Actividad')}</div>
        {blockH > pxPerHour / 2 && (
          <div className="event-time">{entry.startTime}–{entry.endTime}</div>
        )}
        {blockH > pxPerHour && entry.notes && (
          <div style={{ fontSize:10, opacity:0.8, marginTop:2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
            {entry.notes}
          </div>
        )}
      </div>
      <div className="resize-handle-bottom" onMouseDown={onMouseDownResizeBottom}/>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   Vista Mensual
════════════════════════════════════════════════════════════════════════════ */
const MonthView = ({ currentDate, entries, tasks, onDayClick }) => {
  const totalDays= getDaysInMonth(currentDate);
  const start    = startOfMonth(currentDate);
  const firstDow = (start.getDay() + 6) % 7;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayNames = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++)
    cells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));

  return (
    <div style={{ flex:1, overflow:'auto', padding:'0 8px 8px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, marginBottom:4 }}>
        {dayNames.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, color:'var(--text-tertiary)', padding:'8px 0', fontWeight:500 }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`}/>;
          const ds = format(date, 'yyyy-MM-dd');
          const dayEntries = entries.filter(e => e.date === ds);
          const isToday = ds === todayStr;
          return (
            <div key={ds} onClick={() => onDayClick(ds)}
              style={{ minHeight:80, borderRadius:'var(--radius-sm)', background:'var(--surface-1)', border:`1px solid ${isToday?'var(--accent-blue)':'var(--border-subtle)'}`, padding:6, cursor:'pointer', transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--surface-1)'}
            >
              <div style={{ fontWeight:isToday?700:400, fontSize:13, color:isToday?'var(--accent-blue)':'var(--text-primary)', marginBottom:4 }}>
                {format(date,'d')}
              </div>
              {dayEntries.slice(0,3).map(e => {
                const t = tasks.find(x => x.id === e.taskId);
                const col = e.color || '#4A90D9';
                return (
                  <div key={e.id} style={{ fontSize:10, padding:'1px 4px', borderRadius:2, background:col, color:'#fff', marginBottom:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {t?.title || 'Sin tarea'}
                  </div>
                );
              })}
              {dayEntries.length > 3 && <div style={{ fontSize:10, color:'var(--text-tertiary)' }}>+{dayEntries.length-3} más</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   Vista Diaria
════════════════════════════════════════════════════════════════════════════ */
const DayView = ({ currentDate, entries, tasks, pxPerHour, onContextMenu, onOpenEdit, onOpenAllDay }) => {
  const scrollRef = useRef(null);
  const [nowY, setNowY] = useState(0);
  const { getEntryColor } = useApp();
  const dateStr      = format(currentDate, 'yyyy-MM-dd');
  const todayStr     = format(new Date(), 'yyyy-MM-dd');
  const allEntries   = entries.filter(e => e.date === dateStr);
  const dayEntries   = allEntries.filter(e => !e.isAllDay);
  const allDayEntries = allEntries.filter(e => e.isAllDay);
  const singleWeek = [currentDate];

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 8 * pxPerHour - 40; }, [dateStr]);
  useEffect(() => {
    const upd = () => { const n=new Date(); setNowY(n.getHours()*pxPerHour+n.getMinutes()*(pxPerHour/60)); };
    upd(); const t=setInterval(upd,60000); return ()=>clearInterval(t);
  }, [pxPerHour]);

  return (
    <div className="calendar-scroll" ref={scrollRef}>
      <div className="time-column">
        <div style={{ position:'sticky', top:0, background:'var(--bg-primary)', zIndex:25 }}>
          <div style={{ height:DAY_LABEL_H, borderBottom:'1px solid var(--border-subtle)' }}/>
          <div style={{ height:ALL_DAY_H, display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 6px', borderBottom:'1px solid var(--border-subtle)' }}>
            <span style={{ fontSize:9, color:'var(--text-tertiary)', fontWeight:600, letterSpacing:'0.05em' }}>DÍA</span>
          </div>
        </div>
        <div style={{ position:'relative', height:24*pxPerHour }}>
          <HourLines pxh={pxPerHour}/>
        </div>
      </div>
      <div style={{ flex:1, position:'relative' }}>
        {/* Etiqueta del día */}
        <div className={`day-header${dateStr===todayStr?' today':''}`}
          style={{ height:DAY_LABEL_H, display:'flex', alignItems:'center', gap:10, padding:'0 16px', justifyContent:'flex-start', textAlign:'left', borderBottom:'1px solid var(--border-subtle)' }}>
          <span className="day-label">{format(currentDate,'EEEE',{locale:es}).toUpperCase()}</span>
          <span style={{ fontSize:22, fontWeight:700 }}>{format(currentDate,'d')}</span>
          <span className="day-label">{format(currentDate,'MMMM yyyy',{locale:es})}</span>
        </div>
        {/* Fila all-day */}
        <div style={{ height:ALL_DAY_H, display:'flex', alignItems:'center', gap:4, padding:'0 8px',
          borderBottom:'1px solid var(--border-subtle)', cursor:'pointer', overflow:'hidden', flexWrap:'nowrap' }}
          onClick={() => onOpenAllDay && onOpenAllDay(dateStr)}>
          {allDayEntries.map(e => {
            const t = tasks.find(x => x.id === e.taskId);
            const col = getEntryColor(e);
            return (
              <div key={e.id}
                onClick={ev => { ev.stopPropagation(); onOpenEdit && onOpenEdit(e); }}
                title={t?.title || 'Tarea del día'}
                style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:col,
                  color: luminance(col) > 0.45 ? '#111' : '#fff',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  cursor:'pointer', fontWeight:500, flexShrink:0 }}>
                {t?.title || 'Tarea del día'}
              </div>
            );
          })}
          {allDayEntries.length === 0 && (
            <span style={{ fontSize:11, color:'var(--text-tertiary)', opacity:0.4 }}>+ Tarea del día</span>
          )}
        </div>
        <div style={{ position:'absolute', top:HEADER_H, left:0, right:0, height:24*pxPerHour, pointerEvents:'none' }}>
          {Array.from({length:24}).map((_,h)=>(
            <React.Fragment key={h}>
              <div className="hour-line" style={{ top:h*pxPerHour }}/>
              {pxPerHour >= 100 && <div className="hour-line half" style={{ top:h*pxPerHour+pxPerHour/2 }}/>}
            </React.Fragment>
          ))}
        </div>
        {dateStr===todayStr && (
          <div className="current-time-line" style={{ top:HEADER_H+nowY }}>
            <div className="current-time-dot"/><div className="current-time-bar"/>
          </div>
        )}
        {dayEntries.map(e=>(
          <EventBlock key={e.id} entry={e} colWidth={Math.max(200,800)} weekDays={singleWeek}
            pxPerHour={pxPerHour} onContextMenu={onContextMenu} onOpenEdit={onOpenEdit}/>
        ))}
        <div style={{ position:'absolute', top:HEADER_H, left:0, right:0, height:24*pxPerHour, zIndex:1 }}/>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   Calendario Principal
════════════════════════════════════════════════════════════════════════════ */
const WeeklyCalendar = () => {
  const { entries, addEntry, tasks, getEntryColor } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView]               = useState('week');
  const [summaryDate, setSummaryDate] = useState(null);
  const [entryModal,  setEntryModal]  = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [pxPerHour,   setPxPerHour]   = useState(DEFAULT_PPH);

  const scrollRef    = useRef(null);
  const gridRef      = useRef(null);
  const calendarRef  = useRef(null);
  const lastTouchDist = useRef(null);
  const [colWidth, setColWidth] = useState(120);

  const startDate = startOfWeek(currentDate, { weekStartsOn:1 });
  const endDate   = addDays(startDate, 6);
  const weekDays  = Array.from({length:7}).map((_,i) => addDays(startDate,i));
  const todayStr  = format(new Date(), 'yyyy-MM-dd');

  // Scroll inicial
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 8 * pxPerHour; }, []);

  // Medir ancho de columnas
  useLayoutEffect(() => {
    const measure = () => { if (gridRef.current) setColWidth(gridRef.current.clientWidth / 7); };
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [view]);

  // Línea de tiempo actual
  const [nowY, setNowY] = useState(0);
  useEffect(() => {
    const upd = () => { const n=new Date(); setNowY(n.getHours()*pxPerHour+n.getMinutes()*(pxPerHour/60)); };
    upd(); const t=setInterval(upd,60000); return ()=>clearInterval(t);
  }, [pxPerHour]);

  // ESC cierra modales
  useEffect(() => {
    const fn = (e) => {
      if (e.key !== 'Escape') return;
      if (contextMenu) { setContextMenu(null); return; }
      if (entryModal)  { setEntryModal(null);  return; }
      if (summaryDate) { setSummaryDate(null); return; }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [contextMenu, entryModal, summaryDate]);

  const navigate = useCallback((dir) => {
    if (view === 'week')  setCurrentDate(d => addDays(d, dir*7));
    if (view === 'day')   setCurrentDate(d => addDays(d, dir));
    if (view === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+dir, 1));
  }, [view]);

  // ── Wheel: zoom (ctrl) + navegación horizontal (trackpad) ─────────────────
  const navigateRef  = useRef(navigate);
  const accDeltaX    = useRef(0);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  useEffect(() => {
    const el = calendarRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.ctrlKey) {
        // Zoom: ctrl+scroll en teclado = pinch en trackpad macOS/Windows
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        setPxPerHour(prev => Math.min(MAX_PPH, Math.max(MIN_PPH, Math.round(prev * factor))));
        return;
      }
      // Navegación horizontal con trackpad — acumular delta para evitar
      // el bug de "dirección pegada" al cambiar sentido
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      // Si el usuario cambió de dirección, resetear acumulador
      if (e.deltaX !== 0 && accDeltaX.current !== 0 &&
          Math.sign(e.deltaX) !== Math.sign(accDeltaX.current)) {
        accDeltaX.current = 0;
      }
      accDeltaX.current += e.deltaX;
      if (Math.abs(accDeltaX.current) >= 80) {
        navigateRef.current(accDeltaX.current > 0 ? 1 : -1);
        accDeltaX.current = 0;
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ── Touch pinch (móvil) ───────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      lastTouchDist.current = getTouchDist(e.touches);
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length !== 2 || !lastTouchDist.current) return;
    e.preventDefault();
    const dist  = getTouchDist(e.touches);
    const ratio = dist / lastTouchDist.current;
    setPxPerHour(prev => Math.min(MAX_PPH, Math.max(MIN_PPH, Math.round(prev * ratio))));
    lastTouchDist.current = dist;
  };
  const handleTouchEnd = () => { lastTouchDist.current = null; };

  // Drop desde sidebar
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect='copy'; };
  const handleDrop = (e, dateStr, dayEl) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const payload = JSON.parse(raw);

    const rect      = dayEl.getBoundingClientRect();
    const relY      = e.clientY - rect.top - HEADER_H;
    const startTime = minsToTime(Math.max(0, Math.round(relY / (pxPerHour/60) / MINUTE_SNAP) * MINUTE_SNAP));
    const [h, m]    = startTime.split(':').map(Number);
    const endTime   = minsToTime(h*60+m+60);

    if (payload.type === 'task') {
      const task = tasks.find(t => t.id === payload.taskId);
      if (!task) return;
      addEntry({ taskId:task.id, clientId:task.clientId, projectId:task.projectId, date:dateStr, startTime, endTime, notes:'' });
    } else if (payload.type === 'subtask') {
      const task = tasks.find(t => t.id === payload.taskId);
      if (!task) return;
      const st = task.subtasks?.find(s => s.id === payload.subtaskId);
      if (!st) return;
      addEntry({ taskId:task.id, subtaskId:st.id, subtaskTitle:st.title, clientId:task.clientId, projectId:task.projectId, date:dateStr, startTime, endTime, notes:'', isSubtask:true });
    }
  };

  // Drop desde sidebar en zona all-day
  const handleDropAllDay = (e, dateStr) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload.type === 'task') {
      const task = tasks.find(t => t.id === payload.taskId);
      if (!task) return;
      addEntry({ taskId:task.id, clientId:task.clientId, projectId:task.projectId, date:dateStr, isAllDay:true, notes:'' });
    } else if (payload.type === 'subtask') {
      const task = tasks.find(t => t.id === payload.taskId);
      if (!task) return;
      const st = task.subtasks?.find(s => s.id === payload.subtaskId);
      if (!st) return;
      addEntry({ taskId:task.id, subtaskId:st.id, subtaskTitle:st.title, clientId:task.clientId, projectId:task.projectId, date:dateStr, isAllDay:true, notes:'', isSubtask:true });
    }
  };

  // Click en celda → nueva entrada
  const handleCellClick = (e, dateStr, dayEl) => {
    if (e.target.closest('.event-block-inner') || e.target.closest('.resize-handle-top') || e.target.closest('.resize-handle-bottom')) return;
    const relY = e.clientY - dayEl.getBoundingClientRect().top - HEADER_H;
    if (relY < 0) return;
    const startTime = minsToTime(Math.max(0, Math.round(relY / (pxPerHour/60) / MINUTE_SNAP) * MINUTE_SNAP));
    const [h, m]    = startTime.split(':').map(Number);
    setEntryModal({ date:dateStr, startTime, endTime: minsToTime(h*60+m+60) });
  };

  const handleContextMenu = (e, entry) => { e.preventDefault(); setContextMenu({ x:e.clientX, y:e.clientY, entry }); };

  const navLabel = view === 'week'
    ? `${format(startDate,'d MMM',{locale:es})} – ${format(endDate,'d MMM, yyyy',{locale:es})}`
    : view === 'day'
      ? format(currentDate,'EEEE, d MMMM yyyy',{locale:es})
      : format(currentDate,'MMMM yyyy',{locale:es});

  const weekEntries = view === 'week'
    ? entries.filter(e => e.date >= format(startDate,'yyyy-MM-dd') && e.date <= format(endDate,'yyyy-MM-dd'))
    : [];
  const weekTimedEntries  = weekEntries.filter(e => !e.isAllDay);
  const weekAllDayEntries = weekEntries.filter(e => e.isAllDay);

  return (
    <div
      className="calendar-container"
      ref={calendarRef}
      style={{ touchAction: 'pan-x pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Barra de navegación ──────────────────────────────────────────── */}
      <div className="calendar-nav">
        <div className="flex-row gap-2">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={18}/></button>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(1)}><ChevronRight size={18}/></button>
          <span style={{ fontWeight:600, fontSize:15, textTransform:'capitalize', whiteSpace:'nowrap' }}>{navLabel}</span>
        </div>
        <div className="flex-row gap-2">
          <div className="view-switcher">
            {[['day','Día'],['week','Semana'],['month','Mes']].map(([v,l]) => (
              <button key={v} className={`view-switcher-btn${view===v?' active':''}`} onClick={()=>setView(v)}>{l}</button>
            ))}
          </div>
          {view !== 'month' && (
            <div className="flex-row gap-1">
              <button className="btn btn-ghost btn-icon btn-sm" title="Alejar (Ctrl+scroll abajo)"
                onClick={() => setPxPerHour(p => Math.max(MIN_PPH, Math.round(p * 0.75)))}>
                <ZoomOut size={14}/>
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" title="Acercar (Ctrl+scroll arriba)"
                onClick={() => setPxPerHour(p => Math.min(MAX_PPH, Math.round(p * 1.33)))}>
                <ZoomIn size={14}/>
              </button>
            </div>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setCurrentDate(new Date())}>
            <Calendar size={13}/> Hoy
          </button>
        </div>
      </div>

      {/* ══ VISTA SEMANAL ══════════════════════════════════════════════════ */}
      {view === 'week' && (
        <div className="calendar-scroll" ref={scrollRef}>

          {/* Columna de horas */}
          <div className="time-column">
            <div style={{ position:'sticky', top:0, background:'var(--bg-primary)', zIndex:25 }}>
              <div style={{ height:DAY_LABEL_H, borderBottom:'1px solid var(--border-subtle)' }}/>
              <div style={{ height:ALL_DAY_H, display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 6px', borderBottom:'1px solid var(--border-subtle)' }}>
                <span style={{ fontSize:9, color:'var(--text-tertiary)', fontWeight:600, letterSpacing:'0.05em' }}>DÍA</span>
              </div>
            </div>
            <div style={{ position:'relative', height:24*pxPerHour }}>
              <HourLines pxh={pxPerHour}/>
            </div>
          </div>

          {/* Grid de días */}
          <div className="calendar-grid" ref={gridRef}>

            {/* Cabeceras */}
            <div style={{ position:'sticky', top:0, zIndex:20, background:'var(--bg-primary)', borderBottom:'1px solid var(--border-subtle)' }}>
              {/* Fila 1: etiquetas de día */}
              <div style={{ display:'flex', height:DAY_LABEL_H, borderBottom:'1px solid var(--border-subtle)' }}>
                {weekDays.map((date, i) => {
                  const ds      = format(date,'yyyy-MM-dd');
                  const isToday = ds === todayStr;
                  const cnt     = weekTimedEntries.filter(e => e.date === ds).length;
                  return (
                    <div key={ds} className={`day-header${isToday?' today':''}`}
                      onClick={() => setSummaryDate(ds)}
                      style={{ width: colWidth, flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}>
                      <div className="day-label">{format(date,'EEE',{locale:es}).toUpperCase()}</div>
                      <div className={`day-num${isToday?' today-dot':''}`}>{format(date,'d')}</div>
                      {cnt > 0 && (
                        <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent-blue)', margin:'3px auto 0' }}/>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Fila 2: tareas del día */}
              <div style={{ display:'flex', height:ALL_DAY_H }}>
                {weekDays.map((date) => {
                  const ds = format(date,'yyyy-MM-dd');
                  const allDayForDay = weekAllDayEntries.filter(e => e.date === ds);
                  return (
                    <div key={ds}
                      style={{ width:colWidth, flexShrink:0, borderRight:'1px solid var(--border-subtle)',
                        display:'flex', alignItems:'center', gap:3, padding:'0 4px', overflow:'hidden',
                        cursor:'pointer', boxSizing:'border-box' }}
                      onClick={() => setEntryModal({ date:ds, isAllDay:true })}
                      onDragOver={handleDragOver}
                      onDrop={e => handleDropAllDay(e, ds)}>
                      {allDayForDay.map(e => {
                        const t = tasks.find(x => x.id === e.taskId);
                        const col = getEntryColor(e);
                        return (
                          <div key={e.id}
                            onClick={ev => { ev.stopPropagation(); setEntryModal({ entry:e }); }}
                            title={t?.title || 'Tarea del día'}
                            style={{ fontSize:10, padding:'1px 5px', borderRadius:3, background:col,
                              color: luminance(col) > 0.45 ? '#111' : '#fff',
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                              maxWidth: colWidth - 16, cursor:'pointer', fontWeight:500, flexShrink:0 }}>
                            {t?.title || 'Tarea del día'}
                          </div>
                        );
                      })}
                      {allDayForDay.length === 0 && (
                        <span style={{ fontSize:11, color:'var(--text-tertiary)', opacity:0.35, pointerEvents:'none' }}>+</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Columnas clickeables / drop zone */}
            {weekDays.map((date,i) => {
              const ds = format(date,'yyyy-MM-dd');
              return (
                <div key={ds}
                  style={{ position:'absolute', left:i*colWidth, top:0, width:colWidth, height:HEADER_H+24*pxPerHour, cursor:'crosshair', borderRight:'1px solid var(--border-subtle)', zIndex:2 }}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, ds, e.currentTarget)}
                  onClick={e => handleCellClick(e, ds, e.currentTarget)}
                />
              );
            })}

            {/* Líneas horizontales */}
            <div style={{ position:'absolute', top:HEADER_H, left:0, right:0, height:24*pxPerHour, pointerEvents:'none', zIndex:1 }}>
              {Array.from({length:24}).map((_,h) => (
                <React.Fragment key={h}>
                  <div className="hour-line" style={{ top:h*pxPerHour }}/>
                  {pxPerHour >= 100 && <div className="hour-line half" style={{ top:h*pxPerHour+pxPerHour/2 }}/>}
                  {pxPerHour >= 200 && (
                    <>
                      <div className="hour-line half" style={{ top:h*pxPerHour+pxPerHour*0.25, opacity:0.4 }}/>
                      <div className="hour-line half" style={{ top:h*pxPerHour+pxPerHour*0.75, opacity:0.4 }}/>
                    </>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Línea de tiempo actual */}
            {weekDays.some(d => format(d,'yyyy-MM-dd')===todayStr) && (
              <div className="current-time-line" style={{ position:'absolute', top:HEADER_H+nowY, left:0, right:0, zIndex:3, display:'flex', alignItems:'center', pointerEvents:'none' }}>
                <div className="current-time-dot"/><div className="current-time-bar"/>
              </div>
            )}

            {/* Capa de eventos (solo con hora — las tareas del día van arriba) */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:HEADER_H+24*pxPerHour, zIndex:10, pointerEvents:'none' }}>
              {weekTimedEntries.map(e => (
                <div key={e.id} style={{ pointerEvents:'all' }}>
                  <EventBlock
                    entry={e}
                    colWidth={colWidth}
                    weekDays={weekDays}
                    pxPerHour={pxPerHour}
                    onContextMenu={handleContextMenu}
                    onOpenEdit={(entry) => setEntryModal({ entry })}
                  />
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ══ VISTA DIARIA ═══════════════════════════════════════════════════ */}
      {view === 'day' && (
        <DayView currentDate={currentDate} entries={entries} tasks={tasks}
          pxPerHour={pxPerHour}
          onContextMenu={handleContextMenu}
          onOpenEdit={(entry) => setEntryModal({ entry })}
          onOpenAllDay={(ds) => setEntryModal({ date:ds, isAllDay:true })}/>
      )}

      {/* ══ VISTA MENSUAL ══════════════════════════════════════════════════ */}
      {view === 'month' && (
        <MonthView currentDate={currentDate} entries={entries} tasks={tasks}
          onDayClick={ds => setSummaryDate(ds)}/>
      )}

      {/* Modales */}
      {summaryDate && <DailySummaryModal dateStr={summaryDate} onClose={() => setSummaryDate(null)}/>}
      {entryModal  && <EntryModal data={entryModal} onClose={() => setEntryModal(null)}/>}
      {contextMenu && (
        <ContextMenu {...contextMenu}
          onEdit={() => { setEntryModal({ entry:contextMenu.entry }); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}/>
      )}
    </div>
  );
};

export default WeeklyCalendar;
