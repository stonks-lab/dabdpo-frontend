import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, LabelList,
  ComposedChart, Line, ReferenceLine,
} from 'recharts'
import * as XLSX from 'xlsx'
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
  cum_ppt_usd:         number
  cum_pai_metros:      number
  cum_av_metros:       number | null
  cum_ep_usd:          number | null
  cum_av_metros_proy:  number | null
  cum_ep_usd_proy:     number | null
  es_futuro: boolean
}

type CurvaSResp = {
  data: CurvaSPoint[]
  totales: { ppt_usd: number; pai_metros: number; av_metros: number; ep_usd: number }
  tiene_ep: boolean
  tiene_avance: boolean
  avg_av_rate: number
  avg_ep_rate: number
  last_ep_month: string | null
  ep_bridge_month: string | null
}

const fmtN   = (n?: number | null) =>
  n != null ? new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n) : '—'
const fmtM   = (n?: number | null) => n != null ? fmtN(n) + ' m' : '—'
const fmtUS  = (n?: number | null) => n != null ? 'US$ ' + fmtN(n) : '—'
const fmtUPM = (n?: number | null) => n != null ? 'US$ ' + fmtN(n) + '/m' : '—'
const fmtPct = (n: number) => n.toFixed(1) + '%'
const fmtMM      = (n: number) => `US$ ${(n / 1_000_000).toFixed(2)} M`
const fmtAxisM   = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M m` : v >= 1000 ? `${(v / 1000).toFixed(0)}k m` : `${v} m`

const CLP_RATE   = 950
const fmtCLP     = (n: number | null | undefined) => n != null ? `MM$ ${(n / 1_000_000).toFixed(0)}` : '—'
const fmtAxisCLP = (v: number) => v >= 1_000_000_000 ? `MM$ ${(v / 1_000_000_000).toFixed(1)}M` : `MM$ ${(v / 1_000_000).toFixed(0)}`

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

  const avProy = d.cum_av_metros_proy
  const epProy = d.cum_ep_usd_proy

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.08)',
      minWidth: 230,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#0D245C' }}>
        {label}
        {(d.es_futuro || d.cum_ep_usd_proy != null && d.cum_ep_usd == null) && (
          <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>proyección</span>
        )}
      </div>

      {/* Physical */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Físico (metros)</div>
        {d.cum_pai_metros > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
            <span style={{ color: '#f59e0b', fontWeight: 500 }}>PAI plan</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{fmtM(d.cum_pai_metros)}</span>
          </div>
        )}
        {d.cum_av_metros != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
            <span style={{ color: '#2563eb', fontWeight: 500 }}>Avance real</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{fmtM(d.cum_av_metros)}</span>
          </div>
        )}
        {d.es_futuro && avProy != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
            <span style={{ color: '#2563eb', fontWeight: 500, opacity: .7 }}>Avance proy.</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{fmtM(avProy)}</span>
          </div>
        )}
      </div>

      {/* Financial */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Financiero (CLP)</div>
        {d.cum_ppt_usd > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>PPT plan</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{fmtCLP(d.cum_ppt_usd * CLP_RATE)}</span>
          </div>
        )}
        {d.cum_ep_usd != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
            <span style={{ color: '#7c3aed', fontWeight: 500 }}>EP real</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{fmtCLP(d.cum_ep_usd * CLP_RATE)}</span>
          </div>
        )}
        {d.cum_ep_usd == null && epProy != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
            <span style={{ color: '#7c3aed', fontWeight: 500, opacity: .7 }}>EP proy.</span>
            <span style={{ fontWeight: 700, color: '#374151' }}>{fmtCLP(epProy * CLP_RATE)}</span>
          </div>
        )}
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

  const [tSort, setTSort] = useState<keyof ProyectoRow>('proyecto')
  const [tDir,  setTDir]  = useState<'asc' | 'desc'>('asc')

  function toggleSort(col: keyof ProyectoRow) {
    if (col === tSort) setTDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setTSort(col); setTDir('asc') }
  }
  const arr = (col: keyof ProyectoRow) => tSort === col ? (tDir === 'asc' ? ' ↑' : ' ↓') : ''

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

  const sortedProyectos = useMemo(() => {
    if (!data) return []
    return [...data.proyectos].sort((a, b) => {
      const av = (a[tSort] ?? 0), bv = (b[tSort] ?? 0)
      if (typeof av === 'number' && typeof bv === 'number')
        return tDir === 'asc' ? av - bv : bv - av
      return tDir === 'asc'
        ? String(av).localeCompare(String(bv), 'es')
        : String(bv).localeCompare(String(av), 'es')
    })
  }, [data, tSort, tDir])

  function exportExcel() {
    if (!data) return
    const rows = data.proyectos.map(p => ({
      'Código':          p.proyecto,
      'Nombre':          p.nombre || '',
      'Metros AR':       p.metros_ar ?? 0,
      'PPT USD AR':      p.ppt_usd_ar ?? 0,
      'USD/m AR':        p.usd_por_metro_ar ?? '',
      'Metros DHH':      p.metros_dhh ?? 0,
      'PPT USD DHH':     p.ppt_usd_dhh ?? 0,
      'USD/m DHH':       p.usd_por_metro_dhh ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto Perforación')
    XLSX.writeFile(wb, `presupuesto_perforacion_${ano ?? 'todos'}.xlsx`)
  }

  const hoyMes = new Date().toISOString().slice(0, 7)

  const curvaSChartData = useMemo(() => {
    if (!curvaS) return []
    return curvaS.data
      .filter(d =>
        d.cum_ppt_usd > 0 || d.cum_pai_metros > 0 ||
        d.cum_av_metros != null || d.cum_av_metros_proy != null ||
        d.cum_ep_usd    != null || d.cum_ep_usd_proy    != null
      )
      .map(d => ({
        ...d,
        mes_label:          mesLabel(d.mes),
        cum_ppt_clp:        d.cum_ppt_usd * CLP_RATE,
        cum_ep_clp:         d.cum_ep_usd      != null ? d.cum_ep_usd      * CLP_RATE : null,
        cum_ep_proy_clp:    d.cum_ep_usd_proy != null ? d.cum_ep_usd_proy * CLP_RATE : null,
      }))
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
                    <span style={{ color: '#64748b' }}>EP real (contratos perforación): </span>
                    <span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmtCLP(curvaS.totales.ep_usd * CLP_RATE)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Leyenda manual */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginBottom: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: '#f59e0b', borderRadius: 1 }} />
                <span style={{ color: '#374151' }}>PAI físico — metros (izq.)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 2, background: '#94a3b8', borderRadius: 1 }} />
                <span style={{ color: '#374151' }}>PPT financiero — CLP (der.)</span>
              </div>
              {curvaS.tiene_avance && (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2, background: '#2563eb', borderRadius: 1 }} />
                  <span style={{ color: '#374151' }}>Avance físico — metros (izq.)</span>
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
                  <span style={{ color: '#374151' }}>EP financiero — CLP (der.)</span>
                </div>
                {curvaS.avg_ep_rate > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 18, height: 0, borderTop: '2.5px dashed #7c3aed' }} />
                    <span style={{ color: '#374151' }}>EP financiero (proy.)</span>
                  </div>
                )}
              </>)}
            </div>

            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={curvaSChartData} margin={{ top: 8, right: 70, bottom: 8, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="mes_label"
                  tick={{ fontSize: 11 }}
                  interval={curvaSChartData.length <= 13 ? 0 : Math.ceil(curvaSChartData.length / 12) - 1}
                />
                {/* Left Y-axis: meters (physical) */}
                <YAxis
                  yAxisId="m"
                  orientation="left"
                  tickFormatter={fmtAxisM}
                  tick={{ fontSize: 10 }}
                  width={60}
                  label={{ value: 'Metros', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', dx: -4 }}
                />
                {/* Right Y-axis: CLP (financial) */}
                <YAxis
                  yAxisId="clp"
                  orientation="right"
                  tickFormatter={fmtAxisCLP}
                  tick={{ fontSize: 10 }}
                  width={90}
                  label={{ value: 'CLP', angle: 90, position: 'insideRight', fontSize: 10, fill: '#94a3b8', dx: 6 }}
                />
                <Tooltip content={<CurvaSTooltip />} />
                <ReferenceLine
                  yAxisId="m"
                  x={hoyMesLabel}
                  stroke="#94a3b8"
                  strokeDasharray="4 3"
                  label={{ value: 'Hoy', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
                />
                {/* Planned lines — solid, connect across nulls */}
                <Line
                  yAxisId="m"
                  type="monotone" dataKey="cum_pai_metros" name="PAI físico"
                  stroke="#f59e0b" strokeWidth={2}
                  dot={false} connectNulls
                />
                <Line
                  yAxisId="clp"
                  type="monotone" dataKey="cum_ppt_clp" name="PPT financiero"
                  stroke="#94a3b8" strokeWidth={2}
                  dot={false} connectNulls
                />
                {/* Physical actual */}
                {curvaS.tiene_avance && (
                  <Line
                    yAxisId="m"
                    type="monotone" dataKey="cum_av_metros" name="Avance físico"
                    stroke="#2563eb" strokeWidth={2.5}
                    dot={false}
                  />
                )}
                {/* Physical projected */}
                {curvaS.tiene_avance && curvaS.avg_av_rate > 0 && (
                  <Line
                    yAxisId="m"
                    type="monotone" dataKey="cum_av_metros_proy" name="Avance físico (proy.)"
                    stroke="#2563eb" strokeWidth={2} strokeDasharray="5 4"
                    dot={false}
                  />
                )}
                {/* Financial actual */}
                {curvaS.tiene_ep && (
                  <Line
                    yAxisId="clp"
                    type="monotone" dataKey="cum_ep_clp" name="EP financiero"
                    stroke="#7c3aed" strokeWidth={2.5}
                    dot={false}
                  />
                )}
                {/* Financial projected */}
                {curvaS.tiene_ep && curvaS.avg_ep_rate > 0 && (
                  <Line
                    yAxisId="clp"
                    type="monotone" dataKey="cum_ep_proy_clp" name="EP financiero (proy.)"
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
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="btn-ghost" onClick={exportExcel}>
                ↓ Excel
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('nombre')}>Nombre{arr('nombre')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('proyecto')}>Código{arr('proyecto')}</th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('metros_ar')}>Metros AR{arr('metros_ar')}</th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('ppt_usd_ar')}>PPT AR{arr('ppt_usd_ar')}</th>
                    <th style={{ textAlign: 'right', background: '#fef3c7', color: '#92400e', cursor: 'pointer' }} onClick={() => toggleSort('usd_por_metro_ar')}>US$/m AR{arr('usd_por_metro_ar')}</th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('metros_dhh')}>Metros DHH{arr('metros_dhh')}</th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('ppt_usd_dhh')}>PPT DHH{arr('ppt_usd_dhh')}</th>
                    <th style={{ textAlign: 'right', background: '#dbeafe', color: '#1e3a8a', cursor: 'pointer' }} onClick={() => toggleSort('usd_por_metro_dhh')}>US$/m DHH{arr('usd_por_metro_dhh')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProyectos.map(p => (
                    <tr key={p.proyecto}>
                      <td>{p.nombre || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--gray-500)' }}>{p.proyecto}</td>
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
          </>
        )}
      </div>
    </div>
  )
}
