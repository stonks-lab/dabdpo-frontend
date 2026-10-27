import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, LabelList,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { getPresupuestoPerforacion } from '../api/client'

type ProyectoRow = {
  proyecto: string
  nombre?: string
  metros_ar?: number
  ppt_usd_ar?: number
  usd_por_metro_ar?: number | null
  metros_dhh?: number
  ppt_usd_dhh?: number
  usd_por_metro_dhh?: number | null
}

type Totales = {
  metros_ar: number
  metros_dhh: number
  ppt_usd_ar: number
  ppt_usd_dhh: number
  usd_por_metro_ar: number | null
  usd_por_metro_dhh: number | null
}

const fmtN   = (n?: number | null) =>
  n != null ? new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n) : '—'
const fmtM   = (n?: number | null) => n != null ? fmtN(n) + ' m' : '—'
const fmtUS  = (n?: number | null) => n != null ? 'US$ ' + fmtN(n) : '—'
const fmtUPM = (n?: number | null) => n != null ? 'US$ ' + fmtN(n) + '/m' : '—'
const fmtPct = (n: number) => n.toFixed(1) + '%'

// Encabezado colapsable reutilizable
function CollapseHeader({
  title, count, open, onToggle,
}: { title: string; count?: number; open: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', cursor: 'pointer',
        padding: '10px 0', userSelect: 'none', borderBottom: open ? '1px solid #f1f5f9' : 'none',
        marginBottom: open ? 12 : 0,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '.7px' }}>
        {title}
      </span>
      {count != null && (
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{count} proyectos</span>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
    </div>
  )
}

