import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import * as XLSX from 'xlsx'
import {
  getEpKpis, getEpFiltros, getEpTimeline,
  getEpPorMesDetalle, getEpPorTipoDetalle,
} from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

// ── formateo ──────────────────────────────────────────────────────────────────

const mmclp = (v: number) => `$${(v / 1e9).toFixed(1)} MM`
const fmtMM = (v: number): string => {
  if (!isFinite(v) || v === 0) return '—'
  const abs = Math.abs(v), s = v < 0 ? '−' : ''
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}MM`
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`
  return `${s}$${abs.toFixed(0)}`
}
const clp = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

const MESES_ABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fmtMes = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MESES_ABR[parseInt(mo) - 1]}-${y.slice(2)}`
}

const PIE_COLORS = [
  '#1e3a5f', '#c9a84c', '#2563eb', '#16a34a', '#dc2626',
  '#9333ea', '#0891b2', '#ea580c', '#6b7280', '#84cc16',
]

function epCellBg(v: number, maxVal: number): string {
  if (v <= 0 || maxVal <= 0) return 'transparent'
  const ratio = Math.min(v / maxVal, 1)
  const r = Math.round(240 - ratio * (240 - 125))
  const g = Math.round(249 - ratio * (249 - 211))
  const b = Math.round(255 - ratio * (255 - 252))
  return `rgb(${r},${g},${b})`
}

// Columnas fijas de la tabla timeline — con columna de toggle al inicio
const TL_STICKY: { label: string; left: number; minW: number; align: 'left' | 'right' }[] = [
  { label: '',            left: 0,   minW: 28,  align: 'left'  },
  { label: 'Contrato',    left: 28,  minW: 84,  align: 'left'  },
  { label: 'Descripción', left: 112, minW: 155, align: 'left'  },
  { label: 'Proveedor',   left: 267, minW: 130, align: 'left'  },
  { label: 'Área',        left: 397, minW: 75,  align: 'left'  },
  { label: 'Total EP',    left: 472, minW: 86,  align: 'right' },
  { label: 'N° EPs',      left: 558, minW: 60,  align: 'right' },
]

const makeContractTick = (lookup: Record<string, string>) =>
  function ContractTick({ x, y, payload }: any) {
    const code = payload?.value ?? ''
    const desc = (lookup[code] ?? '').slice(0, 24)
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-4} y={-3} textAnchor="end" fill="#374151" fontSize={9} fontWeight={600}>{code}</text>
        {desc && <text x={-4} y={8} textAnchor="end" fill="#9aa1b3" fontSize={7.5}>{desc}</text>}
      </g>
    )
  }

// ── ExpandIcon ────────────────────────────────────────────────────────────────

const ExpandIcon = ({ open }: { open: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
    style={{ transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
  >
    <polyline points="3 2 7 5 3 8" />
  </svg>
)

// ── componente ────────────────────────────────────────────────────────────────

export default function EstadosPago() {
  const [kpis,     setKpis]    = useState<any>(null)
  const [filtros,  setFiltros] = useState<any>(null)
  const [timeline, setTimeline] = useState<any>(null)
  const [tlLoading, setTlLoading] = useState(true)
  const [porMes,   setPorMes]  = useState<any[]>([])
  const [porTipo,  setPorTipo] = useState<any[]>([])

  const [filters, setFilters] = useState({
    contrato: '', area: '', tipo: '', estado_ctt: '', proyecto: '', periodo_desde: '', periodo_hasta: '',
  })

  // Estado de expansión: contratos → proyectos → descripciones
  const [expandedCtts,      setExpandedCtts]      = useState<Set<string>>(new Set())
  const [expandedProyectos, setExpandedProyectos] = useState<Set<string>>(new Set())

  const hasFilters = Object.values(filters).some(Boolean)

  useEffect(() => {
    getEpFiltros().then(setFiltros).catch(() => {})
  }, [])

  useEffect(() => {
    const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    getEpKpis(p).then(setKpis).catch(() => {})
    getEpPorMesDetalle(p).then(setPorMes).catch(() => {})
    getEpPorTipoDetalle(p).then(setPorTipo).catch(() => {})
    setTlLoading(true)
    getEpTimeline(p)
      .then(data => { setTimeline(data); setExpandedCtts(new Set()); setExpandedProyectos(new Set()) })
      .catch(() => setTimeline(null))
      .finally(() => setTlLoading(false))
  }, [filters])

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const maxEpGlobal = useMemo(() => {
    if (!timeline?.contratos) return 1
    let max = 0
    for (const c of timeline.contratos)
      for (const v of c.eps) if (v > max) max = v
    return max || 1
  }, [timeline])

  const top10 = useMemo(() =>
    timeline?.contratos
      ? [...timeline.contratos].sort((a: any, b: any) => b.total_ep - a.total_ep).slice(0, 10)
      : []
  , [timeline])

  const top10promedio = useMemo(() =>
    timeline?.contratos
      ? [...timeline.contratos]
          .map((c: any) => ({
            ...c,
            ep_promedio: c.eps
              ? Math.round(c.total_ep / Math.max(c.eps.filter((v: number) => v > 0).length, 1))
              : 0,
          }))
          .sort((a: any, b: any) => b.ep_promedio - a.ep_promedio)
          .slice(0, 10)
      : []
  , [timeline])

  const top10Lookup = useMemo(() =>
    Object.fromEntries((timeline?.contratos ?? []).map((c: any) => [c.codigo_ctt, c.descripcion ?? '']))
  , [timeline])

  // ── helpers de expansión ─────────────────────────────────────────────────

  const toggleCtt = (ctt: string) =>
    setExpandedCtts(prev => { const s = new Set(prev); s.has(ctt) ? s.delete(ctt) : s.add(ctt); return s })

  const toggleProy = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedProyectos(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  const allCodes: string[] = useMemo(
    () => (timeline?.contratos ?? []).map((c: any) => c.codigo_ctt),
    [timeline]
  )

  const allExpanded = allCodes.length > 0 && allCodes.every(c => expandedCtts.has(c))

  const toggleAllCtts = () =>
    setExpandedCtts(allExpanded ? new Set() : new Set(allCodes))

  // ── exportar Excel con desglose por proyecto ─────────────────────────────

  const exportEP = () => {
    if (!timeline) return
    const monthCols = timeline.meses as string[]
    const headers = ['Contrato', 'Proveedor', 'Proyecto', 'Descripción contrato', 'Área', 'Total EP', 'N° EPs', ...monthCols.map(fmtMes)]
    const rows: any[][] = []
    for (const ctt of timeline.contratos) {
      const proyectos: any[] = ctt.proyectos ?? []
      if (proyectos.length === 0) {
        rows.push([ctt.codigo_ctt, ctt.proveedor ?? '', '', ctt.descripcion, ctt.area, ctt.total_ep, ctt.num_eps, ...ctt.eps])
      } else {
        for (const pr of proyectos) {
          rows.push([ctt.codigo_ctt, ctt.proveedor ?? '', pr.proyecto, ctt.descripcion, ctt.area, pr.total_ep, pr.num_eps, ...pr.eps])
        }
      }
    }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch: 14 }, { wch: 32 }, { wch: 40 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
      ...monthCols.map(() => ({ wch: 10 })),
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'EP por Proyecto')
    XLSX.writeFile(wb, 'ep_por_proyecto.xlsx')
  }

  if (!kpis) return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', color: '#9aa1b3', fontSize: 13 }}>
      Cargando…
    </div>
  )

  return (
    <>
      <PageHeader title="Estados de Pago" subtitle="EP consumido por contrato mes a mes" />
      <div className="page">

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="EP Total"            value={mmclp(kpis.ep_total_clp)}         color="blue" />
          <KpiCard label="N° Estados de Pago"  value={kpis.num_eps}                     color="blue" />
          <KpiCard label="Contratos con EP"    value={kpis.contratos_con_ep}            color="green" />
          <KpiCard label="EP Prom. / Contrato" value={fmtMM(kpis.ep_promedio_contrato)} color="blue" />
        </div>

        {/* Filtros */}
        {filtros && (
          <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              style={{ flex: '1 1 180px', fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}
              placeholder="Buscar contrato o descripción…"
              value={filters.contrato}
              onChange={e => setFilter('contrato', e.target.value)}
            />
            {[
              { key: 'proyecto',   label: 'Proyecto',      opts: filtros.proyectos   ?? [] },
              { key: 'tipo',       label: 'Tipo contrato', opts: filtros.tipos       ?? [] },
              { key: 'estado_ctt', label: 'Vigente',       opts: filtros.estados_ctt ?? [] },
              { key: 'area',       label: 'Área',          opts: filtros.areas       ?? [] },
            ].map(({ key, label, opts }) => opts.length > 0 && (
              <select key={key} value={(filters as any)[key]} onChange={e => setFilter(key, e.target.value)}
                style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}>
                <option value="">— {label} —</option>
                {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            {filtros.periodos?.length > 0 && (
              <>
                <select value={filters.periodo_desde} onChange={e => setFilter('periodo_desde', e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}>
                  <option value="">— Desde —</option>
                  {filtros.periodos.map((p: string) => <option key={p} value={p}>{fmtMes(p)}</option>)}
                </select>
                <select value={filters.periodo_hasta} onChange={e => setFilter('periodo_hasta', e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}>
                  <option value="">— Hasta —</option>
                  {[...filtros.periodos].reverse().map((p: string) => <option key={p} value={p}>{fmtMes(p)}</option>)}
                </select>
              </>
            )}
            {hasFilters && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }}
                onClick={() => setFilters({ contrato: '', area: '', tipo: '', estado_ctt: '', proyecto: '', periodo_desde: '', periodo_hasta: '' })}>
                ✕ Limpiar
              </button>
            )}
            {timeline && (
              <span style={{ fontSize: 12, color: '#9aa1b3', marginLeft: 'auto' }}>
                {timeline.contratos.length < timeline.total_contratos
                  ? `${timeline.contratos.length} de ${timeline.total_contratos} contratos`
                  : `${timeline.contratos.length} contratos`}
              </span>
            )}
          </div>
        )}

        {/* ── Timeline EP por Contrato (con desglose por proyecto) ─────────── */}
        <div className="panel" style={{ padding: 0 }}>

          {/* Cabecera */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--gray-200)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-500)' }}>
              EP por Contrato y Período
            </span>
            {timeline && (
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>ordenados por EP total</span>
            )}

            {/* Expandir / colapsar todos */}
            {allCodes.length > 0 && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 9px' }}
                onClick={toggleAllCtts}
              >
                {allExpanded ? '⊟ Colapsar proyectos' : '⊞ Expandir proyectos'}
              </button>
            )}

            {/* Leyenda de color */}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#9aa1b3' }}>Intensidad EP:</span>
              {([['Bajo', 0.25], ['Medio', 0.55], ['Alto', 1.0]] as [string, number][]).map(([label, r]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9aa1b3' }}>
                  <span style={{
                    width: 11, height: 11, borderRadius: 2, display: 'inline-block',
                    background: epCellBg(r, 1), border: '1px solid #e5e7eb',
                  }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Cuerpo */}
          {tlLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              Calculando EP por período…
            </div>
          ) : timeline ? (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 480 }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead>
                  <tr>
                    {TL_STICKY.map((col, ci) => (
                      <th key={col.label + ci}
                        style={{
                          position: 'sticky', top: 0, left: col.left, zIndex: 5,
                          minWidth: col.minW, padding: '7px 8px',
                          background: '#f9fafb', whiteSpace: 'nowrap',
                          borderBottom: '2px solid var(--gray-200)',
                          textAlign: col.align,
                          boxShadow: ci === TL_STICKY.length - 1 ? '3px 0 6px rgba(0,0,0,.07)' : undefined,
                        }}>
                        {col.label}
                      </th>
                    ))}
                    {timeline.meses.map((m: string) => (
                      <th key={m}
                        style={{
                          position: 'sticky', top: 0, zIndex: 3,
                          minWidth: 60, padding: '7px 4px', textAlign: 'center',
                          background:  m === timeline.mes_actual ? '#bfdbfe' : '#f9fafb',
                          color:       m === timeline.mes_actual ? '#1e40af' : '#9aa1b3',
                          fontWeight:  m === timeline.mes_actual ? 700 : 400,
                          borderBottom: '2px solid var(--gray-200)',
                          borderLeft:  m === timeline.mes_actual ? '2px solid #93c5fd' : undefined,
                          whiteSpace: 'nowrap',
                        }}>
                        {fmtMes(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.contratos.map((ctt: any) => {
                    const bd = '1px solid #f0f0f0'
                    const isCttOpen = expandedCtts.has(ctt.codigo_ctt)
                    const hasProyectos = (ctt.proyectos?.length ?? 0) > 0

                    return (
                      <Fragment key={ctt.codigo_ctt}>
                        {/* ── Fila contrato ── */}
                        <tr
                          style={{ cursor: hasProyectos ? 'pointer' : 'default' }}
                          onClick={() => hasProyectos && toggleCtt(ctt.codigo_ctt)}
                        >
                          <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', padding: '5px 6px', textAlign: 'center', borderBottom: bd, color: '#9aa1b3' }}>
                            {hasProyectos && <ExpandIcon open={isCttOpen} />}
                          </td>
                          <td style={{ position: 'sticky', left: 28, zIndex: 2, background: '#fff', padding: '5px 8px', fontFamily: 'monospace', fontWeight: 600, fontSize: 10, borderBottom: bd }}>
                            {ctt.codigo_ctt}
                          </td>
                          <td style={{ position: 'sticky', left: 112, zIndex: 2, background: '#fff', padding: '5px 8px', maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: bd }} title={ctt.descripcion}>
                            {ctt.descripcion}
                          </td>
                          <td style={{ position: 'sticky', left: 267, zIndex: 2, background: '#fff', padding: '5px 8px', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#374151', borderBottom: bd }} title={ctt.proveedor}>
                            {ctt.proveedor || '—'}
                          </td>
                          <td style={{ position: 'sticky', left: 397, zIndex: 2, background: '#fff', padding: '5px 8px', fontSize: 10, color: '#9aa1b3', borderBottom: bd }}>
                            {ctt.area}
                          </td>
                          <td style={{ position: 'sticky', left: 472, zIndex: 2, background: '#fff', padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, borderBottom: bd }}>
                            {fmtMM(ctt.total_ep)}
                          </td>
                          <td style={{ position: 'sticky', left: 558, zIndex: 2, background: '#fff', padding: '5px 8px', textAlign: 'right', boxShadow: '3px 0 6px rgba(0,0,0,.07)', borderBottom: bd }}>
                            {ctt.num_eps}
                          </td>
                          {timeline.meses.map((m: string, mi: number) => {
                            const v = ctt.eps[mi] ?? 0
                            return (
                              <td key={m} style={{ minWidth: 60, padding: '5px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, background: epCellBg(v, maxEpGlobal), borderLeft: m === timeline.mes_actual ? '2px solid #93c5fd' : undefined, borderBottom: bd, color: v > 0 ? 'var(--navy-500)' : '#d1d5db' }} title={v > 0 ? `${ctt.codigo_ctt} · ${m}: ${clp(v)}` : undefined}>
                                {v > 0 ? fmtMM(v) : '—'}
                              </td>
                            )
                          })}
                        </tr>

                        {/* ── Filas proyecto (nivel 1) ── */}
                        {isCttOpen && (ctt.proyectos ?? []).map((pr: any) => {
                          const proyKey = `${ctt.codigo_ctt}__${pr.proyecto}`
                          const isProyOpen = expandedProyectos.has(proyKey)
                          const hasDescs = (pr.descripciones?.length ?? 0) > 0
                          const bgP = '#f0f7ff'

                          return (
                            <Fragment key={proyKey}>
                              <tr style={{ background: bgP, cursor: hasDescs ? 'pointer' : 'default' }} onClick={hasDescs ? (e) => toggleProy(proyKey, e) : undefined}>
                                {/* toggle descripción */}
                                <td style={{ position: 'sticky', left: 0, zIndex: 2, background: bgP, padding: '4px 6px', textAlign: 'center', borderBottom: bd, color: '#9aa1b3' }}>
                                  {hasDescs && <ExpandIcon open={isProyOpen} />}
                                </td>
                                {/* ↳ en columna contrato */}
                                <td style={{ position: 'sticky', left: 28, zIndex: 2, background: bgP, padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#c9a84c', borderBottom: bd, whiteSpace: 'nowrap' }}>
                                  ↳
                                </td>
                                {/* nombre proyecto */}
                                <td style={{ position: 'sticky', left: 112, zIndex: 2, background: bgP, padding: '4px 8px', fontSize: 10, color: '#374151', fontWeight: 500, borderBottom: bd, whiteSpace: 'nowrap', maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis' }} title={pr.proyecto}>
                                  {pr.proyecto || '(sin proyecto)'}
                                </td>
                                <td style={{ position: 'sticky', left: 267, zIndex: 2, background: bgP, borderBottom: bd }} />
                                <td style={{ position: 'sticky', left: 397, zIndex: 2, background: bgP, borderBottom: bd }} />
                                <td style={{ position: 'sticky', left: 472, zIndex: 2, background: bgP, padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, color: '#1e3a5f', fontWeight: 600, borderBottom: bd }}>
                                  {fmtMM(pr.total_ep)}
                                </td>
                                <td style={{ position: 'sticky', left: 558, zIndex: 2, background: bgP, padding: '4px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', boxShadow: '3px 0 6px rgba(0,0,0,.05)', borderBottom: bd }}>
                                  {pr.num_eps}
                                </td>
                                {timeline.meses.map((m: string, mi: number) => {
                                  const v = pr.eps[mi] ?? 0
                                  return (
                                    <td key={m} style={{ minWidth: 60, padding: '4px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, background: v > 0 ? epCellBg(v, maxEpGlobal) : bgP, borderLeft: m === timeline.mes_actual ? '2px solid #93c5fd' : undefined, borderBottom: bd, color: v > 0 ? '#1e40af' : '#d1d5db' }} title={v > 0 ? `${pr.proyecto} · ${m}: ${clp(v)}` : undefined}>
                                      {v > 0 ? fmtMM(v) : '—'}
                                    </td>
                                  )
                                })}
                              </tr>

                              {/* ── Filas descripción (nivel 2) ── */}
                              {isProyOpen && (pr.descripciones ?? []).map((desc: any, di: number) => {
                                const bgD = '#f0f4ff'
                                return (
                                  <tr key={`${proyKey}__${di}`} style={{ background: bgD }}>
                                    <td style={{ position: 'sticky', left: 0, zIndex: 2, background: bgD, borderBottom: bd }} />
                                    {/* ↳ indentado en columna contrato */}
                                    <td style={{ position: 'sticky', left: 28, zIndex: 2, background: bgD, padding: '3px 8px 3px 18px', fontSize: 10, color: '#c9a84c', borderBottom: bd, whiteSpace: 'nowrap' }}>
                                      ↳
                                    </td>
                                    {/* descripción */}
                                    <td style={{ position: 'sticky', left: 112, zIndex: 2, background: bgD, padding: '3px 8px', fontSize: 10, color: '#4b5563', borderBottom: bd, whiteSpace: 'nowrap', maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis' }} title={desc.descripcion}>
                                      {desc.descripcion || '—'}
                                    </td>
                                    <td style={{ position: 'sticky', left: 267, zIndex: 2, background: bgD, borderBottom: bd }} />
                                    <td style={{ position: 'sticky', left: 397, zIndex: 2, background: bgD, borderBottom: bd }} />
                                    <td style={{ position: 'sticky', left: 472, zIndex: 2, background: bgD, padding: '3px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, color: '#374151', borderBottom: bd }}>
                                      {fmtMM(desc.total_ep)}
                                    </td>
                                    <td style={{ position: 'sticky', left: 558, zIndex: 2, background: bgD, padding: '3px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', boxShadow: '3px 0 6px rgba(0,0,0,.04)', borderBottom: bd }}>
                                      {desc.num_eps}
                                    </td>
                                    {timeline.meses.map((m: string, mi: number) => {
                                      const v = desc.eps[mi] ?? 0
                                      return (
                                        <td key={m} style={{ minWidth: 60, padding: '3px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, background: v > 0 ? epCellBg(v, maxEpGlobal) : bgD, borderLeft: m === timeline.mes_actual ? '2px solid #93c5fd' : undefined, borderBottom: bd, color: v > 0 ? '#374151' : '#d1d5db' }} title={v > 0 ? `${desc.descripcion} · ${m}: ${clp(v)}` : undefined}>
                                          {v > 0 ? fmtMM(v) : '—'}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </Fragment>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                  {timeline.contratos.length === 0 && (
                    <tr>
                      <td colSpan={TL_STICKY.length + (timeline?.meses.length ?? 0)}
                        style={{ padding: '20px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
                        Sin contratos con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              No se pudo cargar el timeline.
            </div>
          )}
        </div>

        {/* Gráficos: evolución + distribución + top10 */}
        {porMes.length > 0 && (
          <div className="panel">
            <h2>EP consumido por mes</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porMes} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="periodo" tickFormatter={fmtMes}
                  tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtMM(v)} width={80} />
                <Tooltip
                  formatter={(v: number) => [clp(v), 'EP del Mes']}
                  labelFormatter={l => `Período: ${fmtMes(String(l))}`}
                />
                <Bar dataKey="ep_mes" fill="var(--navy-500)" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 1fr', gap: 16 }}>
          {porTipo.length > 0 && (
            <div className="panel">
              <h2>Por tipo de contrato</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porTipo} dataKey="monto" nameKey="tipo"
                    cx="50%" cy="50%" outerRadius={72} innerRadius={28}
                    label={({ percent }: any) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}>
                    {porTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [clp(v), name]} contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {top10.length > 0 && (
            <div className="panel">
              <h2>Top 10 EP Total</h2>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={top10} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <XAxis type="number" tickFormatter={v => `$${(v / 1e9).toFixed(0)}MM`}
                    tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="codigo_ctt" type="category"
                    tick={makeContractTick(top10Lookup)} width={110}
                    axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => [clp(Number(v)), 'EP Total']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total_ep" fill="var(--navy-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {top10promedio.length > 0 && (
            <div className="panel">
              <h2>Top 10 EP Promedio Mensual</h2>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={top10promedio} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <XAxis type="number" tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`}
                    tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="codigo_ctt" type="category"
                    tick={makeContractTick(top10Lookup)} width={110}
                    axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => [clp(Number(v)), 'Prom. mensual']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ep_promedio" fill="var(--gold-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Tabla plana contrato-proyecto (vista Excel) ──────────────────── */}
        {timeline && (
          <div className="panel" style={{ padding: 0 }}>

            {/* Cabecera */}
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--gray-200)',
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-500)' }}>
                Detalle por Proyecto — vista Excel
              </span>
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>
                una fila por combinación contrato-proyecto
              </span>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '3px 12px', marginLeft: 'auto' }}
                onClick={exportEP}
              >
                ⬇ Descargar Excel
              </button>
            </div>

            {/* Tabla plana sin expand — orientada a Excel */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                <thead>
                  <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                    <th style={{ padding: '7px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Contrato</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', minWidth: 160 }}>Proveedor</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', minWidth: 180 }}>Proyecto</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', minWidth: 180 }}>Descripción contrato</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Área</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>Total EP</th>
                    <th style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>N° EPs</th>
                    {timeline.meses.map((m: string) => (
                      <th key={m} style={{
                        padding: '7px 4px', textAlign: 'center', minWidth: 58, whiteSpace: 'nowrap',
                        background: m === timeline.mes_actual ? '#1e40af' : undefined,
                      }}>
                        {fmtMes(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.contratos.flatMap((ctt: any, ci: number) => {
                    const proyectos: any[] = ctt.proyectos ?? []
                    const rowsBg = ci % 2 === 0 ? '#fff' : '#f9fafb'
                    const bd = '1px solid #e5e7eb'

                    // Sin proyectos: una fila con proyecto vacío
                    if (proyectos.length === 0) {
                      return [(
                        <tr key={ctt.codigo_ctt} style={{ background: rowsBg }}>
                          <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, borderBottom: bd, whiteSpace: 'nowrap' }}>{ctt.codigo_ctt}</td>
                          <td style={{ padding: '5px 8px', fontSize: 10, color: '#374151', borderBottom: bd, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={ctt.proveedor}>{ctt.proveedor || '—'}</td>
                          <td style={{ padding: '5px 8px', fontSize: 10, color: '#9aa1b3', borderBottom: bd }}>—</td>
                          <td style={{ padding: '5px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: bd }} title={ctt.descripcion}>{ctt.descripcion}</td>
                          <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', borderBottom: bd, whiteSpace: 'nowrap' }}>{ctt.area}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, borderBottom: bd, whiteSpace: 'nowrap' }}>{fmtMM(ctt.total_ep)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', borderBottom: bd }}>{ctt.num_eps}</td>
                          {timeline.meses.map((m: string, mi: number) => {
                            const v = ctt.eps[mi] ?? 0
                            return (
                              <td key={m} style={{ padding: '5px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, background: v > 0 ? epCellBg(v, maxEpGlobal) : rowsBg, borderLeft: m === timeline.mes_actual ? '2px solid #93c5fd' : undefined, borderBottom: bd, color: v > 0 ? 'var(--navy-500)' : '#d1d5db' }} title={v > 0 ? clp(v) : undefined}>
                                {v > 0 ? fmtMM(v) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      )]
                    }

                    // Con proyectos: una fila por proyecto
                    return proyectos.map((pr: any, pi: number) => (
                      <tr key={`${ctt.codigo_ctt}__${pi}`} style={{ background: rowsBg }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, borderBottom: bd, whiteSpace: 'nowrap', color: pi === 0 ? '#1e3a5f' : '#6b7280' }}>{ctt.codigo_ctt}</td>
                        <td style={{ padding: '5px 8px', fontSize: 10, color: '#374151', borderBottom: bd, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={ctt.proveedor}>{pi === 0 ? (ctt.proveedor || '—') : ''}</td>
                        <td style={{ padding: '5px 8px', fontSize: 10, color: '#374151', fontWeight: 500, borderBottom: bd, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={pr.proyecto}>{pr.proyecto || '—'}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: bd, color: '#9aa1b3', fontSize: 10 }} title={ctt.descripcion}>{pi === 0 ? ctt.descripcion : ''}</td>
                        <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', borderBottom: bd, whiteSpace: 'nowrap' }}>{pi === 0 ? ctt.area : ''}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, borderBottom: bd, whiteSpace: 'nowrap', color: '#1e40af' }}>{fmtMM(pr.total_ep)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', borderBottom: bd }}>{pr.num_eps}</td>
                        {timeline.meses.map((m: string, mi: number) => {
                          const v = pr.eps[mi] ?? 0
                          return (
                            <td key={m} style={{ padding: '5px 5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10, background: v > 0 ? epCellBg(v, maxEpGlobal) : rowsBg, borderLeft: m === timeline.mes_actual ? '2px solid #93c5fd' : undefined, borderBottom: bd, color: v > 0 ? '#1e40af' : '#d1d5db' }} title={v > 0 ? `${pr.proyecto} · ${m}: ${clp(v)}` : undefined}>
                              {v > 0 ? fmtMM(v) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
