import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import {
  getSaldoKpis, getSaldoFiltros, getContratos,
  getSaldoEvolucion, getSaldoTimeline,
} from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

// ── formateo ──────────────────────────────────────────────────────────────────

const mmclp = (v: number) => `$${(v / 1e9).toFixed(1)} MM`
const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

const ESTADO_COLOR: Record<string, string> = {
  NEGATIVO:    '#c0392b',
  CRÍTICO:     '#e74c3c',
  ADVERTENCIA: '#f39c12',
  ATENCIÓN:    '#f1c40f',
  OK:          '#27ae60',
}

// ── timeline helpers (definidos fuera para no recrear cada render) ─────────────

const MESES_ABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fmtMes = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MESES_ABR[parseInt(mo) - 1]}-${y.slice(2)}`
}
const fmtMM = (v: number): string => {
  if (!isFinite(v)) return '—'
  const abs = Math.abs(v), s = v < 0 ? '−' : ''
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}MM`
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`
  return `${s}$${abs.toFixed(0)}`
}
const cellBg = (mi: number, mesActualIdx: number, agotIdx: number | null): string => {
  if (mi === mesActualIdx) return '#bfdbfe'          // celeste — mes actual
  if (mi < mesActualIdx)  return '#f0fdf4'           // verde — histórico
  if (agotIdx === null)   return '#f0fdf4'           // verde — sin agotamiento
  if (mi >= agotIdx)      return '#fee2e2'           // rojo — sin saldo
  if (mi >= agotIdx - 6)  return '#fef9c3'           // amarillo — ≤6 meses
  return '#f0fdf4'                                   // verde — OK futuro
}

const TL_STICKY: { label: string; left: number; minW: number; align: 'left' | 'right' }[] = [
  { label: 'Contrato',     left: 0,   minW: 84,  align: 'left'  },
  { label: 'Descripción',  left: 84,  minW: 155, align: 'left'  },
  { label: 'Área',         left: 239, minW: 75,  align: 'left'  },
  { label: 'Presupuesto',  left: 314, minW: 86,  align: 'right' },
  { label: 'Saldo Actual', left: 400, minW: 86,  align: 'right' },
  { label: 'Agota en',     left: 486, minW: 80,  align: 'left'  },
]
type SortDir = 'asc' | 'desc'

// ── componente ────────────────────────────────────────────────────────────────

export default function SaldoContratos() {
  const [kpis,      setKpis]      = useState<any>(null)
  const [filtros,   setFiltros]   = useState<any>(null)
  const [contratos, setContratos] = useState<any[]>([])
  const [evolucion, setEvolucion] = useState<any[]>([])
  const [filters,   setFilters]   = useState({
    estado_saldo: '', area: '', tipo: '', estado_ctt: '', alcance: '', contrato: '',
  })
  const [sortCol, setSortCol] = useState<string>('Pct_Saldo')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // timeline state
  const [timeline,        setTimeline]        = useState<any>(null)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [tlShowPyC,       setTlShowPyC]       = useState(false)
  const [tlShowRiesgo,    setTlShowRiesgo]    = useState(false)

  useEffect(() => {
    getSaldoKpis().then(setKpis).catch(() => {})
    getSaldoFiltros().then(setFiltros).catch(() => {})
    getSaldoEvolucion().then(setEvolucion).catch(() => {})
  }, [])

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    getContratos(params).then(setContratos).catch(() => {})
  }, [filters])

  useEffect(() => {
    const active = Object.entries(filters).filter(([, v]) => v)
    if (active.length === 0) {
      setTimeline(null)
      setTimelineLoading(false)
      return
    }
    setTimelineLoading(true)
    const params: Record<string, string | number> = Object.fromEntries(active)
    params.limite = 60
    getSaldoTimeline(params)
      .then(setTimeline)
      .catch(() => setTimeline(null))
      .finally(() => setTimelineLoading(false))
  }, [filters])

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  // tabla histórica — ordenamiento
  const sorted = useMemo(() => {
    const arr = [...contratos]
    arr.sort((a, b) => {
      const av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return arr
  }, [contratos, sortCol, sortDir])

  // timeline — contratos filtrados por toggles
  const tlContratos = useMemo(() => {
    if (!timeline) return []
    let rows: any[] = timeline.contratos
    if (tlShowPyC)    rows = rows.filter((c: any) => c.tiene_proyeccion)
    if (tlShowRiesgo) rows = rows.filter((c: any) => c.mes_agotamiento)
    return rows
  }, [timeline, tlShowPyC, tlShowRiesgo])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3 }}>⇅</span>
    return <span style={{ color: 'var(--gold-500)' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const estadoCount = ['NEGATIVO', 'CRÍTICO', 'ADVERTENCIA', 'ATENCIÓN', 'OK'].map(e => ({
    name: e, value: contratos.filter(c => c.Estado_Saldo === e).length,
    fill: ESTADO_COLOR[e],
  })).filter(x => x.value > 0)

  const hasFilters = Object.values(filters).some(Boolean)

  if (!kpis) return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
      Cargando...
    </div>
  )

  return (
    <>
      <PageHeader title="Saldo de Contratos" subtitle="Evolución histórica y proyección futura de saldo por contrato" />
      <div className="page">

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Presupuesto Total"   value={mmclp(kpis.presupuesto_total_clp)} color="blue" />
          <KpiCard label="EP Consumido"        value={mmclp(kpis.ep_consumido_clp)}      color="blue"
            sub={`${(kpis.pct_consumido * 100).toFixed(1)}% del presupuesto`} />
          <KpiCard label="Saldo Real"          value={mmclp(kpis.saldo_real_clp)}        color="green" />
          <KpiCard label="% Consumido"         value={`${(kpis.pct_consumido * 100).toFixed(1)}%`} color="blue" />
          <KpiCard label="Contratos Críticos"  value={kpis.contratos_criticos}           color="red" />
          <KpiCard label="En Advertencia"      value={kpis.contratos_advertencia}        color="yellow" />
        </div>

        {/* Filtros */}
        {filtros && (
          <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input
              style={{ flex: '1 1 180px', fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
              placeholder="Buscar contrato o descripción…"
              value={filters.contrato}
              onChange={e => setFilter('contrato', e.target.value)}
            />
            {[
              { key: 'estado_saldo', label: 'Estado saldo',     opts: filtros.estados_saldo ?? [] },
              { key: 'alcance',      label: 'Alcance servicio', opts: filtros.alcances ?? [] },
              { key: 'area',         label: 'Área',             opts: filtros.areas ?? [] },
              { key: 'tipo',         label: 'Tipo contrato',    opts: filtros.tipos ?? [] },
              { key: 'estado_ctt',   label: 'Estado contrato',  opts: filtros.estados_ctt ?? [] },
            ].map(({ key, label, opts }) => (
              opts.length > 0 && (
                <select
                  key={key}
                  value={(filters as any)[key]}
                  onChange={e => setFilter(key, e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
                >
                  <option value="">— {label} —</option>
                  {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              )
            ))}
            {hasFilters && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }}
                onClick={() => setFilters({ estado_saldo: '', area: '', tipo: '', estado_ctt: '', alcance: '', contrato: '' })}>
                ✕ Limpiar
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
              {contratos.length} contratos
            </span>
          </div>
        )}

        {/* ── Timeline de Saldo ─────────────────────────────────────────────── */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Cabecera del panel */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-500)' }}>
              Proyección de Saldo por Contrato
            </span>
            {timeline && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {tlContratos.length < (timeline.total_contratos ?? timeline.contratos.length)
                  ? `${tlContratos.length} de ${timeline.total_contratos ?? timeline.contratos.length} contratos (ordenados por criticidad)`
                  : `${tlContratos.length} contratos`}
                {!timeline.tiene_proyecciones && ' · sin P&C'}
              </span>
            )}

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { bg: '#f0fdf4', bd: '#bbf7d0', label: 'Sin riesgo'   },
                { bg: '#bfdbfe', bd: '#93c5fd', label: 'Mes actual'   },
                { bg: '#fef9c3', bd: '#fde68a', label: '≤6 meses'     },
                { bg: '#fee2e2', bd: '#fca5a5', label: 'Sin saldo'    },
              ].map(({ bg, bd, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--color-text-muted)' }}>
                  <span style={{ width: 11, height: 11, background: bg, border: `1px solid ${bd}`, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>

            {/* Toggles de filtro local */}
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                className={tlShowPyC ? 'btn' : 'btn btn-ghost'}
                style={{ fontSize: 11, padding: '2px 9px' }}
                onClick={() => setTlShowPyC(v => !v)}
              >Con P&C</button>
              <button
                className={tlShowRiesgo ? 'btn' : 'btn btn-ghost'}
                style={{ fontSize: 11, padding: '2px 9px' }}
                onClick={() => setTlShowRiesgo(v => !v)}
              >En riesgo</button>
            </div>
          </div>

          {/* Cuerpo */}
          {!hasFilters ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
              Selecciona un contrato o aplica algún filtro para ver la proyección de saldo
            </div>
          ) : timelineLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
              Calculando proyección de saldo…
            </div>
          ) : timeline ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead>
                  <tr>
                    {/* Columnas fijas */}
                    {TL_STICKY.map((col, ci) => (
                      <th key={col.label}
                        style={{
                          position: 'sticky', left: col.left, zIndex: 4,
                          minWidth: col.minW, padding: '7px 8px',
                          background: '#f9fafb', whiteSpace: 'nowrap',
                          borderBottom: '2px solid var(--color-border)',
                          textAlign: col.align,
                          boxShadow: ci === TL_STICKY.length - 1
                            ? '3px 0 6px rgba(0,0,0,.07)' : undefined,
                        }}
                      >
                        {col.label}
                      </th>
                    ))}

                    {/* Columnas de meses */}
                    {timeline.meses.map((m: string) => (
                      <th key={m}
                        style={{
                          minWidth: 63, padding: '7px 4px',
                          textAlign: 'center',
                          background:  m === timeline.mes_actual ? '#bfdbfe' : '#f9fafb',
                          color:       m === timeline.mes_actual ? '#1e40af' : 'var(--color-text-muted)',
                          fontWeight:  m === timeline.mes_actual ? 700 : 400,
                          borderBottom: '2px solid var(--color-border)',
                          borderLeft:  m === timeline.mes_actual ? '2px solid #93c5fd' : undefined,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtMes(m)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {tlContratos.map((ctt: any) => {
                    const agotIdx = ctt.mes_agotamiento
                      ? timeline.meses.indexOf(ctt.mes_agotamiento)
                      : null
                    const bd = '1px solid #f0f0f0'

                    return (
                      <tr key={ctt.codigo_ctt}>
                        {/* Contrato */}
                        <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fff', padding: '5px 8px', fontFamily: 'monospace', fontWeight: 600, fontSize: 10, borderBottom: bd }}>
                          {ctt.codigo_ctt}
                        </td>
                        {/* Descripción */}
                        <td style={{ position: 'sticky', left: 84, zIndex: 2, background: '#fff', padding: '5px 8px', maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: bd }}
                          title={ctt.descripcion}>
                          {ctt.descripcion}
                        </td>
                        {/* Área */}
                        <td style={{ position: 'sticky', left: 239, zIndex: 2, background: '#fff', padding: '5px 8px', fontSize: 10, color: 'var(--color-text-muted)', borderBottom: bd }}>
                          {ctt.area}
                        </td>
                        {/* Presupuesto */}
                        <td style={{ position: 'sticky', left: 314, zIndex: 2, background: '#fff', padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: bd }}>
                          {fmtMM(ctt.presupuesto)}
                        </td>
                        {/* Saldo Actual */}
                        <td style={{
                          position: 'sticky', left: 400, zIndex: 2,
                          background: '#fff', padding: '5px 8px',
                          textAlign: 'right', fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: ctt.saldo_actual < 0 ? '#dc2626' : 'var(--navy-500)',
                          borderBottom: bd,
                        }}>
                          {fmtMM(ctt.saldo_actual)}
                        </td>
                        {/* Agota en */}
                        <td style={{
                          position: 'sticky', left: 486, zIndex: 2,
                          background: '#fff', padding: '5px 8px',
                          boxShadow: '3px 0 6px rgba(0,0,0,.07)',
                          borderBottom: bd,
                        }}>
                          {ctt.mes_agotamiento ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>
                              {fmtMes(ctt.mes_agotamiento)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: ctt.tiene_proyeccion ? '#16a34a' : 'var(--color-text-muted)' }}>
                              {ctt.tiene_proyeccion ? 'Sin límite' : 'Sin P&C'}
                            </span>
                          )}
                        </td>

                        {/* Celdas de meses */}
                        {timeline.meses.map((m: string, mi: number) => {
                          const saldo = ctt.saldos[mi]
                          return (
                            <td key={m}
                              style={{
                                minWidth: 63, padding: '5px 5px',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                fontSize: 10,
                                background: cellBg(mi, timeline.mes_actual_idx, agotIdx),
                                color: saldo < 0
                                  ? '#dc2626'
                                  : saldo < ctt.presupuesto * 0.05 ? '#b45309'
                                  : undefined,
                                borderLeft:   m === timeline.mes_actual ? '2px solid #93c5fd' : undefined,
                                borderBottom: bd,
                              }}
                              title={`${ctt.codigo_ctt} · ${m}: ${clp(saldo)}`}
                            >
                              {fmtMM(saldo)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  {tlContratos.length === 0 && (
                    <tr>
                      <td
                        colSpan={TL_STICKY.length + (timeline?.meses.length ?? 0)}
                        style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}
                      >
                        Sin contratos con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
              No se pudo cargar la proyección.
            </div>
          )}
        </div>

        {/* ── Tabla snapshot + gráficos laterales ──────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      { col: 'codigo_ctt',       label: 'Contrato' },
                      { col: 'Descripcion_ctt',  label: 'Descripción' },
                      { col: 'alcance',           label: 'Alcance' },
                      { col: 'Area_contrato',    label: 'Área' },
                      { col: 'Estado_ctt',       label: 'Estado Cto' },
                      { col: 'Presupuesto_CLP',  label: 'Presupuesto' },
                      { col: 'EP_Consumido_CLP', label: 'EP Cons.' },
                      { col: 'Saldo_CLP',        label: 'Saldo' },
                      { col: 'Pct_Saldo',        label: '% Saldo' },
                      { col: 'Estado_Saldo',     label: 'Alerta' },
                    ].map(({ col, label }) => (
                      <th key={col} onClick={() => toggleSort(col)}
                        style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                        {label} <SortIcon col={col} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.codigo_ctt}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.Descripcion_ctt}>{c.Descripcion_ctt}</td>
                      <td style={{ fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={c.alcance}>{c.alcance || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.Area_contrato}</td>
                      <td>
                        <span className={`chip ${c.Estado_ctt === 'Vigente' ? 'ok' : 'warn'}`}>
                          {c.Estado_ctt}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mmclp(c.Presupuesto_CLP)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mmclp(c.EP_Consumido_CLP)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: c.Saldo_CLP < 0 ? '#dc2626' : 'inherit' }}>
                        {mmclp(c.Saldo_CLP)}
                      </td>
                      <td>
                        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, width: 80, marginBottom: 2 }}>
                          <div style={{
                            height: 6, borderRadius: 99,
                            width: `${Math.max(0, Math.min(100, c.Pct_Saldo * 100))}%`,
                            background: ESTADO_COLOR[c.Estado_Saldo],
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
                          {(c.Pct_Saldo * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className={`chip ${
                          c.Estado_Saldo === 'OK' ? 'ok' :
                          c.Estado_Saldo === 'NEGATIVO' || c.Estado_Saldo === 'CRÍTICO' ? 'danger' : 'warn'
                        }`}>
                          {c.Estado_Saldo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráficos laterales */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel">
              <h2>Distribución por estado</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={estadoCount} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={72} innerRadius={28}
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {estadoCount.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2>Top 10 EP Consumido</h2>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={[...contratos].sort((a, b) => b.EP_Consumido_CLP - a.EP_Consumido_CLP).slice(0, 10)}
                  layout="vertical"
                >
                  <XAxis type="number" tickFormatter={v => `$${(v / 1e9).toFixed(0)}MM`}
                    tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="codigo_ctt" type="category" tick={{ fontSize: 9 }} width={75}
                    axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => [clp(Number(v)), 'EP']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="EP_Consumido_CLP" fill="var(--navy-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Gráfico de evolución temporal */}
        {evolucion.length > 0 && (
          <div className="panel">
            <h2>Evolución del EP consumido acumulado</h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              EP acumulado mes a mes en todos los contratos
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolucion} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => mmclp(v)} width={80} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    mmclp(v),
                    name === 'ep_acum' ? 'EP Acumulado' : 'EP del Mes',
                  ]}
                  labelFormatter={l => `Período: ${l}`}
                />
                <Line dataKey="ep_acum" stroke="var(--navy-500)" strokeWidth={2} dot={{ r: 2 }} name="EP Acumulado" />
                <Line dataKey="ep_mes"  stroke="var(--gold-500)" strokeWidth={1.5} dot={false} name="EP del Mes" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </>
  )
}
