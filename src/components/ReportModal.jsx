import { useState, useMemo, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { X, FileDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { jsPDF } from 'jspdf'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const entryMinutes = (e) => {
  if (!e.startTime || !e.endTime) return 0
  const [sh, sm] = e.startTime.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < 0) diff += 24 * 60
  return diff
}

const fmtHours = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const fmtMoney = (n) => n != null ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

/* ── Componente ───────────────────────────────────────────────────────────── */

export default function ReportModal({ onClose }) {
  const { clients, projects, entries } = useApp()

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '')
  const [rangeType, setRangeType] = useState('week') // 'week' | 'month'
  const [offset, setOffset] = useState(0) // 0 = actual, -1 = anterior, etc.

  // ── Rango de fechas ─────────────────────────────────────────────────────
  const { from, to, label } = useMemo(() => {
    const base = new Date()
    if (rangeType === 'week') {
      const ref = subWeeks(base, -offset)
      const s = startOfWeek(ref, { weekStartsOn: 1 })
      const e = endOfWeek(ref, { weekStartsOn: 1 })
      return {
        from: format(s, 'yyyy-MM-dd'),
        to: format(e, 'yyyy-MM-dd'),
        label: `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`,
      }
    }
    const ref = subMonths(base, -offset)
    const s = startOfMonth(ref)
    const e = endOfMonth(ref)
    return {
      from: format(s, 'yyyy-MM-dd'),
      to: format(e, 'yyyy-MM-dd'),
      label: format(s, 'MMMM yyyy', { locale: es }),
    }
  }, [rangeType, offset])

  // ── Datos del reporte ───────────────────────────────────────────────────
  const report = useMemo(() => {
    const client = clients.find(c => c.id === selectedClientId)
    if (!client) return null

    const clientEntries = entries.filter(e =>
      e.clientId === selectedClientId && e.date >= from && e.date <= to
    )

    const byProject = {}
    clientEntries.forEach(e => {
      const pid = e.projectId || '_sin_proyecto'
      if (!byProject[pid]) {
        const proj = projects.find(p => p.id === pid)
        byProject[pid] = { name: proj?.name || 'Sin proyecto', minutes: 0, entries: 0 }
      }
      byProject[pid].minutes += entryMinutes(e)
      byProject[pid].entries += 1
    })

    const projectRows = Object.values(byProject).sort((a, b) => b.minutes - a.minutes)
    const totalMinutes = projectRows.reduce((s, p) => s + p.minutes, 0)
    const totalHours = totalMinutes / 60
    const rate = client.hourlyRate
    const totalBilling = rate != null ? totalHours * rate : null

    return { client, projectRows, totalMinutes, totalHours, rate, totalBilling }
  }, [selectedClientId, from, to, clients, projects, entries])

  // ── Generar PDF ─────────────────────────────────────────────────────────
  const exportPdf = () => {
    if (!report) return
    const { client, projectRows, totalMinutes, rate, totalBilling } = report
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    let y = 20

    // Header
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Reporte de Tiempo', 20, y)
    y += 10

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Cliente: ${client.name}`, 20, y)
    y += 6
    doc.text(`Período: ${label}`, 20, y)
    if (rate != null) { y += 6; doc.text(`Tarifa: ${fmtMoney(rate)}/h`, 20, y) }
    y += 12

    // Línea separadora
    doc.setDrawColor(200)
    doc.line(20, y, W - 20, y)
    y += 8

    // Tabla header
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60)
    doc.setFontSize(10)
    doc.text('Proyecto', 20, y)
    doc.text('Registros', 110, y, { align: 'center' })
    doc.text('Horas', 140, y, { align: 'right' })
    if (rate != null) doc.text('Subtotal', W - 20, y, { align: 'right' })
    y += 3
    doc.setDrawColor(220)
    doc.line(20, y, W - 20, y)
    y += 6

    // Filas
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40)
    projectRows.forEach(row => {
      doc.text(row.name, 20, y)
      doc.text(String(row.entries), 110, y, { align: 'center' })
      doc.text(fmtHours(row.minutes), 140, y, { align: 'right' })
      if (rate != null) doc.text(fmtMoney((row.minutes / 60) * rate), W - 20, y, { align: 'right' })
      y += 7
    })

    // Total
    y += 3
    doc.setDrawColor(200)
    doc.line(20, y, W - 20, y)
    y += 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total', 20, y)
    doc.text(fmtHours(totalMinutes), 140, y, { align: 'right' })
    if (totalBilling != null) doc.text(fmtMoney(totalBilling), W - 20, y, { align: 'right' })

    // Footer
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(160)
    doc.text(`Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}  •  Kron`, 20, y)

    // Descargar
    const fileName = `reporte-${client.name.toLowerCase().replace(/\s+/g, '-')}-${from}.pdf`
    doc.save(fileName)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Reporte de Tiempo</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ gap: 14 }}>
          {/* Selector de cliente */}
          <div>
            <label className="form-label">Cliente</label>
            <select className="input" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Selector de rango */}
          <div>
            <label className="form-label">Período</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="view-switcher" style={{ flex: 'none' }}>
                <button className={`view-switcher-btn${rangeType === 'week' ? ' active' : ''}`} onClick={() => { setRangeType('week'); setOffset(0); }}>Semanal</button>
                <button className={`view-switcher-btn${rangeType === 'month' ? ' active' : ''}`} onClick={() => { setRangeType('month'); setOffset(0); }}>Mensual</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOffset(o => o - 1)}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{label}</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>

          {/* Preview del reporte */}
          {report && (
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--border-subtle)' }}>
              {/* Header del preview */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{report.client.name}</div>
                  {report.rate != null && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Tarifa: {fmtMoney(report.rate)}/h</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{fmtHours(report.totalMinutes)}</div>
                  {report.totalBilling != null && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)' }}>{fmtMoney(report.totalBilling)}</div>
                  )}
                </div>
              </div>

              {/* Tabla */}
              {report.projectRows.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Header de la tabla */}
                  <div style={{ display: 'flex', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    <span style={{ flex: 1 }}>Proyecto</span>
                    <span style={{ width: 50, textAlign: 'right' }}>Horas</span>
                    {report.rate != null && <span style={{ width: 70, textAlign: 'right' }}>Subtotal</span>}
                  </div>
                  {report.projectRows.map((row, i) => (
                    <div key={i} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-primary)' }}>
                      <span style={{ flex: 1 }}>{row.name}</span>
                      <span style={{ width: 50, textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtHours(row.minutes)}</span>
                      {report.rate != null && <span style={{ width: 70, textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtMoney((row.minutes / 60) * report.rate)}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', margin: '12px 0' }}>
                  No hay registros para este período.
                </p>
              )}
            </div>
          )}

          {!report && (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Selecciona un cliente para ver el reporte.</p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" disabled={!report || report.projectRows.length === 0} onClick={exportPdf}>
            <FileDown size={14} /> Exportar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
