import React, { Fragment, useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getLicitProcesos, getLicitProcesoDetalle, getLicitAllSubelementos } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

// ── Colores ───────────────────────────────────────────────────────────────────

const AVANCE_COLOR: Record<string, string> = {
  'A TIEMPO':   '#16a34a',
  'RIESGO':     '#d97706',
  'ATRASADO':   '#dc2626',
  'PROGRAMADO': '#2563eb',
}
const AVANCE_BG: Record<string, string> = {
  'A TIEMPO':   '#dcfce7',
  'RIESGO':     '#fef3c7',
  'ATRASADO':   '#fee2e2',
  'PROGRAMADO': '#dbeafe',
}
const ETAPA_PALETTE      = ['#2563eb','#0891b2','#7c3aed','#db2777','#059669','#d97706','#9ca3af','#1e3a8a','#065f46']
const SUB_ESTADO_PALETTE = ['#0891b2','#7c3aed','#f59e0b','#10b981','#ef4444','#6366f1','#f97316','#14b8a6']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(s: string | null | undefined) { return s ? s.slice(0, 10) : '—' }

type SortDir   = 'asc' | 'desc'
type SortState = { field: string; dir: SortDir }

function SortTh({ label, field, sort, onSort, align = 'left', style }: {
  label: string; field: string; sort: SortState; onSort: (f: string) => void
  align?: 'left' | 'right' | 'center'; style?: React.CSSProperties
}) {
  const active = sort.field === field
  return (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer', userSelect: 'none', textAlign: align, padding: '7px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', background: '#f9fafb', color: active ? 'var(--navy-500)' : '#6b7280', ...style }}>
      {label}
      <span style={{ marginLeft: 3, opacity: active ? 1 : 0.35, fontSize: 9 }}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </th>
  )
}

function useSorted<T>(data: T[], sort: SortState): T[] {
  return useMemo(() => {
    if (!sort.field) return data
    return [...data].sort((a: any, b: any) => {
      const av = a[sort.field] ?? '', bv = b[sort.field] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sort.field, sort.dir])
}

function BrechaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined) return <span style={{ color: '#9aa1b3', fontSize: 10 }}>—</span>
  const color = delta > 0 ? '#dc2626' : delta < 0 ? '#16a34a' : '#9aa1b3'
  return <span style={{ fontSize: 10, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{delta > 0 ? '+' : ''}{delta}d</span>
}

// ── Mini stat card ────────────────────────────────────────────────────────────

function MiniStat({ value, label, color, sub }: { value: string; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${color ?? '#e5e7eb'}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? '#374151', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: '#b0b7c3', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub}>{sub}</div>}
    </div>
  )
}

// ── Detalle expandible por proceso ────────────────────────────────────────────

