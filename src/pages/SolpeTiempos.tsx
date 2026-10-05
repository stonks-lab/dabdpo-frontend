import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getSolpeTiempos } from '../api/client'
import PageHeader from '../components/PageHeader'

interface Kpis {
  total: number
  completadas: number
  prom_total: number | null
  mediana_total: number | null
  prom_etapa1: number | null
  prom_etapa2: number | null
}

interface MesRow {
  mes: string
  cantidad: number
  prom_etapa1: number | null
  prom_etapa2: number | null
  prom_total: number | null
}

interface EstadoRow {
  estado: string
  cantidad: number
  prom_etapa1: number | null
  prom_etapa2: number | null
  prom_total: number | null
}

interface TablaRow {
  Código?: string
  Nombre?: string
  Grupo_Estado?: string
  Fecha_Creacion_SOLPE?: string
  Fecha_Adjudicacion?: string
  Fecha_Suscripcion?: string
  dias_etapa1?: number | null
  dias_etapa2?: number | null
  dias_total?: number | null
}

const NAVY  = 'var(--color-navy)'
const GOLD  = 'var(--color-gold)'
const TEAL  = '#2a9d8f'

function KpiCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="panel" style={{ flex: '1 1 160px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function SolpeTiempos() {
  const [data, setData]       = useState<{ kpis: Kpis; por_mes: MesRow[]; por_estado: EstadoRow[]; tabla: TablaRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [filterEstado, setFilterEstado] = useState('')

  useEffect(() => {
    getSolpeTiempos()
      .then(setData)
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [])

  const estados = useMemo(() => {
    if (!data) return []
    return [...new Set(data.tabla.map(r => r.Grupo_Estado ?? '').filter(Boolean))].sort()
  }, [data])

  const tablaFiltrada = useMemo(() => {
    if (!data) return []
    return data.tabla.filter(r => {
      const matchSearch = !search ||
        (r.Código ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.Nombre ?? '').toLowerCase().includes(search.toLowerCase())
      const matchEstado = !filterEstado || r.Grupo_Estado === filterEstado
      return matchSearch && matchEstado
    })
  }, [data, search, filterEstado])

  if (loading) return <><PageHeader title="Dashboard DAB" /><div className="page"><p>Cargando...</p></div></>
  if (error)   return <><PageHeader title="Dashboard DAB" /><div className="page"><p style={{ color: 'red' }}>{error}</p></div></>
  if (!data)   return null

  const { kpis, por_mes, por_estado } = data

  const mesLabels = por_mes.map(r => {
    const [anio, m] = r.mes.split('-')
    const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${meses[parseInt(m)] ?? m} ${anio}`
  })

  const porMesChart = por_mes.map((r, i) => ({
    mes: mesLabels[i],
    'Etapa 1': r.prom_etapa1,
    'Etapa 2': r.prom_etapa2,
    'Total':   r.prom_total,
  }))

  const porEstadoChart = por_estado.map(r => ({
    estado:    r.estado,
    'Etapa 1': r.prom_etapa1,
    'Etapa 2': r.prom_etapa2,
    'Total':   r.prom_total,
  }))

  return (
    <>
      <PageHeader title="Dashboard DAB" />
      <div className="page">

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Total SOLPEs"      value={kpis.total} />
          <KpiCard label="Completadas"        value={kpis.completadas} sub="con fecha suscripción" />
          <KpiCard label="Tiempo promedio"    value={kpis.prom_total != null ? `${kpis.prom_total} d` : null} sub="creación → suscripción" />
          <KpiCard label="Mediana"            value={kpis.mediana_total != null ? `${kpis.mediana_total} d` : null} sub="tiempo total" />
          <KpiCard label="Promedio Etapa 1"   value={kpis.prom_etapa1 != null ? `${kpis.prom_etapa1} d` : null} sub="creación → adjudicación" />
          <KpiCard label="Promedio Etapa 2"   value={kpis.prom_etapa2 != null ? `${kpis.prom_etapa2} d` : null} sub="adjudicación → suscripción" />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* By estado */}
          <div className="panel">
            <div className="panel-title">Días promedio por estado</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porEstadoChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="estado" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} días`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Etapa 1" fill={NAVY}  maxBarSize={32} />
                <Bar dataKey="Etapa 2" fill={GOLD}  maxBarSize={32} />
                <Bar dataKey="Total"   fill={TEAL}  maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Etapa breakdown (stacked) */}
          <div className="panel">
            <div className="panel-title">Etapa 1 vs Etapa 2 (días promedio)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { etapa: 'Etapa 1\nCreación→Adj.', dias: kpis.prom_etapa1 },
                  { etapa: 'Etapa 2\nAdj.→Suscripción', dias: kpis.prom_etapa2 },
                  { etapa: 'Total\nCreación→Suscripción', dias: kpis.prom_total },
                ]}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="etapa" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} días`} />
                <Bar dataKey="dias" maxBarSize={48}
                  fill={NAVY}
                  label={{ position: 'top', fontSize: 11, formatter: (v: number) => v != null ? `${v}d` : '' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Por mes */}
        {porMesChart.length > 0 && (
          <div className="panel">
            <div className="panel-title">Días promedio por mes de creación</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porMesChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} días`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Etapa 1" fill={NAVY} maxBarSize={28} />
                <Bar dataKey="Etapa 2" fill={GOLD} maxBarSize={28} />
                <Bar dataKey="Total"   fill={TEAL} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabla */}
        <div className="panel">
          <div className="panel-title">Detalle por SOLPE</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              className="form-control"
              style={{ flex: 1, maxWidth: 280, fontSize: 13, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
              placeholder="Buscar código o nombre…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'white' }}
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {estados.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Creación</th>
                  <th>Adjudicación</th>
                  <th>Suscripción</th>
                  <th style={{ textAlign: 'right' }}>E1 (d)</th>
                  <th style={{ textAlign: 'right' }}>E2 (d)</th>
                  <th style={{ textAlign: 'right' }}>Total (d)</th>
                </tr>
              </thead>
              <tbody>
                {tablaFiltrada.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.Código ?? '—'}</td>
                    <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={r.Nombre}>{r.Nombre ?? '—'}</td>
                    <td>
                      <span className={`chip ${
                        r.Grupo_Estado === 'Cerrada'    ? 'chip-green'  :
                        r.Grupo_Estado === 'Rechazada'  ? 'chip-red'    :
                        r.Grupo_Estado === 'En Proceso' ? 'chip-yellow' :
                        'chip-gray'
                      }`}>{r.Grupo_Estado ?? '—'}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{r.Fecha_Creacion_SOLPE ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.Fecha_Adjudicacion ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.Fecha_Suscripcion ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dias_etapa1 ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dias_etapa2 ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.dias_total ?? '—'}</td>
                  </tr>
                ))}
                {tablaFiltrada.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            {tablaFiltrada.length} de {data.tabla.length} registros
          </div>
        </div>

      </div>
    </>
  )
}
