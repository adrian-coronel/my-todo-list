import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useActivity } from '../context/ActivityContext';
import { startOfWeek, addDays, format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Rnd } from 'react-rnd';

const HOURS_IN_DAY = 24;
const PIXELS_PER_HOUR = 60; // 1 min = 1 px
const MINUTE_SNAP = 5; 

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const getTextColor = (bgColor) => {
  const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  return (((r * 299) + (g * 587) + (b * 114)) / 1000 > 128) ? '#000' : '#fff';
};

const TimeToPixels = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h * PIXELS_PER_HOUR) + m * (PIXELS_PER_HOUR / 60);
};

const PixelsToTime = (px) => {
  let totalMinutes = Math.round(px / (PIXELS_PER_HOUR / 60));
  if (totalMinutes < 0) totalMinutes = 0;
  if (totalMinutes >= 24 * 60) totalMinutes = 24 * 60 - 1;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const ActivityBlock = ({ activity, startDate, colWidth }) => {
  const { updateActivity } = useActivity();
  const [isDragging, setIsDragging] = useState(false);
  
  // Calcular Y
  const yPos = TimeToPixels(activity.startTime);
  const heightPx = TimeToPixels(activity.endTime) - yPos;
  const safeHeight = heightPx < 15 ? 15 : heightPx;
  
  // Calcular X basado en el día
  const actDate = parseISO(activity.date);
  let dayDiff = differenceInDays(actDate, startDate);
  // Si está fuera de esta semana (0-6), no debería renderizarse o lo ocultamos temporalmente
  if (dayDiff < 0 || dayDiff > 6) return null;

  const xPos = dayDiff * colWidth;
  
  const bgColor = stringToColor(activity.project + activity.client);
  const textColor = getTextColor(bgColor);

  const handleDragStop = (e, d) => {
    setIsDragging(false);
    
    // Calcular nuevo día basado en X
    const newDayIndex = Math.round(d.x / colWidth);
    const boundedDayIndex = Math.max(0, Math.min(6, newDayIndex));
    const newDate = addDays(startDate, boundedDayIndex);
    
    const newStartTime = PixelsToTime(d.y);
    const newEndTime = PixelsToTime(d.y + safeHeight);
    
    updateActivity(activity.id, { 
      date: format(newDate, 'yyyy-MM-dd'),
      startTime: newStartTime, 
      endTime: newEndTime 
    });
  };

  const handleResizeStop = (e, direction, ref, delta, position) => {
    const newY = position.y;
    const newHeight = parseInt(ref.style.height, 10);
    const newStartTime = PixelsToTime(newY);
    const newEndTime = PixelsToTime(newY + newHeight);
    
    updateActivity(activity.id, { startTime: newStartTime, endTime: newEndTime });
  };

  return (
    <Rnd
      style={{
        zIndex: isDragging ? 20 : 10,
        opacity: isDragging ? 0.8 : 1,
        padding: '0 4px',
      }}
      bounds="parent"
      dragAxis="both"
      enableResizing={{ top: true, bottom: true, left: false, right: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
      size={{ width: colWidth, height: safeHeight }}
      position={{ x: xPos, y: yPos }}
      onDragStart={() => setIsDragging(true)}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      dragGrid={[colWidth, MINUTE_SNAP * (PIXELS_PER_HOUR / 60)]}
      resizeGrid={[1, MINUTE_SNAP * (PIXELS_PER_HOUR / 60)]}
      className="activity-block"
    >
      <div 
        title={`${activity.taskName}\n${activity.description}`}
        style={{ 
          width: '100%', height: '100%', 
          backgroundColor: bgColor, color: textColor,
          borderRadius: '6px', padding: '4px 6px', 
          fontSize: '0.75rem', overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', flexDirection: 'column',
          backdropFilter: 'blur(4px)'
        }}>
        <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>{activity.taskName}</strong>
        <span style={{ fontSize: '0.65rem', opacity: 0.9 }}>
          {activity.startTime} - {activity.endTime}
        </span>
      </div>
    </Rnd>
  );
};

const WeeklyVisualizer = () => {
  const { activities } = useActivity();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Lunes
  const endDate = addDays(startDate, 6);
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  const scrollRef = useRef(null);
  const gridRef = useRef(null);
  const [colWidth, setColWidth] = useState(100);

  // Auto-scroll a las 8 AM al cargar
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = 8 * PIXELS_PER_HOUR - 20;
    }
  }, []);

  // Calcular el ancho de las columnas on resize
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (gridRef.current) {
        setColWidth(gridRef.current.clientWidth / 7);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Filtrar actividades que caen en esta semana
  const weeklyActivities = activities.filter(act => {
    const d = parseISO(act.date);
    return d >= startDate && d <= endDate;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
        <button className="btn btn-outline" onClick={() => setCurrentDate(addDays(currentDate, -7))}>&larr; Semana Anterior</button>
        <span style={{ fontSize: '1.1rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {format(startDate, "d MMM", { locale: es })} - {format(endDate, "d MMM, yyyy", { locale: es })}
        </span>
        <button className="btn btn-outline" onClick={() => setCurrentDate(addDays(currentDate, 7))}>Siguiente Semana &rarr;</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflowY: 'auto', position: 'relative' }} ref={scrollRef}>
        
        {/* Columna de Horas */}
        <div style={{ width: '60px', flexShrink: 0, position: 'relative', borderRight: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-color)', zIndex: 30 }}>
            {/* Espaciador para la fila de cabecera de días */}
          <div style={{ height: '50px', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 40 }}></div>
          {Array.from({ length: HOURS_IN_DAY }).map((_, h) => (
            <div key={h} style={{ position: 'absolute', top: (h * PIXELS_PER_HOUR) + 50, width: '100%', textAlign: 'right', paddingRight: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Zona del Calendario */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: '700px' }}>
          
          {/* Cabecera de Días (Sticky) */}
          <div style={{ display: 'flex', height: '50px', position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 40, borderBottom: '1px solid var(--glass-border)' }}>
             {weekDays.map((date) => {
                const isToday = format(date, 'yyyy-MM-dd') === new Date().toISOString().split('T')[0];
                return (
                  <div key={date.toString()} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid var(--glass-border)', backgroundColor: isToday ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{format(date, 'EEEE', { locale: es }).toUpperCase()}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: isToday ? '700' : '500', color: isToday ? 'var(--accent-primary)' : 'inherit' }}>{format(date, 'd')}</div>
                  </div>
                );
             })}
          </div>

          {/* Grid de Horas y Actividades */}
          <div ref={gridRef} style={{ position: 'relative', height: `${HOURS_IN_DAY * PIXELS_PER_HOUR}px`, width: '100%' }}>
            {/* Rejilla de fondo */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1, display: 'flex' }}>
              {/* Líneas Horizontales */}
              <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
                {Array.from({ length: HOURS_IN_DAY }).map((_, h) => (
                  <div key={`hline-${h}`} style={{ position: 'absolute', top: h * PIXELS_PER_HOUR, width: '100%', height: '1px', backgroundColor: 'var(--glass-border)' }} />
                ))}
              </div>
              {/* Líneas Verticales */}
              {weekDays.map((_, i) => (
                 <div key={`vline-${i}`} style={{ flex: 1, borderRight: '1px solid var(--glass-border)' }} />
              ))}
            </div>

            {/* Bloques arrastrables */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}>
              {colWidth > 0 && weeklyActivities.map(act => (
                <ActivityBlock key={act.id} activity={act} startDate={startDate} colWidth={colWidth} />
              ))}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default WeeklyVisualizer;
