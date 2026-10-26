import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { getPresupuestoPerforacion } from '../api/client'

type ProyectoRow = {
  proyecto: string
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

export default function PresupuestoPerforacion() {
  const [data, setData]     = useState<{ proyectos: ProyectoRow[]; totales: Totales } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

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
        AR:  p.usd_por_metro_ar  ?? 0,
        DHH: p.usd_por_metro_dhh ?? 0,
      })),
    [data],
  )

  if (loading) return <div className="p-6 text-slate-400 text-sm">Cargando datos...</div>
  if (error)   return <div className="p-6 text-red-500 text-sm">{error}</div>
  if (!data)   return null

  const { totales, proyectos } = data

  return (
    <div className="page">
      <PageHeader
        title="Presupuesto Perforación"
        subtitle="Costo presupuestado por metro — Aire Reverso y Diamantina por proyecto"
        icon="⛏️"
      />

      <div className="kpi-grid">
        <KpiCard
          label="Metros AR presupuestados"
          value={fmtM(totales.metros_ar)}
          color="blue"
        />
        <KpiCard
          label="Costo/m AR (prom. ponderado)"
          value={fmtUPM(totales.usd_por_metro_ar)}
          color="gold"
        />
        <KpiCard
          label="Metros DHH presupuestados"
          value={fmtM(totales.metros_dhh)}
          color="blue"
        />
        <KpiCard
          label="Costo/m DHH (prom. ponderado)"
          value={fmtUPM(totales.usd_por_metro_dhh)}
          color="gold"
        />
      </div>

      <div className="panel">
        <h2>Costo US$/metro por proyecto</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 48, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
            <XAxis
              dataKey="proyecto"
              tick={{ fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={v => `$${fmtN(v)}`}
            />
            <Tooltip
              formatter={(v: number, name: string) => [fmtUPM(v), name === 'AR' ? 'Aire Reverso' : 'Diamantina']}
            />
            <Legend formatter={n => n === 'AR' ? 'Aire Reverso' : 'Diamantina'} />
            <Bar dataKey="AR"  fill="var(--navy-400)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="DHH" fill="var(--gold-500)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h2>Detalle por proyecto</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th style={{ textAlign: 'right' }}>Metros AR</th>
                <th style={{ textAlign: 'right' }}>PPT AR</th>
                <th style={{ textAlign: 'right' }}>US$/m AR</th>
                <th style={{ textAlign: 'right' }}>Metros DHH</th>
                <th style={{ textAlign: 'right' }}>PPT DHH</th>
                <th style={{ textAlign: 'right' }}>US$/m DHH</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map(p => (
                <tr key={p.proyecto}>
                  <td>{p.proyecto}</td>
                  <td style={{ textAlign: 'right' }}>{fmtM(p.metros_ar)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUS(p.ppt_usd_ar)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUPM(p.usd_por_metro_ar)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtM(p.metros_dhh)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUS(p.ppt_usd_dhh)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtUPM(p.usd_por_metro_dhh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
