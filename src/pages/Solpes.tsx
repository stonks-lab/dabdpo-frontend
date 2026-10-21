import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts'
import { getLicitTabla } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

// ── Colores ───────────────────────────────────────────────────────────────────

const GRUPO_COLORS: Record<string, string> = {
  Cerrada:         '#27ae60',
  'En Proceso':    '#2563eb',
  Aceptada:        '#8b5cf6',
  'Enviado a PyC': '#f59e0b',
  Rechazada:       '#e74c3c',
}
const BADGE: Record<string, string> = {
  Cerrada:         'bg-emerald-100 text-emerald-700',
  'En Proceso':    'bg-blue-100 text-blue-700',
  Aceptada:        'bg-violet-100 text-violet-700',
  'Enviado a PyC': 'bg-amber-100 text-amber-700',
  Rechazada:       'bg-red-100 text-red-700',
}
const BLUES = ['#1e3a8a','#1e40af','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#172554','#1e4d8c']

function getPieColor(name: string, idx: number): string {
  return GRUPO_COLORS[name] ?? BLUES[idx % BLUES.length]
}

// ── Monto bucket (CLP) ────────────────────────────────────────────────────────
function montoBucket(monto: number | null | undefined, moneda: string | null | undefined): string {
  if (!monto || monto <= 0) return 'Sin monto'
  if (String(moneda ?? '').toUpperCase() !== 'CLP') return 'Moneda extr.'
  if (monto <= 10_000_000)  return '≤ 10M'
  if (monto <= 100_000_000) return '10M–100M'
  return '> 100M'
}