export default function PresupuestoPerforacion() {
  const [data, setData]         = useState<{ proyectos: ProyectoRow[]; totales: Totales } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [tableOpen, setTableOpen]   = useState(false)
  const [kpiDetail, setKpiDetail]   = useState<null | 'ar' | 'dhh'>(null)

  useEffect(() => {
    getPresupuestoPerforacion()
      .then(setData)
      .catch(e => setError(String(e?.response?.data?.detail ?? e)))
      .finally(() => setLoading(false))
  }, [])

  const chartData = useMemo(() =>
    (data?.proyectos ?? [])
      .filter(p => (p.usd_por_metro_ar ?? 0) > 0 || (p.usd_por_metro_dhh ?? 0) > 0)
      .map(p => ({
        proyecto: p.proyecto,
        label: p.nombre || p.proyecto,
        AR:  p.usd_por_metro_ar  ?? 0,
        DHH: p.usd_por_metro_dhh ?? 0,
      })),
    [data],
  )

  if (loading) return <div className="p-6 text-slate-400 text-sm">Cargando datos...</div>
  if (error)   return <div className="p-6 text-red-500 text-sm">{error}</div>
  if (!data)   return null

  const { totales, proyectos } = data

  const handleKpi = (tipo: 'ar' | 'dhh') =>
    setKpiDetail(prev => prev === tipo ? null : tipo)

  // Filas para la tabla detalle del KPI seleccionado
  const kpiRows = kpiDetail === 'ar'
    ? proyectos
        .filter(p => (p.metros_ar ?? 0) > 0)
        .map(p => ({
          nombre:   p.nombre || p.proyecto,
          codigo:   p.proyecto,
          upm:      p.usd_por_metro_ar,
          metros:   p.metros_ar ?? 0,
          pct:      totales.metros_ar > 0 ? (p.metros_ar ?? 0) / totales.metros_ar * 100 : 0,
        }))
        .sort((a, b) => b.metros - a.metros)
    : proyectos
        .filter(p => (p.metros_dhh ?? 0) > 0)
        .map(p => ({
          nombre:   p.nombre || p.proyecto,
          codigo:   p.proyecto,
          upm:      p.usd_por_metro_dhh,
          metros:   p.metros_dhh ?? 0,
          pct:      totales.metros_dhh > 0 ? (p.metros_dhh ?? 0) / totales.metros_dhh * 100 : 0,
        }))
        .sort((a, b) => b.metros - a.metros)

  const kpiColor   = kpiDetail === 'ar' ? '#f59e0b' : '#3b82f6'
  const kpiColorBg = kpiDetail === 'ar' ? '#fffbeb' : '#eff6ff'
  const kpiLabel   = kpiDetail === 'ar' ? 'Aire Reverso' : 'Diamantina'

  return (
    <div className="page">
      <PageHeader
        title="Presupuesto Perforación"
        subtitle="Costo presupuestado por metro — Aire Reverso y Diamantina por proyecto"
        icon="⛏️"
      />

      {/* KPI cards — costo arriba, metros abajo */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <KpiCard
          label="Costo/m AR (prom. ponderado)"
          value={fmtUPM(totales.usd_por_metro_ar)}
          color="gold"
          onClick={() => handleKpi('ar')}
        />
        <KpiCard
          label="Costo/m DHH (prom. ponderado)"
          value={fmtUPM(totales.usd_por_metro_dhh)}
          color="blue"
          onClick={() => handleKpi('dhh')}
        />
        <KpiCard
          label="Metros AR presupuestados"
          value={fmtM(totales.metros_ar)}
          color="gold"
        />
        <KpiCard
          label="Metros DHH presupuestados"
          value={fmtM(totales.metros_dhh)}
          color="blue"
        />
      </div>

      {/* Tabla drill-down del KPI seleccionado */}
      {kpiDetail && (
        <div className="panel" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '.7px' }}>
              Detalle costo/m — {kpiLabel}
            </span>
            <button
              onClick={() => setKpiDetail(null)}
              style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕ cerrar
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th style={{ textAlign: 'right', background: kpiColorBg, color: kpiColor }}>US$/m</th>
                  <th style={{ textAlign: 'right' }}>Metros PPT</th>
                  <th style={{ textAlign: 'right' }}>% del total</th>
                </tr>
              </thead>
              <tbody>
                {kpiRows.map(r => (
                  <tr key={r.codigo}>
                    <td>{r.nombre}</td>
                    <td className="font-mono text-xs text-slate-500">{r.codigo}</td>
                    <td style={{ textAlign: 'right', background: kpiColorBg, fontWeight: 600, color: kpiColor }}>
                      {fmtUPM(r.upm)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtM(r.metros)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{
                          height: 6, width: 60, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${Math.min(r.pct, 100)}%`,
                            background: kpiColor, borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                          {fmtPct(r.pct)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gráfico */}
      <div className="panel">
        <h2>Costo US$/metro por proyecto</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 16, bottom: 8, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={80}
              tickFormatter={(v: string) => v.length > 32 ? v.slice(0, 32) + '…' : v}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={v => `$${fmtN(v)}`}
            />
            <Tooltip
              formatter={(v: number, name: string) => [fmtUPM(v), name === 'AR' ? 'Aire Reverso' : 'Diamantina']}
            />
            <Legend formatter={n => n === 'AR' ? 'Aire Reverso' : 'Diamantina'} />
            <Bar dataKey="AR"  fill="#f59e0b" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="AR"  position="top" formatter={(v: number) => v > 0 ? `$${fmtN(v)}` : ''} style={{ fontSize: 9, fill: '#92400e', fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="DHH" fill="#3b82f6" radius={[3, 3, 0, 0]}>
              <LabelList dataKey="DHH" position="top" formatter={(v: number) => v > 0 ? `$${fmtN(v)}` : ''} style={{ fontSize: 9, fill: '#1e3a8a', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla colapsable */}
      <div className="panel">
        <CollapseHeader
          title="Detalle por proyecto"
          count={proyectos.length}
          open={tableOpen}
          onToggle={() => setTableOpen(o => !o)}
        />
        {tableOpen && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th style={{ textAlign: 'right' }}>Metros AR</th>
                  <th style={{ textAlign: 'right' }}>PPT AR</th>
                  <th style={{ textAlign: 'right', background: '#fef3c7', color: '#92400e' }}>US$/m AR</th>
                  <th style={{ textAlign: 'right' }}>Metros DHH</th>
                  <th style={{ textAlign: 'right' }}>PPT DHH</th>
                  <th style={{ textAlign: 'right', background: '#dbeafe', color: '#1e3a8a' }}>US$/m DHH</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map(p => (
                  <tr key={p.proyecto}>
                    <td>{p.nombre || '—'}</td>
                    <td className="font-mono text-xs text-slate-500">{p.proyecto}</td>
                    <td style={{ textAlign: 'right' }}>{fmtM(p.metros_ar)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUS(p.ppt_usd_ar)}</td>
                    <td style={{ textAlign: 'right', background: '#fffbeb', fontWeight: 600, color: '#92400e' }}>{fmtUPM(p.usd_por_metro_ar)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtM(p.metros_dhh)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUS(p.ppt_usd_dhh)}</td>
                    <td style={{ textAlign: 'right', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>{fmtUPM(p.usd_por_metro_dhh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