function DetalleRow({ proceso }: { proceso: string }) {
  const [items,   setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLicitProcesoDetalle(proceso).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [proceso])

  if (loading) return <tr><td colSpan={14} style={{ padding: '8px 16px', background: '#f8fafc', color: '#9aa1b3', fontSize: 11 }}>Cargando...</td></tr>
  if (!items.length) return <tr><td colSpan={14} style={{ padding: '8px 16px', background: '#f8fafc', color: '#9aa1b3', fontSize: 11 }}>Sin detalle disponible</td></tr>

  return (
    <tr>
      <td colSpan={14} style={{ padding: 0, background: '#f8fafc' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e0e7ef' }}>
                {['Subelemento','Estado','Avance','Área','Ini Prog.','Fin Prog.','Ini Real','Fin Real','Ciclo Prog.','Ciclo Real','Brecha Sub'].map(h => (
                  <th key={h} style={{ padding: '4px 10px', textAlign: ['Ini Prog.','Fin Prog.','Ini Real','Fin Real','Ciclo Prog.','Ciclo Real','Brecha Sub'].includes(h) ? 'right' : 'left', whiteSpace: 'nowrap', color: '#4b5563' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '3px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.Subelemento}>{d.Subelemento || '—'}</td>
                  <td style={{ padding: '3px 10px' }}>
                    {d['Estado_Inicio-Fin'] ? (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: d['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#dcfce7' : '#fef9c3', color: d['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#15803d' : '#854d0e' }}>{d['Estado_Inicio-Fin']}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '3px 10px', color: '#6b7280' }}>{d['Avance Etapas'] || '—'}</td>
                  <td style={{ padding: '3px 10px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d['Área Responsable'] || '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fecha Inicio Acta inicio'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fecha Fin Acta Inicio'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Inicio real'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fin real'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#9aa1b3' }}>{d['Ciclo programado'] ?? '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{d['Ciclo real'] ?? '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right' }}><BrechaBadge delta={d['delta_sub'] ?? null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

// ── Donut pequeño ─────────────────────────────────────────────────────────────

const RADIAN = Math.PI / 180
function SmallLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if ((percent ?? 0) < 0.07) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>{`${((percent ?? 0) * 100).toFixed(0)}%`}</text>
}

function MiniDonut({ data, colorMap, height = 180, onSelect, selected }: {
  data: { name: string; value: number }[]
  colorMap?: Record<string, string>
  height?: number
  onSelect?: (name: string | null) => void
  selected?: string | null
}) {
  const palette = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#059669','#9ca3af']
  const handleClick = (entry: any) => {
    if (onSelect) onSelect(selected === entry.name ? null : entry.name)
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          outerRadius={height * 0.32} innerRadius={height * 0.15}
          labelLine={false} label={SmallLabel}
          onClick={handleClick} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
          {data.map((e, i) => (
            <Cell key={i}
              fill={colorMap?.[e.name] ?? palette[i % palette.length]}
              opacity={selected && selected !== e.name ? 0.3 : 1}
            />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v: any, n: any) => [v, n]} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10, lineHeight: '18px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Panel drill-down ──────────────────────────────────────────────────────────

function DrillPanel({ title, count, accentColor, onClose, extra, children }: {
  title: string; count: number; accentColor?: string; onClose: () => void
  extra?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div className="bg-white rounded-xl shadow-sm" style={{ borderTop: `3px solid ${accentColor ?? '#2563eb'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', borderRadius: '10px 10px 0 0' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: accentColor ?? '#374151' }}>{title}</span>
          <span style={{ fontSize: 11, color: '#9aa1b3' }}>{count} registros</span>
          {extra}
          <button onClick={onClose} style={{ marginLeft: 'auto', fontSize: 11, color: '#9aa1b3', background: 'none', border: '1px solid #e5e7eb', cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}>✕</button>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Constantes ────────────────────────────────────────────────────────────────

const AVANCE_OPTS    = ['A TIEMPO', 'RIESGO', 'ATRASADO', 'PROGRAMADO'] as const
const ALERTA_NIVELES = new Set(['ATRASADO', 'RIESGO'])

// ── Componente principal ──────────────────────────────────────────────────────

export default function Licitaciones() {
  const [procesos, setProcesos] = useState<any[]>([])
  const [subs,     setSubs]     = useState<any[]>([])

  // Filtros de página
  const [fAvance,       setFAvance]       = useState('')
  const [fTipo,         setFTipo]         = useState('')
  const [fIniProgDesde, setFIniProgDesde] = useState('')
  const [fIniProgHasta, setFIniProgHasta] = useState('')
  const [fFinProgDesde, setFFinProgDesde] = useState('')
  const [fFinProgHasta, setFFinProgHasta] = useState('')
  const [fIniRealDesde, setFIniRealDesde] = useState('')
  const [fIniRealHasta, setFIniRealHasta] = useState('')
  const [fFinRealDesde, setFFinRealDesde] = useState('')
  const [fFinRealHasta, setFFinRealHasta] = useState('')
  const [showFechas,    setShowFechas]    = useState(false)

  // Tabla procesos
  const [pBuscar,  setPBuscar]  = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [procSort, setProcSort] = useState<SortState>({ field: '', dir: 'asc' })

  // Paneles colapsables
  const [showProcesos, setShowProcesos] = useState(false)
  const [showAlertas,  setShowAlertas]  = useState(true)
  const [showTopDelta, setShowTopDelta] = useState(true)
  const [showSubDelta, setShowSubDelta] = useState(false)

  // Sorts secundarios
  const [alertaSort, setAlertaSort] = useState<SortState>({ field: 'delta_dias', dir: 'desc' })
  const [subSort,    setSubSort]    = useState<SortState>({ field: 'delta_sub',  dir: 'desc' })

  // Slices seleccionados en donuts
  const [avanceSlice,      setAvanceSlice]      = useState<string | null>(null)
  const [avanceShowProg,   setAvanceShowProg]   = useState(false)
  const [showAvanceRegla,  setShowAvanceRegla]  = useState(false)
  const [etapaSlice,       setEtapaSlice]       = useState<string | null>(null)
  const [etapaShowFin,     setEtapaShowFin]     = useState(false)
  const [subEstadoSlice,   setSubEstadoSlice]   = useState<string | null>(null)
  const [subEstadoShowFin, setSubEstadoShowFin] = useState(false)

  useEffect(() => {
    getLicitProcesos().then(setProcesos).catch(() => {})
    getLicitAllSubelementos().then(setSubs).catch(() => {})
  }, [])

  // ── Filtrado principal ────────────────────────────────────────────────────
  const procesosFiltrados = useMemo(() => procesos.filter(p => {
    if (fAvance && p['Avance Gral Proceso'] !== fAvance) return false
    if (fTipo   && p['Tipo Servicio']       !== fTipo)   return false
    const ip = p['Fecha inicio programado'] ?? ''
    const fp = p['Fecha fin programado']    ?? ''
    const ir = p['Fecha inicio real']       ?? ''
    const fr = p['Fecha fin real']          ?? ''
    if (fIniProgDesde && ip && ip < fIniProgDesde) return false
    if (fIniProgHasta && ip && ip > fIniProgHasta) return false
    if (fFinProgDesde && fp && fp < fFinProgDesde) return false
    if (fFinProgHasta && fp && fp > fFinProgHasta) return false
    if (fIniRealDesde && ir && ir < fIniRealDesde) return false
    if (fIniRealHasta && ir && ir > fIniRealHasta) return false
    if (fFinRealDesde && fr && fr < fFinRealDesde) return false
    if (fFinRealHasta && fr && fr > fFinRealHasta) return false
    return true
  }), [procesos, fAvance, fTipo, fIniProgDesde, fIniProgHasta, fFinProgDesde, fFinProgHasta, fIniRealDesde, fIniRealHasta, fFinRealDesde, fFinRealHasta])

  const tipoOpts = useMemo(() =>
    [...new Set(procesos.map(p => p['Tipo Servicio']).filter(Boolean))].sort() as string[]
  , [procesos])

  const filteredIds   = useMemo(() => new Set(procesosFiltrados.map(p => p['N°PROCESO'])), [procesosFiltrados])
  const subsFiltrados = useMemo(() => subs.filter(s => filteredIds.has(s['N°PROCESO'])), [subs, filteredIds])

  // ── KPIs locales ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const f = procesosFiltrados
    return {
      total:      f.length,
      a_tiempo:   f.filter(p => p['Avance Gral Proceso'] === 'A TIEMPO').length,
      riesgo:     f.filter(p => p['Avance Gral Proceso'] === 'RIESGO').length,
      atrasado:   f.filter(p => p['Avance Gral Proceso'] === 'ATRASADO').length,
      programado: f.filter(p => p['Avance Gral Proceso'] === 'PROGRAMADO').length,
      finalizado: f.filter(p => p['Etapa Actual'] === 'Finalizado').length,
    }
  }, [procesosFiltrados])

  // ── Donuts ────────────────────────────────────────────────────────────────
  const avanceDonut = useMemo(() =>
    AVANCE_OPTS
      .filter(v => avanceShowProg || v !== 'PROGRAMADO')
      .map(v => ({ name: v, value: procesosFiltrados.filter(p => p['Avance Gral Proceso'] === v).length }))
      .filter(d => d.value > 0)
  , [procesosFiltrados, avanceShowProg])

  const etapaDonut = useMemo(() => {
    const base = etapaShowFin
      ? procesosFiltrados
      : procesosFiltrados.filter(p => p['Etapa Actual'] !== 'Finalizado')
    const c: Record<string, number> = {}
    base.forEach(p => { const e = p['Etapa Actual'] || 'Sin etapa'; c[e] = (c[e] ?? 0) + 1 })
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [procesosFiltrados, etapaShowFin])

  const subEstadoDonut = useMemo(() => {
    const base = subEstadoShowFin
      ? subsFiltrados
      : subsFiltrados.filter(s => s['Estado_Inicio-Fin'] !== 'FINALIZADO')
    const c: Record<string, number> = {}
    base.forEach(s => { const e = s['Estado_Inicio-Fin'] || 'Sin estado'; c[e] = (c[e] ?? 0) + 1 })
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [subsFiltrados, subEstadoShowFin])

  const etapaColorMap = useMemo(() =>
    Object.fromEntries(etapaDonut.map((d, i) => [d.name, ETAPA_PALETTE[i % ETAPA_PALETTE.length]]))
  , [etapaDonut])

  const subEstadoColorMap = useMemo(() =>
    Object.fromEntries(subEstadoDonut.map((d, i) => [d.name, SUB_ESTADO_PALETTE[i % SUB_ESTADO_PALETTE.length]]))
  , [subEstadoDonut])

  // ── Estadísticas de brecha ────────────────────────────────────────────────
  const brechaStats = useMemo(() => {
    const con = procesosFiltrados.filter(p => p['delta_dias'] !== null && p['delta_dias'] !== undefined)
    if (!con.length) return null
    const vals     = con.map(p => p['delta_dias'] as number)
    const avg      = Math.round(vals.reduce((s, d) => s + d, 0) / vals.length)
    const max      = Math.max(...vals)
    const min      = Math.min(...vals)
    const nDelayed = vals.filter(d => d > 0).length
    const maxProc  = con.find(p => p['delta_dias'] === max)
    return { n: con.length, avg, max, min, nDelayed, pctDelayed: Math.round(nDelayed / con.length * 100), maxProc: maxProc?.['N°PROCESO'] ?? '' }
  }, [procesosFiltrados])

  // ── Top 10 brecha ─────────────────────────────────────────────────────────
  const top10Delta = useMemo(() =>
    [...procesosFiltrados].filter(p => p['delta_dias'] != null).sort((a, b) => b['delta_dias'] - a['delta_dias']).slice(0, 10)
  , [procesosFiltrados])

  // ── Alertas ───────────────────────────────────────────────────────────────
  const alertas = useMemo(() =>
    procesosFiltrados.filter(p => ALERTA_NIVELES.has(p['Avance Gral Proceso']))
  , [procesosFiltrados])

  // ── Ranking subelementos brecha ───────────────────────────────────────────
  const subBrechaRanking = useMemo(() =>
    [...subsFiltrados].filter(s => s['delta_sub'] != null).sort((a, b) => b['delta_sub'] - a['delta_sub']).slice(0, 30)
  , [subsFiltrados])

  // ── Drill-down data ───────────────────────────────────────────────────────
  const avanceSliceProcs = useMemo(() =>
    avanceSlice ? procesosFiltrados.filter(p => p['Avance Gral Proceso'] === avanceSlice) : []
  , [avanceSlice, procesosFiltrados])

  const etapaSliceProcs = useMemo(() =>
    etapaSlice ? procesosFiltrados.filter(p => (p['Etapa Actual'] || 'Sin etapa') === etapaSlice) : []
  , [etapaSlice, procesosFiltrados])

  // Drill-down subEstado: solo los subelementos del segmento clickeado
  const subEstadoDisplay = useMemo(() =>
    subEstadoSlice ? subsFiltrados.filter(s => (s['Estado_Inicio-Fin'] || 'Sin estado') === subEstadoSlice) : []
  , [subEstadoSlice, subsFiltrados])

  // ── Tabla con búsqueda ────────────────────────────────────────────────────
  const procesosBusqueda = useMemo(() =>
    procesosFiltrados.filter(p => !pBuscar || (p['N°PROCESO'] + ' ' + p['Proceso']).toLowerCase().includes(pBuscar.toLowerCase()))
  , [procesosFiltrados, pBuscar])

  const sortedProcesos  = useSorted(procesosBusqueda,  procSort)
  const sortedAlertas   = useSorted(alertas,           alertaSort)
  const sortedSubBrecha = useSorted(subBrechaRanking,  subSort)

  const handleProcSort  = (f: string) => setProcSort(s  => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))
  const handleAlertSort = (f: string) => setAlertaSort(s => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))
  const handleSubSort   = (f: string) => setSubSort(s    => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))

  const hayFechas  = [fIniProgDesde, fIniProgHasta, fFinProgDesde, fFinProgHasta, fIniRealDesde, fIniRealHasta, fFinRealDesde, fFinRealHasta].some(v => v)
  const hayFiltros = fAvance || fTipo || hayFechas

  function clearAll() {
    setFAvance(''); setFTipo('')
    setFIniProgDesde(''); setFIniProgHasta(''); setFFinProgDesde(''); setFFinProgHasta('')
    setFIniRealDesde(''); setFIniRealHasta(''); setFFinRealDesde(''); setFFinRealHasta('')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Licitaciones" subtitle="Seguimiento de procesos de licitación" icon="📋" />

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '4px 16px 10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {(['', ...AVANCE_OPTS] as const).map(v => (
            <button key={v || 'todos'} onClick={() => setFAvance(v)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', fontWeight: 600,
              background: fAvance === v ? (v ? AVANCE_COLOR[v] : 'var(--navy-500)') : '#e5e7eb',
              color: fAvance === v ? '#fff' : '#6b7280',
            }}>{v || 'Todos'}</button>
          ))}
          <select value={fTipo} onChange={e => setFTipo(e.target.value)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: fTipo ? 'var(--navy-500)' : '#fff', color: fTipo ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
            <option value="">Tipo Servicio (todos)</option>
            {tipoOpts.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => setShowFechas(v => !v)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: hayFechas ? 'var(--navy-500)' : '#fff', color: hayFechas ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
            📅 Fechas{hayFechas ? ' ✓' : ''} {showFechas ? '▲' : '▼'}
          </button>
          {hayFiltros && (
            <button onClick={clearAll} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>✕ Limpiar</button>
          )}
          {hayFiltros && <span style={{ fontSize: 11, color: '#6b7280' }}>{procesosFiltrados.length} / {procesos.length} procesos</span>}
        </div>
        {showFechas && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            {([
              ['Ini. Prog.', fIniProgDesde, setFIniProgDesde, fIniProgHasta, setFIniProgHasta],
              ['Fin Prog.',  fFinProgDesde, setFFinProgDesde, fFinProgHasta, setFFinProgHasta],
              ['Ini. Real',  fIniRealDesde, setFIniRealDesde, fIniRealHasta, setFIniRealHasta],
              ['Fin Real',   fFinRealDesde, setFFinRealDesde, fFinRealHasta, setFFinRealHasta],
            ] as const).map(([label, desde, setDesde, hasta, setHasta]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 58 }}>{label}</span>
                <input type="date" value={desde} onChange={e => (setDesde as any)(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>–</span>
                <input type="date" value={hasta} onChange={e => (setHasta as any)(e.target.value)} style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── KPIs + Donut Avance ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, padding: '0 16px 4px', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <KpiCard label="Total Procesos" value={kpis.total}      color="blue"   />
          <KpiCard label="A Tiempo"       value={kpis.a_tiempo}   color="green"  />
          <KpiCard label="En Riesgo"      value={kpis.riesgo}     color="yellow" />
          <KpiCard label="Atrasados"      value={kpis.atrasado}   color="red"    />
          <KpiCard label="Programados"    value={kpis.programado} color="blue"   />
          <KpiCard label="Finalizados"    value={kpis.finalizado} color="green"  />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avance {avanceSlice && <span style={{ color: AVANCE_COLOR[avanceSlice], fontWeight: 800 }}>· {avanceSlice}</span>}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => { setAvanceShowProg(v => !v); setAvanceSlice(null) }} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                border: '1px solid', borderColor: avanceShowProg ? '#a5b4fc' : '#e5e7eb',
                background: avanceShowProg ? '#ede9fe' : '#f3f4f6',
                color: avanceShowProg ? '#5b21b6' : '#9ca3af',
              }}>
                {avanceShowProg ? '✓ c/ prog.' : 'sin prog.'}
              </button>
              <button onClick={() => setShowAvanceRegla(v => !v)} title="Regla de clasificación" style={{
                fontSize: 10, width: 18, height: 18, borderRadius: '50%', cursor: 'pointer', fontWeight: 700,
                border: '1px solid', borderColor: showAvanceRegla ? '#6366f1' : '#e5e7eb',
                background: showAvanceRegla ? '#e0e7ff' : '#f3f4f6',
                color: showAvanceRegla ? '#4338ca' : '#9ca3af',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>?</button>
            </div>
          </div>
          <MiniDonut data={avanceDonut} colorMap={AVANCE_COLOR} height={160}
            onSelect={setAvanceSlice} selected={avanceSlice} />
        </div>
      </div>

      {/* Regla de clasificación avance */}
      {showAvanceRegla && (
        <div style={{ padding: '0 16px 12px' }}>
          <div className="bg-white rounded-xl shadow-sm p-4" style={{ borderTop: '3px solid #6366f1' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Criterio de clasificación — Avance General</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {([
                ['A TIEMPO',   '#16a34a', '#dcfce7', 'El proceso avanza dentro del cronograma programado, sin brecha o con adelanto.'],
                ['RIESGO',     '#d97706', '#fef3c7', 'Presenta retraso, pero dentro del umbral considerado recuperable.'],
                ['ATRASADO',   '#dc2626', '#fee2e2', 'El retraso supera el umbral crítico; requiere intervención.'],
                ['PROGRAMADO', '#2563eb', '#dbeafe', 'Aún no tiene fechas reales registradas; pendiente de inicio.'],
              ] as [string, string, string, string][]).map(([label, color, bg, desc]) => (
                <div key={label} style={{ background: bg, borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid ${color}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 8 }}>
              Clasificación gestionada en Monday.com según avance programado vs. real del proceso.
            </div>
          </div>
        </div>
      )}

      {/* Drill-down avance */}
      {avanceSlice && (
        <DrillPanel title={avanceSlice} count={avanceSliceProcs.length}
          accentColor={AVANCE_COLOR[avanceSlice]} onClose={() => setAvanceSlice(null)}>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0 }}>
                {['N°PROCESO','Nombre','Tipo','Etapa','Fin Prog.','Fin Real','Brecha'].map((h, i) => (
                  <th key={h} style={{ padding: '5px 8px', fontWeight: 700, color: '#6b7280', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {avanceSliceProcs.map((p: any, i: number) => (
                <tr key={p['N°PROCESO']} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 9, color: 'var(--navy-500)', whiteSpace: 'nowrap' }}>{p['N°PROCESO']}</td>
                  <td style={{ padding: '4px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['Proceso']}>{p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}</td>
                  <td style={{ padding: '4px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Tipo Servicio'] || '—'}</td>
                  <td style={{ padding: '4px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Etapa Actual'] || '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin programado'])}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin real'])}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}><BrechaBadge delta={p['delta_dias']} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DrillPanel>
      )}

      {/* ── Donuts Etapa + SubEstado + Estadísticas Brecha ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '12px 16px 4px' }}>
        {/* Etapa Actual */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Etapa Actual {etapaSlice && <span style={{ color: etapaColorMap[etapaSlice], fontWeight: 800 }}>· {etapaSlice}</span>}
            </div>
            <button onClick={() => { setEtapaShowFin(v => !v); setEtapaSlice(null) }} style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              border: '1px solid', borderColor: etapaShowFin ? '#a5b4fc' : '#e5e7eb',
              background: etapaShowFin ? '#ede9fe' : '#f3f4f6',
              color: etapaShowFin ? '#5b21b6' : '#9ca3af',
            }}>
              {etapaShowFin ? '✓ c/ finalizados' : 'sin finalizados'}
            </button>
          </div>
          <MiniDonut data={etapaDonut} colorMap={etapaColorMap} height={200}
            onSelect={setEtapaSlice} selected={etapaSlice} />
        </div>

        {/* Estado Subelementos */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estado Subelementos {subEstadoSlice && <span style={{ color: subEstadoColorMap[subEstadoSlice], fontWeight: 800 }}>· {subEstadoSlice}</span>}
            </div>
            <button onClick={() => { setSubEstadoShowFin(v => !v); setSubEstadoSlice(null) }} style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              border: '1px solid', borderColor: subEstadoShowFin ? '#a5b4fc' : '#e5e7eb',
              background: subEstadoShowFin ? '#ede9fe' : '#f3f4f6',
              color: subEstadoShowFin ? '#5b21b6' : '#9ca3af',
            }}>
              {subEstadoShowFin ? '✓ c/ finalizados' : 'sin finalizados'}
            </button>
          </div>
          <MiniDonut data={subEstadoDonut} colorMap={subEstadoColorMap} height={200}
            onSelect={setSubEstadoSlice} selected={subEstadoSlice} />
        </div>

        {/* Estadísticas de Brecha */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Estadísticas de Brecha</div>
          {brechaStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
                <MiniStat
                  value={`${brechaStats.avg > 0 ? '+' : ''}${brechaStats.avg}d`}
                  label="Brecha promedio"
                  color={brechaStats.avg > 0 ? '#dc2626' : '#16a34a'}
                />
                <MiniStat
                  value={`+${brechaStats.max}d`}
                  label="Mayor atraso"
                  color="#dc2626"
                  sub={brechaStats.maxProc}
                />
                <MiniStat
                  value={`${brechaStats.min}d`}
                  label="Menor brecha"
                  color={brechaStats.min < 0 ? '#16a34a' : '#6b7280'}
                />
                <MiniStat
                  value={`${brechaStats.pctDelayed}%`}
                  label="Con atraso"
                  color={brechaStats.pctDelayed > 50 ? '#dc2626' : '#d97706'}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>Procesos con brecha positiva</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: brechaStats.pctDelayed > 50 ? '#dc2626' : '#d97706' }}>
                    {brechaStats.nDelayed} / {brechaStats.n}
                  </span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${brechaStats.pctDelayed}%`, background: brechaStats.pctDelayed > 50 ? '#dc2626' : '#d97706', borderRadius: 4, height: 7 }} />
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#9aa1b3', fontSize: 12, textAlign: 'center', marginTop: 40 }}>Sin datos de brecha</div>
          )}
        </div>
      </div>

      {/* Drill-down etapa */}
      {etapaSlice && (
        <DrillPanel title={`Etapa: ${etapaSlice}`} count={etapaSliceProcs.length}
          accentColor={etapaColorMap[etapaSlice]} onClose={() => setEtapaSlice(null)}>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0 }}>
                {['N°PROCESO','Nombre','Tipo','Avance','Fin Prog.','Fin Real','Brecha'].map((h, i) => (
                  <th key={h} style={{ padding: '5px 8px', fontWeight: 700, color: '#6b7280', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etapaSliceProcs.map((p: any, i: number) => {
                const av = p['Avance Gral Proceso']
                return (
                  <tr key={p['N°PROCESO']} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 9, color: 'var(--navy-500)', whiteSpace: 'nowrap' }}>{p['N°PROCESO']}</td>
                    <td style={{ padding: '4px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['Proceso']}>{p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}</td>
                    <td style={{ padding: '4px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Tipo Servicio'] || '—'}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: AVANCE_BG[av] ?? '#f3f4f6', color: AVANCE_COLOR[av] ?? '#6b7280' }}>{av || '—'}</span>
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin programado'])}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin real'])}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}><BrechaBadge delta={p['delta_dias']} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DrillPanel>
      )}

      {/* Drill-down subEstado */}
      {subEstadoSlice && (
        <DrillPanel
          title={`Estado subelementos: ${subEstadoSlice}`}
          count={subEstadoDisplay.length}
          accentColor={subEstadoColorMap[subEstadoSlice]}
          onClose={() => setSubEstadoSlice(null)}
        >
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0 }}>
                {['Subelemento','N°PROCESO','Estado','Ini Prog.','Fin Prog.','Ini Real','Fin Real','Ciclo Prog.','Ciclo Real','Brecha Sub'].map(h => (
                  <th key={h} style={{ padding: '5px 8px', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap',
                    textAlign: ['Ini Prog.','Fin Prog.','Ini Real','Fin Real','Ciclo Prog.','Ciclo Real','Brecha Sub'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subEstadoDisplay.map((s: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '4px 8px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.Subelemento}>{s.Subelemento || '—'}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 9, color: 'var(--navy-500)', whiteSpace: 'nowrap' }}>{s['N°PROCESO']}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {s['Estado_Inicio-Fin'] ? (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                        background: (subEstadoColorMap[s['Estado_Inicio-Fin']] ?? '#9ca3af') + '22',
                        color:       subEstadoColorMap[s['Estado_Inicio-Fin']] ?? '#9ca3af' }}>
                        {s['Estado_Inicio-Fin']}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(s['Fecha Inicio Prog'])}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(s['Fecha Fin Prog'])}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(s['Fecha Inicio Real'])}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(s['Fecha Fin Real'])}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', color: '#9aa1b3', fontVariantNumeric: 'tabular-nums' }}>{s['Ciclo programado'] ?? '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s['Ciclo real'] ?? '—'}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}><BrechaBadge delta={s['delta_sub']} /></td>
                </tr>
              ))}
              {subEstadoDisplay.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 11 }}>
                  {subEstadoShowFin ? 'Sin subelementos' : 'No hay subelementos activos — activa "Incluir finalizados" para verlos'}
                </td></tr>
              )}
            </tbody>
          </table>
        </DrillPanel>
      )}

      {/* ── Top 10 Mayor Brecha ───────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowTopDelta(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: showTopDelta ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Top 10 Procesos con Mayor Brecha</span>
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showTopDelta ? '▲' : '▼'}</span>
          </button>
          {showTopDelta && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#6b7280', textAlign: 'left' }}>#</th>
                    <SortTh label="N° Proceso" field="N°PROCESO"           sort={{ field: '', dir: 'asc' }} onSort={() => {}} />
                    <SortTh label="Nombre"      field="Proceso"             sort={{ field: '', dir: 'asc' }} onSort={() => {}} />
                    <SortTh label="Tipo"        field="Tipo Servicio"       sort={{ field: '', dir: 'asc' }} onSort={() => {}} />
                    <SortTh label="Avance"      field="Avance Gral Proceso" sort={{ field: '', dir: 'asc' }} onSort={() => {}} align="center" />
                    <SortTh label="Etapa"       field="Etapa Actual"        sort={{ field: '', dir: 'asc' }} onSort={() => {}} />
                    <SortTh label="Ciclo Est."  field="Ciclo estimado"      sort={{ field: '', dir: 'asc' }} onSort={() => {}} align="right" />
                    <SortTh label="Ciclo Real"  field="Ciclo real"          sort={{ field: '', dir: 'asc' }} onSort={() => {}} align="right" />
                    <SortTh label="Brecha"      field="delta_dias"          sort={{ field: '', dir: 'asc' }} onSort={() => {}} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {top10Delta.map((p: any, i: number) => {
                    const av = p['Avance Gral Proceso']
                    return (
                      <tr key={p['N°PROCESO']} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>{i + 1}</td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, color: 'var(--navy-500)', whiteSpace: 'nowrap' }}>{p['N°PROCESO']}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['Proceso']}>{p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}</td>
                        <td style={{ padding: '5px 8px', color: '#6b7280', fontSize: 10 }}>{p['Tipo Servicio'] || '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: AVANCE_BG[av] ?? '#f3f4f6', color: AVANCE_COLOR[av] ?? '#6b7280' }}>{av || '—'}</span>
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Etapa Actual'] || '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', fontVariantNumeric: 'tabular-nums' }}>{p['Ciclo estimado'] ?? '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>{p['Ciclo real'] ?? '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}><BrechaBadge delta={p['delta_dias']} /></td>
                      </tr>
                    )
                  })}
                  {top10Delta.length === 0 && <tr><td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Procesos en Alerta ────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowAlertas(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: showAlertas ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Procesos en Alerta</span>
            {kpis.atrasado > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>{kpis.atrasado} atrasados</span>}
            {kpis.riesgo   > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{kpis.riesgo} en riesgo</span>}
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showAlertas ? '▲' : '▼'}</span>
          </button>
          {showAlertas && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <SortTh label="N° Proceso" field="N°PROCESO"            sort={alertaSort} onSort={handleAlertSort} />
                    <SortTh label="Nombre"      field="Proceso"              sort={alertaSort} onSort={handleAlertSort} />
                    <SortTh label="Tipo"        field="Tipo Servicio"        sort={alertaSort} onSort={handleAlertSort} />
                    <SortTh label="Avance"      field="Avance Gral Proceso"  sort={alertaSort} onSort={handleAlertSort} align="center" />
                    <SortTh label="Etapa"       field="Etapa Actual"         sort={alertaSort} onSort={handleAlertSort} />
                    <SortTh label="Fin Prog."   field="Fecha fin programado" sort={alertaSort} onSort={handleAlertSort} align="right" />
                    <SortTh label="Fin Real"    field="Fecha fin real"       sort={alertaSort} onSort={handleAlertSort} align="right" />
                    <SortTh label="Ciclo Est."  field="Ciclo estimado"       sort={alertaSort} onSort={handleAlertSort} align="right" />
                    <SortTh label="Ciclo Real"  field="Ciclo real"           sort={alertaSort} onSort={handleAlertSort} align="right" />
                    <SortTh label="Brecha"      field="delta_dias"           sort={alertaSort} onSort={handleAlertSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedAlertas.map((p: any, i: number) => {
                    const av = p['Avance Gral Proceso']
                    return (
                      <tr key={p['N°PROCESO']} style={{ borderTop: '1px solid #f0f0f0', background: av === 'ATRASADO' ? '#fff8f8' : i % 2 === 1 ? '#fffbeb' : '#fff' }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, color: 'var(--navy-500)', whiteSpace: 'nowrap' }}>{p['N°PROCESO']}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['Proceso']}>{p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}</td>
                        <td style={{ padding: '5px 8px', color: '#6b7280', fontSize: 10 }}>{p['Tipo Servicio'] || '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: AVANCE_BG[av] ?? '#f3f4f6', color: AVANCE_COLOR[av] ?? '#6b7280' }}>{av}</span>
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Etapa Actual'] || '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin programado'])}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin real'])}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', fontVariantNumeric: 'tabular-nums' }}>{p['Ciclo estimado'] ?? '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>{p['Ciclo real'] ?? '—'}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}><BrechaBadge delta={p['delta_dias']} /></td>
                      </tr>
                    )
                  })}
                  {sortedAlertas.length === 0 && <tr><td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin procesos en alerta con los filtros actuales</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Ranking Subelementos por Brecha ──────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowSubDelta(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: showSubDelta ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Ranking Subelementos por Brecha</span>
            <span style={{ fontSize: 11, color: '#9aa1b3' }}>{subBrechaRanking.length} subelementos con brecha</span>
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showSubDelta ? '▲' : '▼'}</span>
          </button>
          {showSubDelta && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f9fafb' }}>#</th>
                    <SortTh label="Subelemento"  field="Subelemento"       sort={subSort} onSort={handleSubSort} />
                    <SortTh label="N° Proceso"   field="N°PROCESO"         sort={subSort} onSort={handleSubSort} />
                    <SortTh label="Estado"        field="Estado_Inicio-Fin" sort={subSort} onSort={handleSubSort} align="center" />
                    <SortTh label="Área"          field="Área Responsable"  sort={subSort} onSort={handleSubSort} />
                    <SortTh label="Ciclo Prog."   field="Ciclo programado"  sort={subSort} onSort={handleSubSort} align="right" />
                    <SortTh label="Ciclo Real"    field="Ciclo real"        sort={subSort} onSort={handleSubSort} align="right" />
                    <SortTh label="Brecha Sub"    field="delta_sub"         sort={subSort} onSort={handleSubSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedSubBrecha.map((s: any, i: number) => (
                    <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: s['delta_sub'] > 0 && i < 5 ? '#fff8f8' : i % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>{i + 1}</td>
                      <td style={{ padding: '5px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={s.Subelemento}>{s.Subelemento || '—'}</td>
                      <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 10, color: 'var(--navy-500)', whiteSpace: 'nowrap' }}>{s['N°PROCESO']}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        {s['Estado_Inicio-Fin'] ? (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: s['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#dcfce7' : '#fef9c3', color: s['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#15803d' : '#854d0e' }}>{s['Estado_Inicio-Fin']}</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s['Área Responsable'] || '—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#9aa1b3' }}>{s['Ciclo programado'] ?? '—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s['Ciclo real'] ?? '—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}><BrechaBadge delta={s['delta_sub']} /></td>
                    </tr>
                  ))}
                  {sortedSubBrecha.length === 0 && <tr><td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin subelementos con datos de brecha</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detalle Procesos ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowProcesos(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: showProcesos ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Detalle Procesos</span>
            <span style={{ fontSize: 11, color: '#9aa1b3' }}>{procesosBusqueda.length} procesos</span>
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showProcesos ? '▲' : '▼'}</span>
          </button>
          {showProcesos && (
            <>
              <div style={{ padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <input type="text" placeholder="Buscar N° proceso o nombre…" value={pBuscar} onChange={e => setPBuscar(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 4, width: 280 }} />
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <SortTh label="N° Proceso"  field="N°PROCESO"               sort={procSort} onSort={handleProcSort} />
                      <SortTh label="Nombre"       field="Proceso"                 sort={procSort} onSort={handleProcSort} />
                      <SortTh label="Tipo"         field="Tipo Servicio"           sort={procSort} onSort={handleProcSort} />
                      <SortTh label="Avance"       field="Avance Gral Proceso"     sort={procSort} onSort={handleProcSort} align="center" />
                      <SortTh label="Etapa Actual" field="Etapa Actual"            sort={procSort} onSort={handleProcSort} />
                      <SortTh label="Ini. Prog."   field="Fecha inicio programado" sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Ini. Real"    field="Fecha inicio real"       sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Fin Prog."    field="Fecha fin programado"    sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Fin Real"     field="Fecha fin real"          sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Fin Est."     field="fin_estimado"            sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Ciclo Est."   field="Ciclo estimado"          sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Ciclo Real"   field="Ciclo real"              sort={procSort} onSort={handleProcSort} align="right" />
                      <SortTh label="Brecha"       field="delta_dias"              sort={procSort} onSort={handleProcSort} align="right" />
                      <th style={{ padding: '7px 8px', fontSize: 10, color: '#6b7280', fontWeight: 700, background: '#f9fafb', textAlign: 'center' }}>Det.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProcesos.map((p: any, i: number) => {
                      const isOpen = expanded === p['N°PROCESO']
                      const av = p['Avance Gral Proceso']
                      return (
                        <Fragment key={p['N°PROCESO']}>
                          <tr style={{ borderTop: '1px solid #f0f0f0', background: isOpen ? '#f0f9ff' : i % 2 === 1 ? '#fafafa' : '#fff' }}>
                            <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', color: 'var(--navy-500)' }}>{p['N°PROCESO']}</td>
                            <td style={{ padding: '5px 8px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['Proceso']}>{p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}</td>
                            <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Tipo Servicio'] || '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: AVANCE_BG[av] ?? '#f3f4f6', color: AVANCE_COLOR[av] ?? '#6b7280' }}>{av || '—'}</span>
                            </td>
                            <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Etapa Actual'] || '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha inicio programado'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha inicio real'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin programado'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin real'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#7c3aed', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                              {p['fin_estimado'] ? fmtFecha(p['fin_estimado']) : '—'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', fontVariantNumeric: 'tabular-nums' }}>{p['Ciclo estimado'] ?? '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{p['Ciclo real'] ?? '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right' }}><BrechaBadge delta={p['delta_dias']} /></td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <button onClick={() => setExpanded(isOpen ? null : p['N°PROCESO'])} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid #e5e7eb', background: isOpen ? 'var(--navy-500)' : '#fff', color: isOpen ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                                {isOpen ? '▲' : '▼'}
                              </button>
                            </td>
                          </tr>
                          {isOpen && <DetalleRow proceso={p['N°PROCESO']} />}
                        </Fragment>
                      )
                    })}
                    {sortedProcesos.length === 0 && <tr><td colSpan={14} style={{ padding: '20px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin procesos con el filtro seleccionado</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