const NIVEL_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  'RETRASADA': { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  'EN RIESGO': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  'ATENCIÓN':  { bg: '#fefce8', text: '#92400e', border: '#fde68a' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type SortDir   = 'asc' | 'desc'
type SortState = { field: string; dir: SortDir }

function SortTh({ label, field, sort, onSort, align = 'left', style }: {
  label: string; field: string; sort: SortState; onSort: (f: string) => void
  align?: 'left' | 'right' | 'center'; style?: React.CSSProperties
}) {
  const active = sort.field === field
  return (
    <th onClick={() => onSort(field)} style={{
      cursor: 'pointer', userSelect: 'none', textAlign: align,
      padding: '7px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
      background: '#f9fafb', color: active ? 'var(--navy-500)' : '#6b7280', ...style,
    }}>
      {label}
      <span style={{ marginLeft: 3, opacity: active ? 1 : 0.35, fontSize: 9 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
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

// ── ComboBox ──────────────────────────────────────────────────────────────────

function ComboBox({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options
  }, [options, query])

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 130 }}>
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${value ? 'var(--navy-500)' : '#e5e7eb'}`, borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
        <input value={value || query} placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: 'none', outline: 'none', minWidth: 0 }} />
        {(value || query) && (
          <button onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }}
            style={{ padding: '0 6px', fontSize: 12, color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
        )}
        <span style={{ padding: '0 6px', fontSize: 9, color: '#9ca3af', userSelect: 'none' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && visible.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, minWidth: '100%', maxWidth: 320, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
          {query && !value && (
            <div onMouseDown={() => { onChange(query); setQuery(''); setOpen(false) }}
              style={{ padding: '5px 10px', fontSize: 11, color: '#6b7280', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontStyle: 'italic' }}>
              Buscar: "{query}"
            </div>
          )}
          {visible.slice(0, 100).map(o => (
            <div key={o} onMouseDown={() => { onChange(o); setQuery(''); setOpen(false) }}
              style={{ padding: '5px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: o === value ? '#eff6ff' : '#fff', color: o === value ? 'var(--navy-500)' : '#374151' }}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Constantes ────────────────────────────────────────────────────────────────

const EMPTY_FILTERS       = { codigo: '', tipo: '', forma: '', contrato: '', solicitante: '', estado: '', desde: '', hasta: '' }
const EMPTY_ALERTA_FILTERS = { codigo: '', contrato: '', tipo: '', forma: '', estado: '', nivel: '', desde: '', hasta: '' }
const ALL_GRUPOS = ['En Proceso', 'Aceptada', 'Enviado a PyC', 'Rechazada', 'Cerrada']

// ── Componente principal ──────────────────────────────────────────────────────

export default function Solpes() {
  const [tabla,     setTabla]     = useState<any[]>([])
  const [filters,   setFilters]   = useState({ ...EMPTY_FILTERS })
  const [showTabla, setShowTabla] = useState(false)
  const [solpeSort, setSolpeSort] = useState<SortState>({ field: '', dir: 'asc' })

  // Filtro de período global — afecta KPIs y tabla
  const [pageDesde, setPageDesde] = useState('')
  const [pageHasta, setPageHasta] = useState('')

  // Secciones de alerta
  const [showBenchmarks,  setShowBenchmarks]  = useState(false)
  const [showAlertas,     setShowAlertas]     = useState(true)
  const [alertaSort,      setAlertaSort]      = useState<SortState>({ field: '', dir: 'asc' })
  const [alertaFilters,   setAlertaFilters]   = useState({ ...EMPTY_ALERTA_FILTERS })

  // Selecciones desde gráficas
  const [selectedYear,  setSelectedYear]  = useState<number | null>(null)
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null)

  // Config donut
  const [pieDesde,   setPieDesde]   = useState('')
  const [pieHasta,   setPieHasta]   = useState('')
  const [pieEstados, setPieEstados] = useState<string[]>(['En Proceso', 'Aceptada', 'Enviado a PyC', 'Rechazada'])
  const [pieDetalle,    setPieDetalle]    = useState(false)
  const [selectedForma, setSelectedForma] = useState<string | null>(null)

  useEffect(() => {
    getLicitTabla({}).then(setTabla).catch(() => {})
  }, [])

  // Auto-abrir tabla al seleccionar desde gráfica
  useEffect(() => {
    if (selectedYear !== null || selectedSlice !== null) setShowTabla(true)
  }, [selectedYear, selectedSlice])

  const set = (k: keyof typeof EMPTY_FILTERS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters(f => ({ ...f, [k]: e.target.value }))

  // ── KPIs calculados localmente ────────────────────────────────────────────
  // Responden a: filtro de período global + año seleccionado en barra
  const kpiBase = useMemo(() => tabla.filter((r: any) => {
    const fecha = r.Fecha_Creacion_SOLPE?.slice(0, 10) ?? ''
    if (pageDesde && fecha < pageDesde) return false
    if (pageHasta && fecha > pageHasta) return false
    if (selectedYear !== null && r.Fecha_Creacion_SOLPE?.slice(0, 4) !== String(selectedYear)) return false
    return true
  }), [tabla, pageDesde, pageHasta, selectedYear])

  const localKpis = useMemo(() => {
    if (!tabla.length) return null
    const src         = kpiBase
    const total       = src.length
    const en_proceso  = src.filter((r: any) => r.Grupo_Estado === 'En Proceso').length
    const cerradas    = src.filter((r: any) => r.Grupo_Estado === 'Cerrada').length
    const rechazadas  = src.filter((r: any) => r.Grupo_Estado === 'Rechazada').length
    const aceptadas   = src.filter((r: any) => r.Grupo_Estado === 'Aceptada').length
    const enviado_pyc = src.filter((r: any) => r.Grupo_Estado === 'Enviado a PyC').length
    const tasa        = (total - rechazadas) > 0 ? cerradas / (total - rechazadas) : 0
    const cerCon      = src.filter((r: any) => r.Grupo_Estado === 'Cerrada' && (r.Dias_Gestion ?? 0) > 0)
    const dias_prom   = cerCon.length
      ? Math.round(cerCon.reduce((s: number, r: any) => s + (r.Dias_Gestion || 0), 0) / cerCon.length * 10) / 10
      : null
    return { total, en_proceso, cerradas, rechazadas, aceptadas, enviado_pyc, tasa_adjudicacion: tasa, dias_promedio_gestion: dias_prom }
  }, [kpiBase, tabla.length])

  // ── Benchmarks por categoría (Tipo × Forma × rango monto, desde cerradas) ──
  const benchmarks = useMemo(() => {
    const groups: Record<string, number[]> = {}
    tabla.forEach((r: any) => {
      if (r.Grupo_Estado !== 'Cerrada') return
      const dias = Number(r.Dias_Gestion)
      if (!dias || dias <= 0 || !r.Tipo || !r.Forma) return
      const key = `${r.Tipo}|${r.Forma}|${montoBucket(r.Monto, r.Moneda)}`
      ;(groups[key] = groups[key] ?? []).push(dias)
    })
    return Object.entries(groups)
      .filter(([, arr]) => arr.length >= 3)
      .map(([key, arr]) => {
        const [tipo, forma, monto_rango] = key.split('|')
        const sorted = [...arr].sort((a, b) => a - b)
        const avg = Math.round(arr.reduce((s, d) => s + d, 0) / arr.length)
        const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? avg
        return { tipo, forma, monto_rango, avg, p75, n: arr.length }
      })
      .sort((a, b) => a.tipo.localeCompare(b.tipo, 'es') || a.forma.localeCompare(b.forma, 'es') || a.monto_rango.localeCompare(b.monto_rango, 'es'))
  }, [tabla])

  // ── SOLPEs en alerta (SOLPEs abiertas vs. su benchmark de categoría) ────────
  const alertas = useMemo(() => {
    const today  = new Date()
    const OPEN   = new Set(['En Proceso', 'Aceptada', 'Enviado a PyC'])
    const result: any[] = []
    tabla.forEach((r: any) => {
      if (!OPEN.has(r.Grupo_Estado) || !r.Fecha_Creacion_SOLPE) return
      const fecha = r.Fecha_Creacion_SOLPE.slice(0, 10)
      if (pageDesde && fecha < pageDesde) return
      if (pageHasta && fecha > pageHasta) return
      const created = new Date(r.Fecha_Creacion_SOLPE)
      if (isNaN(created.getTime())) return
      const diasElapsed = Math.floor((today.getTime() - created.getTime()) / 86_400_000)
      const bucket = montoBucket(r.Monto, r.Moneda)
      const bench  = benchmarks.find(b => b.tipo === r.Tipo && b.forma === r.Forma && b.monto_rango === bucket)
      if (!bench || bench.avg <= 0) return
      const ratio = diasElapsed / bench.avg
      if (ratio < 0.50) return
      const nivel: 'RETRASADA' | 'ATENCIÓN' = ratio >= 0.75 ? 'RETRASADA' : 'ATENCIÓN'
      result.push({ ...r, dias_elapsed: diasElapsed, bench_avg: bench.avg, bench_p75: bench.p75, bench_n: bench.n, exceso_dias: diasElapsed - bench.avg, ratio, nivel })
    })
    return result.sort((a: any, b: any) => b.ratio - a.ratio)
  }, [tabla, benchmarks, pageDesde, pageHasta])

  const nRetrasadas = useMemo(() => alertas.filter((a: any) => a.nivel === 'RETRASADA').length, [alertas])
  const nRiesgo     = useMemo(() => alertas.filter((a: any) => a.nivel === 'EN RIESGO').length,  [alertas])
  const nAtencion   = useMemo(() => alertas.filter((a: any) => a.nivel === 'ATENCIÓN').length,   [alertas])

  // Opciones filtros de alerta (derivadas del conjunto de alertas)
  const alertaCodigosOpts   = useMemo(() => [...new Set(alertas.map((r: any) => r['Código']).filter(Boolean))].sort() as string[], [alertas])
  const alertaContratosOpts = useMemo(() => [...new Set(alertas.map((r: any) => r.Contrato).filter(Boolean))].sort()  as string[], [alertas])
  const alertaTiposOpts     = useMemo(() => [...new Set(alertas.map((r: any) => r.Tipo).filter(Boolean))].sort()      as string[], [alertas])
  const alertaFormasOpts    = useMemo(() => [...new Set(alertas.map((r: any) => r.Forma).filter(Boolean))].sort()     as string[], [alertas])

  const filteredAlertas = useMemo(() => alertas.filter((r: any) => {
    if (alertaFilters.codigo   && !String(r['Código'] ?? '').toLowerCase().includes(alertaFilters.codigo.toLowerCase())) return false
    if (alertaFilters.contrato && !String(r.Contrato ?? '').toLowerCase().includes(alertaFilters.contrato.toLowerCase())) return false
    if (alertaFilters.tipo     && r.Tipo !== alertaFilters.tipo) return false
    if (alertaFilters.forma    && r.Forma !== alertaFilters.forma) return false
    if (alertaFilters.estado   && r.Grupo_Estado !== alertaFilters.estado) return false
    if (alertaFilters.nivel    && r.nivel !== alertaFilters.nivel) return false
    const fecha = r.Fecha_Creacion_SOLPE?.slice(0, 10) ?? ''
    if (alertaFilters.desde    && fecha < alertaFilters.desde) return false
    if (alertaFilters.hasta    && fecha > alertaFilters.hasta) return false
    return true
  }), [alertas, alertaFilters])

  const sortedAlertas = useSorted(filteredAlertas, alertaSort)
  const handleAlertaSort = (f: string) => setAlertaSort(s => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hayAlertaFiltros = Object.values(alertaFilters).some(v => v !== '')

  // Opciones comboboxes
  const tiposOpts        = useMemo(() => [...new Set(tabla.map((r: any) => r.Tipo).filter(Boolean))].sort(), [tabla])
  const formasOpts       = useMemo(() => [...new Set(tabla.map((r: any) => r.Forma).filter(Boolean))].sort(), [tabla])
  const codigosOpts      = useMemo(() => [...new Set(tabla.map((r: any) => r['Código']).filter(Boolean))].sort(), [tabla])
  const contratosOpts    = useMemo(() => [...new Set(tabla.map((r: any) => r.Contrato).filter(Boolean))].sort(), [tabla])
  const solicitantesOpts = useMemo(() => [...new Set(tabla.map((r: any) => r['Usuario Solicitante']).filter(Boolean))].sort(), [tabla])

  // ── Datos gráfica de barras ───────────────────────────────────────────────
  const { stackedData, barEstados } = useMemo(() => {
    const years   = [...new Set(tabla.map((r: any) => r.Fecha_Creacion_SOLPE?.slice(0, 4)).filter(Boolean))].sort()
    const estados = [...new Set(tabla.map((r: any) => r.Grupo_Estado).filter(Boolean))] as string[]
    const data    = years
      .filter(y => Number(y) >= 2018)
      .map(y => {
        const base: any = { año: Number(y) }
        let total = 0
        estados.forEach(e => {
          const cnt = tabla.filter((r: any) => r.Fecha_Creacion_SOLPE?.startsWith(y) && r.Grupo_Estado === e).length
          base[e] = cnt
          total += cnt
        })
        base._total = total
        return base
      })
    return { stackedData: data, barEstados: estados }
  }, [tabla])

  // ── Datos donut ───────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const src = tabla.filter((r: any) => {
      const fecha = r.Fecha_Creacion_SOLPE?.slice(0, 10) ?? ''
      if (pieDesde && fecha < pieDesde) return false
      if (pieHasta && fecha > pieHasta) return false
      if (!pieEstados.includes(r.Grupo_Estado)) return false
      return true
    })
    const counts: Record<string, number> = {}
    src.forEach((r: any) => {
      const key = pieDetalle && r.Grupo_Estado === 'En Proceso'
        ? (r.Estado_SOLPE || 'En Proceso')
        : r.Grupo_Estado
      counts[key] = (counts[key] ?? 0) + 1
    })
    return Object.entries(counts)
      .map(([name, cantidad]) => ({ name, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [tabla, pieDesde, pieHasta, pieEstados, pieDetalle])

  // ── Datos donut por Forma ─────────────────────────────────────────────────
  const formaData = useMemo(() => {
    const counts: Record<string, number> = {}
    tabla.forEach((r: any) => {
      const k = r.Forma || 'Sin forma'
      counts[k] = (counts[k] ?? 0) + 1
    })
    return Object.entries(counts)
      .map(([name, cantidad]) => ({ name, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [tabla])

  // ── Filtro tabla ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => tabla.filter((r: any) => {
    const fecha = r.Fecha_Creacion_SOLPE?.slice(0, 10) ?? ''
    if (pageDesde && fecha < pageDesde) return false
    if (pageHasta && fecha > pageHasta) return false
    if (filters.codigo      && !String(r['Código'] ?? '').toLowerCase().includes(filters.codigo.toLowerCase())) return false
    if (filters.tipo        && r.Tipo !== filters.tipo) return false
    if (filters.forma       && r.Forma !== filters.forma) return false
    if (filters.contrato    && !String(r.Contrato ?? '').toLowerCase().includes(filters.contrato.toLowerCase())) return false
    if (filters.solicitante && !String(r['Usuario Solicitante'] ?? '').toLowerCase().includes(filters.solicitante.toLowerCase())) return false
    if (filters.estado      && r.Grupo_Estado !== filters.estado) return false
    if (filters.desde       && fecha < filters.desde) return false
    if (filters.hasta       && fecha > filters.hasta) return false
    if (selectedYear !== null && Number(r.Fecha_Creacion_SOLPE?.slice(0, 4)) !== selectedYear) return false
    if (selectedSlice !== null && r.Estado_SOLPE !== selectedSlice && r.Grupo_Estado !== selectedSlice) return false
    return true
  }), [tabla, filters, selectedYear, selectedSlice, pageDesde, pageHasta])

  // ── Denominador de la tabla según selección activa ────────────────────────
  // Año seleccionado → total de ese año; slice donut → total del donut; si no → total general
  const tableUniverse = useMemo(() => {
    if (selectedYear !== null) {
      return tabla.filter((r: any) => {
        const fecha = r.Fecha_Creacion_SOLPE?.slice(0, 10) ?? ''
        if (pageDesde && fecha < pageDesde) return false
        if (pageHasta && fecha > pageHasta) return false
        return r.Fecha_Creacion_SOLPE?.slice(0, 4) === String(selectedYear)
      }).length
    }
    if (selectedSlice !== null) {
      return pieData.reduce((s, d) => s + d.cantidad, 0)
    }
    return tabla.length
  }, [selectedYear, selectedSlice, tabla, pieData, pageDesde, pageHasta])

  const handleSort   = (f: string) => setSolpeSort(s => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))
  const sortedSolpes = useSorted(filtered, solpeSort)

  const hayFiltrosCols = Object.values(filters).some(v => v !== '')
  const hayChartSel    = selectedYear !== null || selectedSlice !== null
  const hayPageFiltro  = pageDesde !== '' || pageHasta !== ''
  const hayFiltros     = hayFiltrosCols || hayChartSel

  function clearAll() {
    setFilters({ ...EMPTY_FILTERS })
    setSelectedYear(null)
    setSelectedSlice(null)
  }

  function togglePieEstado(e: string) {
    setPieEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
    setSelectedSlice(null)
  }

  function handleBarClick(data: any) {
    const year = data?.activeLabel ? Number(data.activeLabel) : null
    if (!year) return
    setSelectedYear(v => v === year ? null : year)
    setSelectedSlice(null)
  }

  function handlePieClick(data: any) {
    const name = data?.name ?? null
    if (!name) return
    setSelectedSlice(v => v === name ? null : name)
    setSelectedYear(null)
  }

  function handleFormaClick(data: any) {
    const name = data?.name ?? null
    if (!name) return
    setSelectedForma(v => v === name ? null : name)
  }

  return (
    <div>
      <PageHeader title="SOLPEs" subtitle="Pipeline y seguimiento de solicitudes de pedido" icon="📁" />

      {/* ── Filtro de período global ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '4px 16px 12px' }}>
        <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>Período</span>
        <input type="date" value={pageDesde} onChange={e => setPageDesde(e.target.value)}
          style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff' }} />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>
        <input type="date" value={pageHasta} onChange={e => setPageHasta(e.target.value)}
          style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff' }} />
        {hayPageFiltro && (
          <button onClick={() => { setPageDesde(''); setPageHasta('') }}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}>
            ✕ Limpiar período
          </button>
        )}
        {(hayPageFiltro || selectedYear !== null) && localKpis && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            — <strong>{localKpis.total}</strong> SOLPEs en tarjetas
          </span>
        )}
      </div>

      {/* ── KPIs (calculados localmente, reflejan período + año seleccionado) ── */}
      {localKpis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-2">
            <KpiCard label="Total SOLPEs"       value={localKpis.total}                                           color="blue"   icon="📁" />
            <KpiCard label="En Proceso"         value={localKpis.en_proceso}                                      color="orange" icon="⏳" sub="activas actualmente" />
            <KpiCard label="Cerradas / Adjud."  value={localKpis.cerradas}                                        color="green"  icon="✅" />
            <KpiCard label="Tasa Adjudicación"  value={`${(localKpis.tasa_adjudicacion * 100).toFixed(1)}%`}      color="green"  icon="🎯" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
            <KpiCard label="Rechazadas"          value={localKpis.rechazadas}                                     color="red"    icon="❌" />
            <KpiCard label="Aceptadas"           value={localKpis.aceptadas}                                      color="blue"   icon="✔️" />
            <KpiCard label="Enviado a PyC"       value={localKpis.enviado_pyc}                                    color="orange" icon="📤" />
            <KpiCard label="Días Prom. Gestión"  value={localKpis.dias_promedio_gestion ?? '—'}                   color="blue"   icon="📅" sub="SOLPEs cerradas" />
          </div>
        </>
      )}

      {/* ── Gráficas ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">

        {/* Barras por año */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">SOLPEs por Año y Estado</h2>
            {selectedYear !== null
              ? <button onClick={() => setSelectedYear(null)}
                  style={{ marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 4, border: '1px solid #93c5fd', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}>
                  {selectedYear} ✕
                </button>
              : <span style={{ marginLeft: 8, fontSize: 10, color: '#9aa1b3' }}>clic en barra para filtrar</span>
            }
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stackedData} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              <XAxis dataKey="año" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              {barEstados.map((e, i) => (
                <Bar key={e} dataKey={e} stackId="a" fill={GRUPO_COLORS[e] ?? '#94a3b8'}
                  opacity={selectedYear !== null ? (stackedData.find(d => d.año === selectedYear)?.[e] ? 1 : 0.3) : 1}
                  radius={i === barEstados.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
                  {i === barEstados.length - 1 && (
                    <LabelList dataKey="_total" position="top"
                      style={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }} />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Distribución Estado Actual</h2>
            {selectedSlice !== null && (
              <button onClick={() => setSelectedSlice(null)}
                style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, border: '1px solid #93c5fd', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}>
                {selectedSlice} ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: '#6b7280' }}>Desde</span>
            <input type="date" value={pieDesde} onChange={e => setPieDesde(e.target.value)}
              style={{ fontSize: 10, padding: '2px 5px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
            <span style={{ fontSize: 10, color: '#6b7280' }}>hasta</span>
            <input type="date" value={pieHasta} onChange={e => setPieHasta(e.target.value)}
              style={{ fontSize: 10, padding: '2px 5px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
            {(pieDesde || pieHasta) && (
              <button onClick={() => { setPieDesde(''); setPieHasta('') }}
                style={{ fontSize: 10, color: '#dc2626', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {ALL_GRUPOS.map(g => (
              <button key={g} onClick={() => togglePieEstado(g)} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${GRUPO_COLORS[g] ?? '#94a3b8'}`,
                background: pieEstados.includes(g) ? GRUPO_COLORS[g] ?? '#94a3b8' : '#f9fafb',
                color: pieEstados.includes(g) ? '#fff' : '#6b7280',
              }}>{g}</button>
            ))}
            <button onClick={() => setPieDetalle(v => !v)} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
              border: '1px solid #6b7280',
              background: pieDetalle ? '#374151' : '#f9fafb',
              color: pieDetalle ? '#fff' : '#6b7280',
            }}>Detalle etapas</button>
          </div>

          {selectedSlice === null && (
            <span style={{ fontSize: 10, color: '#9aa1b3', display: 'block', marginBottom: 4 }}>clic en sector para filtrar tabla</span>
          )}

          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={pieData} dataKey="cantidad" nameKey="name"
                cx="50%" cy="50%" outerRadius={72} innerRadius={28}
                onClick={handlePieClick} style={{ cursor: 'pointer' }}
                label={({ percent }) => (percent ?? 0) > 0.04 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                labelLine={false}>
                {pieData.map((e, i) => (
                  <Cell key={i}
                    fill={getPieColor(e.name, i)}
                    opacity={selectedSlice !== null ? (e.name === selectedSlice ? 1 : 0.35) : 1}
                    stroke={e.name === selectedSlice ? '#1e40af' : 'none'}
                    strokeWidth={e.name === selectedSlice ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v: any, name: any) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Donut por Forma */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">SOLPEs por Forma</h2>
            {selectedForma !== null && (
              <button onClick={() => setSelectedForma(null)}
                style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, border: '1px solid #93c5fd', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}>
                {selectedForma} ✕
              </button>
            )}
          </div>
          {selectedForma === null && (
            <span style={{ fontSize: 10, color: '#9aa1b3', display: 'block', marginBottom: 4 }}>clic en sector para ver procesos</span>
          )}
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={formaData} dataKey="cantidad" nameKey="name"
                cx="50%" cy="50%" outerRadius={72} innerRadius={28}
                onClick={handleFormaClick} style={{ cursor: 'pointer' }}
                label={({ percent }) => (percent ?? 0) > 0.04 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                labelLine={false}>
                {formaData.map((e, i) => (
                  <Cell key={i}
                    fill={BLUES[i % BLUES.length]}
                    opacity={selectedForma !== null ? (e.name === selectedForma ? 1 : 0.35) : 1}
                    stroke={e.name === selectedForma ? '#1e40af' : 'none'}
                    strokeWidth={e.name === selectedForma ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(v: any, name: any) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Drill-down por Forma ──────────────────────────────────────────────── */}
      {selectedForma !== null && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Forma: {selectedForma}</span>
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>
                {tabla.filter((r: any) => (r.Forma || 'Sin forma') === selectedForma).length} SOLPEs
              </span>
              <button onClick={() => setSelectedForma(null)}
                style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}>
                ✕ Cerrar
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    {['Código', 'Nombre', 'Tipo', 'Estado', 'Días Gestión', 'Creación'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabla
                    .filter((r: any) => (r.Forma || 'Sin forma') === selectedForma)
                    .map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ padding: '5px 12px', fontFamily: 'monospace', color: '#374151', whiteSpace: 'nowrap' }}>{r['Código']}</td>
                        <td style={{ padding: '5px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4b5563' }} title={r.Nombre}>{r.Nombre}</td>
                        <td style={{ padding: '5px 12px', color: '#6b7280' }}>{r.Tipo || '—'}</td>
                        <td style={{ padding: '5px 12px' }}>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${BADGE[r.Grupo_Estado] ?? 'bg-gray-100 text-gray-500'}`}>
                            {r.Estado_SOLPE || r.Grupo_Estado}
                          </span>
                        </td>
                        <td style={{ padding: '5px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{r.Dias_Gestion ?? '—'}</td>
                        <td style={{ padding: '5px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{r.Fecha_Creacion_SOLPE?.split('T')[0] ?? '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Benchmarks por categoría ────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowBenchmarks(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: showBenchmarks ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Benchmarks por Categoría</span>
            <span style={{ fontSize: 11, color: '#9aa1b3' }}>{benchmarks.length} categorías · promedio de días desde SOLPEs cerradas</span>
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showBenchmarks ? '▲' : '▼'}</span>
          </button>
          {showBenchmarks && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    {(['Tipo', 'Forma', 'Rango Monto', 'Prom. Días', 'P75 Días', 'Muestras'] as const).map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Prom. Días' || h === 'P75 Días' || h === 'Muestras' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '5px 12px', color: '#374151' }}>{b.tipo}</td>
                      <td style={{ padding: '5px 12px', color: '#374151' }}>{b.forma}</td>
                      <td style={{ padding: '5px 12px', color: '#6b7280' }}>{b.monto_rango}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 600, color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>{b.avg} d</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{b.p75} d</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{b.n}</td>
                    </tr>
                  ))}
                  {benchmarks.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin datos suficientes (mínimo 3 SOLPEs cerradas por categoría)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── SOLPEs en alerta ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowAlertas(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: showAlertas ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>SOLPEs en Alerta</span>
            {nRetrasadas > 0 && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: NIVEL_COLOR['RETRASADA'].bg, color: NIVEL_COLOR['RETRASADA'].text, border: `1px solid ${NIVEL_COLOR['RETRASADA'].border}` }}>
                {nRetrasadas} retrasada{nRetrasadas !== 1 ? 's' : ''}
              </span>
            )}
            {nRiesgo > 0 && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: NIVEL_COLOR['EN RIESGO'].bg, color: NIVEL_COLOR['EN RIESGO'].text, border: `1px solid ${NIVEL_COLOR['EN RIESGO'].border}` }}>
                {nRiesgo} en riesgo
              </span>
            )}
            {nAtencion > 0 && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: NIVEL_COLOR['ATENCIÓN'].bg, color: NIVEL_COLOR['ATENCIÓN'].text, border: `1px solid ${NIVEL_COLOR['ATENCIÓN'].border}` }}>
                {nAtencion} atención
              </span>
            )}
            {hayAlertaFiltros && (
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>{filteredAlertas.length} / {alertas.length}</span>
            )}
            {alertas.length === 0 && tabla.length > 0 && (
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>sin alertas activas</span>
            )}
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showAlertas ? '▲' : '▼'}</span>
          </button>

          {showAlertas && (
            <>
              {/* Filtros */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <ComboBox value={alertaFilters.codigo}   onChange={v => setAlertaFilters(f => ({ ...f, codigo: v }))}   options={alertaCodigosOpts}   placeholder="Código…" />
                <ComboBox value={alertaFilters.contrato} onChange={v => setAlertaFilters(f => ({ ...f, contrato: v }))} options={alertaContratosOpts} placeholder="Contrato…" />
                <select value={alertaFilters.tipo} onChange={e => setAlertaFilters(f => ({ ...f, tipo: e.target.value }))}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: alertaFilters.tipo ? '#374151' : '#9ca3af' }}>
                  <option value="">Tipo…</option>
                  {alertaTiposOpts.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={alertaFilters.forma} onChange={e => setAlertaFilters(f => ({ ...f, forma: e.target.value }))}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: alertaFilters.forma ? '#374151' : '#9ca3af' }}>
                  <option value="">Forma…</option>
                  {alertaFormasOpts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={alertaFilters.estado} onChange={e => setAlertaFilters(f => ({ ...f, estado: e.target.value }))}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: alertaFilters.estado ? '#374151' : '#9ca3af' }}>
                  <option value="">Estado…</option>
                  {['En Proceso', 'Aceptada', 'Enviado a PyC'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={alertaFilters.nivel} onChange={e => setAlertaFilters(f => ({ ...f, nivel: e.target.value }))}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: alertaFilters.nivel ? '#374151' : '#9ca3af' }}>
                  <option value="">Alerta…</option>
                  {['RETRASADA', 'ATENCIÓN'].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Creación desde</span>
                  <input type="date" value={alertaFilters.desde} onChange={e => setAlertaFilters(f => ({ ...f, desde: e.target.value }))}
                    style={{ fontSize: 11, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                  <span style={{ fontSize: 11, color: '#6b7280' }}>hasta</span>
                  <input type="date" value={alertaFilters.hasta} onChange={e => setAlertaFilters(f => ({ ...f, hasta: e.target.value }))}
                    style={{ fontSize: 11, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                </div>
                {hayAlertaFiltros && (
                  <button onClick={() => setAlertaFilters({ ...EMPTY_ALERTA_FILTERS })}
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}>
                    ✕ Limpiar
                  </button>
                )}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <SortTh label="Código"    field="Código"               sort={alertaSort} onSort={handleAlertaSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Nombre"    field="Nombre"               sort={alertaSort} onSort={handleAlertaSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Contrato"  field="Contrato"             sort={alertaSort} onSort={handleAlertaSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Tipo"      field="Tipo"                 sort={alertaSort} onSort={handleAlertaSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Forma"     field="Forma"                sort={alertaSort} onSort={handleAlertaSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Estado"    field="Estado_SOLPE"         sort={alertaSort} onSort={handleAlertaSort} align="center" style={{ padding: '7px 12px' }} />
                      <SortTh label="Creación"  field="Fecha_Creacion_SOLPE" sort={alertaSort} onSort={handleAlertaSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Días"      field="dias_elapsed"         sort={alertaSort} onSort={handleAlertaSort} align="right" style={{ padding: '7px 12px' }} />
                      <SortTh label="Benchmark" field="bench_avg"            sort={alertaSort} onSort={handleAlertaSort} align="right" style={{ padding: '7px 12px' }} />
                      <SortTh label="Exceso"    field="exceso_dias"          sort={alertaSort} onSort={handleAlertaSort} align="right" style={{ padding: '7px 12px' }} />
                      <SortTh label="Alerta"    field="nivel"                sort={alertaSort} onSort={handleAlertaSort} align="center" style={{ padding: '7px 12px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAlertas.map((a: any, i: number) => {
                      const nc = NIVEL_COLOR[a.nivel]
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: a.nivel === 'RETRASADA' ? '#fff8f8' : i % 2 === 1 ? '#fafafa' : '#fff' }}>
                          <td style={{ padding: '5px 12px', fontFamily: 'monospace', color: '#374151', whiteSpace: 'nowrap' }}>{a['Código']}</td>
                          <td style={{ padding: '5px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4b5563' }} title={a.Nombre}>{a.Nombre}</td>
                          <td style={{ padding: '5px 12px', fontFamily: 'monospace', color: '#2563eb', whiteSpace: 'nowrap' }}>{a.Contrato || '—'}</td>
                          <td style={{ padding: '5px 12px', color: '#374151' }}>{a.Tipo}</td>
                          <td style={{ padding: '5px 12px', color: '#6b7280' }}>{a.Forma}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'center' }}>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${BADGE[a.Grupo_Estado] ?? 'bg-gray-100 text-gray-500'}`}
                              title={a.Estado_SOLPE}>{a.Estado_SOLPE || a.Grupo_Estado}</span>
                          </td>
                          <td style={{ padding: '5px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {a.Fecha_Creacion_SOLPE?.split('T')[0] ?? '—'}
                          </td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: a.nivel === 'RETRASADA' ? '#b91c1c' : '#374151' }}>
                            {a.dias_elapsed} d
                          </td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', color: '#6b7280', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {a.bench_avg} d
                            <span style={{ color: '#9ca3af', fontSize: 10 }}> (P75:{a.bench_p75}, n={a.bench_n})</span>
                          </td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: a.exceso_dias > 0 ? '#b91c1c' : '#92400e' }}>
                            {a.exceso_dias > 0 ? `+${a.exceso_dias} d` : `${Math.round(a.ratio * 100)}%`}
                          </td>
                          <td style={{ padding: '5px 12px', textAlign: 'center' }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: nc.bg, color: nc.text, border: `1px solid ${nc.border}`, whiteSpace: 'nowrap' }}>
                              {a.nivel}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {sortedAlertas.length === 0 && (
                      <tr><td colSpan={11} style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
                        {alertas.length === 0
                          ? 'No hay SOLPEs abiertas que superen el 50% de su benchmark de categoría'
                          : 'Sin resultados con los filtros seleccionados'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tabla colapsable ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowTabla(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Detalle SOLPEs</span>

            {selectedYear !== null && (
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd' }}>
                Año {selectedYear}
              </span>
            )}
            {selectedSlice !== null && (
              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedSlice}
              </span>
            )}

            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 4 }}>
              {(hayFiltros || hayPageFiltro)
                ? `${filtered.length} / ${tableUniverse}`
                : `${tableUniverse}`
              } SOLPEs
            </span>

            {hayFiltros && (
              <button onClick={e => { e.stopPropagation(); clearAll() }}
                style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}>
                ✕ Limpiar todo
              </button>
            )}
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{showTabla ? '▲' : '▼'}</span>
          </button>

          {showTabla && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <ComboBox value={filters.codigo}      onChange={v => setFilters(f => ({ ...f, codigo: v }))}      options={codigosOpts}      placeholder="Código…" />
                <ComboBox value={filters.contrato}    onChange={v => setFilters(f => ({ ...f, contrato: v }))}    options={contratosOpts}    placeholder="Contrato…" />
                <ComboBox value={filters.solicitante} onChange={v => setFilters(f => ({ ...f, solicitante: v }))} options={solicitantesOpts} placeholder="Solicitante…" />
                <select value={filters.tipo} onChange={set('tipo')}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: filters.tipo ? '#374151' : '#9ca3af' }}>
                  <option value="">Tipo…</option>
                  {tiposOpts.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filters.forma} onChange={set('forma')}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: filters.forma ? '#374151' : '#9ca3af' }}>
                  <option value="">Forma…</option>
                  {formasOpts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={filters.estado} onChange={set('estado')}
                  style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', color: filters.estado ? '#374151' : '#9ca3af' }}>
                  <option value="">Estado…</option>
                  {['En Proceso', 'Cerrada', 'Aceptada', 'Enviado a PyC', 'Rechazada'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Creación desde</span>
                  <input type="date" value={filters.desde} onChange={set('desde')}
                    style={{ fontSize: 11, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                  <span style={{ fontSize: 11, color: '#6b7280' }}>hasta</span>
                  <input type="date" value={filters.hasta} onChange={set('hasta')}
                    style={{ fontSize: 11, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <SortTh label="Código"      field="Código"                       sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Nombre"      field="Nombre"                       sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Tipo"        field="Tipo"                         sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Forma"       field="Forma"                        sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Contrato"    field="Contrato"                     sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Solicitante" field="Usuario Solicitante"          sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Gestor"      field="Ges. de Contratos y Compras"  sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                      <SortTh label="Estado"      field="Estado_SOLPE"                 sort={solpeSort} onSort={handleSort} align="center" style={{ padding: '7px 12px' }} />
                      <SortTh label="Días"        field="Dias_Gestion"                 sort={solpeSort} onSort={handleSort} align="right" style={{ padding: '7px 12px' }} />
                      <SortTh label="Creación"    field="Fecha_Creacion_SOLPE"         sort={solpeSort} onSort={handleSort} style={{ padding: '7px 12px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSolpes.map((r: any, i: number) => (
                      <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                        <td style={{ padding: '5px 12px', fontFamily: 'monospace', color: '#374151' }}>{r['Código']}</td>
                        <td style={{ padding: '5px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#4b5563' }} title={r.Nombre}>{r.Nombre}</td>
                        <td style={{ padding: '5px 12px', color: '#6b7280' }}>{r.Tipo}</td>
                        <td style={{ padding: '5px 12px', color: '#6b7280' }}>{r.Forma}</td>
                        <td style={{ padding: '5px 12px', fontFamily: 'monospace', color: '#2563eb' }}>{r.Contrato || '—'}</td>
                        <td style={{ padding: '5px 12px', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }} title={r['Usuario Solicitante']}>{r['Usuario Solicitante'] || '—'}</td>
                        <td style={{ padding: '5px 12px', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }} title={r['Ges. de Contratos y Compras']}>{r['Ges. de Contratos y Compras'] || '—'}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'center' }}>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${BADGE[r.Grupo_Estado] ?? 'bg-gray-100 text-gray-500'}`}
                            title={r.Estado_SOLPE}>{r.Estado_SOLPE || r.Grupo_Estado}</span>
                        </td>
                        <td style={{ padding: '5px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{r.Dias_Gestion ?? '—'}</td>
                        <td style={{ padding: '5px 12px', color: '#6b7280' }}>{r.Fecha_Creacion_SOLPE?.split('T')[0]}</td>
                      </tr>
                    ))}
                    {sortedSolpes.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin SOLPEs con los filtros seleccionados</td></tr>
                    )}
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
