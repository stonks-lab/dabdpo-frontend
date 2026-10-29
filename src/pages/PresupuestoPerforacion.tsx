import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, LabelList,
  ComposedChart, Line, ReferenceLine,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { getPresupuestoPerforacion, getCurvaS, getPresupuestoAnos } from '../api/client'

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

type CurvaSPoint = {
  mes: string
  pct_ppt_fin:      number | null
  pct_pai_fis:      number | null
  pct_av_fis:       number | null
  pct_ep_fin:       number | null
  pct_av_fis_proy:  number | null
  pct_ep_fin_proy:  number | null
  cum_ppt_usd:    number
  cum_pai_metros: number
  cum_av_metros:  number | null
  cum_ep_usd:     number | null
  es_futuro: boolean
}

type CurvaSResp = {
  data: CurvaSPoint[]
  totales: { ppt_usd: number; pai_metros: number; av_metros: number; ep_usd: number }
  tiene_ep: boolean
  tiene_avance: boolean
  avg_av_rate: number
  avg_ep_rate: number
}

const fmtN   = (n?: number | null) =>
  n != null ? new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n) : '—'
const fmtM   = (n?: number | null) => n != null ? fmtN(n) + ' m' : '—'
const fmtUS  = (n?: number | null) => n != null ? 'US$ ' + fmtN(n) : '—'
const fmtUPM = (n?: number | null) => n != null ? 'US$ ' + fmtN(n) + '/m' : '—'
const fmtPct = (n: number) => n.toFixed(1) + '%'
const fmtMM  = (n: number) => `US$ ${(n / 1_000_000).toFixed(2)} M`

const MESES_SHORT: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}
const mesLabel = (m: string) => {
  const [yr, mo] = m.split('-')
  return `${MESES_SHORT[mo] ?? mo} ${yr?.slice(2) ?? ''}`
}

function CurvaSTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as (CurvaSPoint & { mes_label: string }) | undefined
  if (!d) return null
  // Deduplicate: prefer actual over projection when both exist for same concept
  const seen = new Set<string>()
  const rows = payload.filter((p: any) => {
    const base = p.dataKey.replace('_proy', '')
    if (seen.has(base)) return false
    seen.add(base)
    return true
  })
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.08)',
      minWidth: 220,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#0D245C' }}>
        {label}{d.es_futuro && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>proyección</span>}
      </div>
      {rows.map((p: any) => {
        const isProy = p.dataKey.endsWith('_proy')
        const val = p.value ?? d[p.dataKey as keyof CurvaSPoint]
        return (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 3 }}>
            <span style={{ color: p.color, fontWeight: 500 }}>
              {p.name}{isProy && <span style={{ opacity: .6 }}> (proy.)</span>}
            </span>
            <span style={{ fontWeight: 700, color: '#374151' }}>
              {val != null ? `${Number(val).toFixed(1)}%` : '—'}
            </span>
          </div>
        )
      })}
      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 8, color: '#64748b', fontSize: 11 }}>
        {d.cum_ppt_usd > 0 && <div>PPT acum: {fmtMM(d.cum_ppt_usd)}</div>}
        {d.cum_pai_metros > 0 && <div>PAI acum: {fmtM(d.cum_pai_metros)}</div>}
        {d.cum_av_metros  != null && <div>Avance acum: {fmtM(d.cum_av_metros)}</div>}
        {d.cum_ep_usd     != null && <div>EP acum: {fmtMM(d.cum_ep_usd)}</div>}
      </div>
    </div>
  )
}

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
  const [anos, setAnos]             = useState<number[]>([])
  const [ano, setAno]               = useState<number | undefined>(undefined)

  const [data, setData]             = useState<{ proyectos: ProyectoRow[]; totales: Totales } | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [tableOpen, setTableOpen]   = useState(false)
  const [kpiDetail, setKpiDetail]   = useState<null | 'ar' | 'dhh'>(null)

  const [curvaS, setCurvaS]         = useState<CurvaSResp | null>(null)
  const [csLoading, setCsLoading]   = useState(true)
  const [csTipo, setCsTipo]         = useState<'all' | 'AR' | 'DHH'>('all')

  // Fetch available years once, then default to the latest
  useEffect(() => {
    getPresupuestoAnos()
      .then((r: { anos: number[] }) => {
        setAnos(r.anos)
        if (r.anos.length > 0) setAno(r.anos[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (ano === undefined) return
    setLoading(true)
    getPresupuestoPerforacion(ano)
      .then(setData)
      .catch(e => setError(String(e?.response?.data?.detail ?? e)))
      .finally(() => setLoading(false))
  }, [ano])

  useEffect(() => {
    if (ano === undefined) return
    setCsLoading(true)
    getCurvaS(csTipo, ano)
      .then(setCurvaS)
      .catch(() => {})
      .finally(() => setCsLoading(false))
  }, [csTipo, ano])

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

  const hoyMes = new Date().toISOString().slice(0, 7)

  const curvaSChartData = useMemo(() => {
    if (!curvaS) return []
    // Keep all months that have any plan or any actual/projected data — no filtering that creates gaps
    return curvaS.data
      .filter(d =>
        d.pct_ppt_fin    != null || d.pct_pai_fis      != null ||
        d.pct_av_fis     != null || d.pct_av_fis_proy  != null ||
        d.pct_ep_fin     != null || d.pct_ep_fin_proy   != null
      )
      .map(d => ({ ...d, mes_label: mesLabel(d.mes) }))
  }, [curvaS])

  const hoyMesLabel = mesLabel(hoyMes)

  if (ano === undefined) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>
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

      {/* Filtro de año */}
      {anos.length > 0 && (
        <div className="filters-bar">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)' }}>Año</label>
          <select
            value={ano ?? ''}
            onChange={e => setAno(Number(e.target.value))}
            style={{ fontSize: 13 }}
          >
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

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

      {/* Curva S avance físico-financiero */}
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Curva S — avance físico y financiero</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['all', 'AR', 'DHH'] as const).map(t => (
              <button
                key={t}
                onClick={() => setCsTipo(t)}
                style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4,
                  border: '1px solid',
                  borderColor: csTipo === t ? 'var(--navy-500)' : '#e2e8f0',
                  background: csTipo === t ? 'var(--navy-500)' : '#fff',
                  color: csTipo === t ? '#fff' : '#64748b',
                  cursor: 'pointer', letterSpacing: '.4px',
                }}
              >
                {t === 'all' ? 'Todo' : t}
              </button>
            ))}
          </div>
        </div>

        {csLoading && <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Cargando curva S…</div>}

        {!csLoading && curvaS && curvaSChartData.length > 0 && (
          <>
            {/* KPI strip */}
            {curvaS.totales.ppt_usd > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: '6px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>PPT total: </span>
                  <span style={{ fontWeight: 700, color: '#0D245C' }}>{fmtMM(curvaS.totales.ppt_usd)}</span>
                </div>
                {curvaS.totales.pai_metros > 0 && (
                  <div style={{ padding: '6px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>PAI total: </span>
                    <span style={{ fontWeight: 700, color: '#0D245C' }}>{fmtM(curvaS.totales.pai_metros)}</span>
                  </div>
                )}
                {curvaS.tiene_avance && (
                  <div style={{ padding: '6px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>Avance real: </span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{fmtM(curvaS.totales.av_metros)}</span>
                    {curvaS.totales.pai_metros > 0 && (
                      <span style={{ color: '#2563eb', marginLeft: 4 }}>
                        ({fmtPct(curvaS.totales.av_metros / curvaS.totales.pai_metros * 100)})
                      </span>
                    )}
                  </div>
                )}
                {curvaS.tiene_ep && (
                  <div style={{ padding: '6px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>EP real: </span>
                    <span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmtMM(curvaS.totales.ep_usd)}</span>
                    {curvaS.totales.ppt_usd > 0 && (
                      <span style={{ color: '#7c3aed', marginLeft: 4 }}>
                        ({fmtPct(curvaS.totales.ep_usd / curvaS.totales.ppt_usd * 100)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Leyenda manual */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginBottom: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: '#f59e0b', borderRadius: 1 }} />
                <span style={{ color: '#374151' }}>PAI físico (plan)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: '#94a3b8', borderRadius: 1 }} />
                <span style={{ color: '#374151' }}>PPT financiero (plan)</span>
              </div>
              {curvaS.tiene_avance && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2, background: '#2563eb', borderRadius: 1 }} />
                  <span style={{ color: '#374151' }}>Avance físico (real)</span>
                </div>
                {curvaS.avg_av_rate > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 18, height: 0, borderTop: '2.5px dashed #2563eb' }} />
                    <span style={{ color: '#374151' }}>Avance físico (proy.)</span>
                  </div>
                )}
              </>)}
              {curvaS.tiene_ep && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2, background: '#7c3aed', borderRadius: 1 }} />
                  <span style={{ color: '#374151' }}>EP financiero (real)</span>
                </div>
                {curvaS.avg_ep_rate > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 18, height: 0, borderTop: '2.5px dashed #7c3aed' }} />
                    <span style={{ color: '#374151' }}>EP financiero (proy.)</span>
                  </div>
                )}
              </>)}
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={curvaSChartData} margin={{ top: 8, right: 20, bottom: 8, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="mes_label"
                  tick={{ fontSize: 11 }}
                  interval={curvaSChartData.length <= 13 ? 0 : Math.ceil(curvaSChartData.length / 12) - 1}
                />
                <YAxis
                  tickFormatter={v => `${v}%`}
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  width={40}
                />
                <Tooltip content={<CurvaSTooltip />} />
                <ReferenceLine
                  x={hoyMesLabel}
                  stroke="#94a3b8"
                  strokeDasharray="4 3"
                  label={{ value: 'Hoy', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
                />
                <ReferenceLine y={100} stroke="#e2e8f0" strokeDasharray="3 3" />
                {/* Planned lines — solid, connect across nulls */}
                <Line
                  type="monotone" dataKey="pct_pai_fis" name="PAI físico"
                  stroke="#f59e0b" strokeWidth={2}
                  dot={false} connectNulls
                />
                <Line
                  type="monotone" dataKey="pct_ppt_fin" name="PPT financiero"
                  stroke="#94a3b8" strokeWidth={2}
                  dot={false} connectNulls
                />
                {/* Physical actual: solid up to bridge month, then null */}
                {curvaS.tiene_avance && (
                  <Line
                    type="monotone" dataKey="pct_av_fis" name="Avance físico"
                    stroke="#2563eb" strokeWidth={2.5}
                    dot={false}
                  />
                )}
                {/* Physical projected: dashed from bridge month onward */}
                {curvaS.tiene_avance && curvaS.avg_av_rate > 0 && (
                  <Line
                    type="monotone" dataKey="pct_av_fis_proy" name="Avance físico"
                    stroke="#2563eb" strokeWidth={2} strokeDasharray="5 4"
                    dot={false}
                  />
                )}
                {/* Financial actual */}
                {curvaS.tiene_ep && (
                  <Line
                    type="monotone" dataKey="pct_ep_fin" name="EP financiero"
                    stroke="#7c3aed" strokeWidth={2.5}
                    dot={false}
                  />
                )}
                {/* Financial projected */}
                {curvaS.tiene_ep && curvaS.avg_ep_rate > 0 && (
                  <Line
                    type="monotone" dataKey="pct_ep_fin_proy" name="EP financiero"
                    stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 4"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {!curvaS.tiene_avance && (
              <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                Sin datos de avance real disponibles en Avance_Semanal.
              </p>
            )}
            {!curvaS.tiene_ep && (
              <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
                Sin EPs de perforación identificados en SIC — solo se muestra la curva planificada.
              </p>
            )}
          </>
        )}

        {!csLoading && (!curvaS || curvaSChartData.length === 0) && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Sin datos para la curva S.
          </div>
        )}
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
