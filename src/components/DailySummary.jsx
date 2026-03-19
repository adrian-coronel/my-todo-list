import React, { useState } from 'react';
import { useActivity } from '../context/ActivityContext';
import { PieChart } from 'lucide-react';
import { format } from 'date-fns';

const DailySummary = () => {
  const { getDailySummary } = useActivity();
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const summary = getDailySummary(dateStr);
  
  const totalMinutes = summary.reduce((acc, curr) => acc + curr.totalMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = Math.round(totalMinutes % 60);

  return (
    <div className="glass-panel" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <PieChart size={20} color="var(--accent-warning)" />
          Resumen Diario
        </h3>
        <input 
          type="date" 
          className="form-control" 
          value={dateStr} 
          onChange={(e) => setDateStr(e.target.value)}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
        />
      </div>

      <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Trabajado</div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--accent-success)' }}>
          {totalHours}h {remainingMins}m
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
        {summary.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
            No hay registros para este día.
          </div>
        ) : (
          summary.map((item, idx) => {
            const h = Math.floor(item.totalMinutes / 60);
            const m = Math.round(item.totalMinutes % 60);
            return (
              <div key={idx} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{item.taskName}</strong>
                  <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{h}h {m}m</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {item.client} • {item.project}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {item.entries.map((entry, eIdx) => (
                    <span key={eIdx} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {entry.startTime} - {entry.endTime}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DailySummary;
