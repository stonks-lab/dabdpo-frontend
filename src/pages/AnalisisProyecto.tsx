import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getAnalisisKpis, getAnalisisPorProyecto, getAnalisisTabla, getEstadoProyectosTimeline, getSaldoTimeline } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const mmclp = (v: number) => `$${(v / 1e9).toFixed(2)} MM`
const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

// ── Timeline helpers ──────────────────────────────────────────────────────────
const MESES_ABR_A = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fmtMesA = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MESES_ABR_A[parseInt(mo) - 1]}-${y.slice(2)}`
}
const fmtMMA = (v: number): string => {
  if (!isFinite(v)) return '—'
  const abs = Math.abs(v), s = v < 0 ? '−' : ''
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}MM`
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`
  return `${s}$${abs.toFixed(0)}`
}
const proyBgA = (mi: number, mesActualIdx: number, agotIdx: number | null): string => {
  if (mi === mesActualIdx) return '#bfdbfe'
  if (mi < mesActualIdx)  return '#f0fdf4'
  if (agotIdx === null)   return '#f0fdf4'
  if (mi >= agotIdx)      return '#fee2e2'
  if (mi >= agotIdx - 6)  return '#fef9c3'
  return '#f0fdf4'
}
const TL_STICKY_A = [
  { label: 'Proyecto', left: 0,   minW: 160, field: 'proyecto'        },
  { label: 'Ctrs',     left: 160, minW: 52,  field: 'n_contratos'     },
  { label: 'Agota en', left: 212, minW: 82,  field: 'mes_agotamiento' },
]

const PALETTE = [
  '#1e40af','#2563eb','#3b82f6','#1d4ed8','#1a56db',
  '#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e',
]

export default function AnalisisProyecto() {
  const [kpis,        setKpis]        = useState<any>(null)
  const [porProyecto, setPorProyecto] = useState<any[]>([])
  const [tabla,       setTabla]       = useState<any[]>([])
  const [proyectoSel, setProyectoSel] = useState('')

  const [proyTimeline,        setProyTimeline]        = useState<any>(null)
  const [proyTimelineLoading, setProyTimelineLoading] = useState(true)
  const [proyProyecciones,    setProyProyecciones]    = useState<string[]>(['P&C'])
  const [expandedProys,       setExpandedProys]       = useState<Set<string>>(new Set())
  const [contractData,        setContractData]        = useState<Record<string, any>>({})
  const [contractLoading,     setContractLoading]     = useState<Set<string>>(new Set())
  const [proySortCol,         setProySortCol]         = useState<string>('')
  const [proySortDir,         setProySortDir]         = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    getAnalisisKpis().then(setKpis)
    getAnalisisPorProyecto().then(setPorProyecto)
  }, [])

  useEffect(() => {
    setProyTimelineLoading(true)
    setContractData({})
    setExpandedProys(new Set())
    const params: Record<string, string> = {}
    if (proyProyecciones.length > 0) params.tipo_proyeccion = proyProyecciones.join(',')
    getEstadoProyectosTimeline(params)
      .then(setProyTimeline)
      .catch(() => setProyTimeline(null))
      .finally(() => setProyTimelineLoading(false))
  }, [proyProyecciones])

  const toggleProySort = (field: string) => {
    if (proySortCol === field) setProySortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setProySortCol(field); setProySortDir('asc') }
  }

  const sortedProyectos = useMemo(() => {
    if (!proyTimeline?.proyectos) return []
    // Pre-computar agotIdx desde saldos_min — garantiza match con la visual
    const enriched = (proyTimeline.proyectos as any[]).map((proy: any) => {
      // _agotIdx: primer mes futuro con saldos_min ≤ 0 → solo para colorear celdas
      let agotIdx: number | null = null
      for (let i = proyTimeline.mes_actual_idx + 1; i < proy.saldos_min.length; i++) {
        if (proy.saldos_min[i] <= 0) { agotIdx = i; break }
      }
      return { ...proy, _agotIdx: agotIdx }
    })
    const sortKey = (p: any) => {
      if (proySortCol === 'proyecto')        return p.proyecto
      if (proySortCol === 'n_contratos')     return p.n_contratos
      if (proySortCol === 'mes_agotamiento') return p.mes_agotamiento || '9999-12'
      return p.mes_agotamiento || '9999-12'  // default: orden por urgencia
    }
    return [...enriched].sort((a, b) => {
      const av = sortKey(a), bv = sortKey(b)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return proySortDir === 'asc' ? cmp : -cmp
    })
  }, [proyTimeline, proySortCol, proySortDir])

  const toggleProject = async (proy: any) => {
    const key = proy.proyecto
    if (expandedProys.has(key)) {
      setExpandedProys(prev => { const s = new Set(prev); s.delete(key); return s })
      return
    }
    setExpandedProys(prev => new Set([...prev, key]))
    if (contractData[key] !== undefined) return
    setContractLoading(prev => new Set([...prev, key]))
    try {
      const params: Record<string, string> = { contrato: proy.contratos.join(',') }
      if (proyProyecciones.length > 0) params.tipo_proyeccion = proyProyecciones.join(',')
      const data = await getSaldoTimeline(params)
      setContractData(prev => ({ ...prev, [key]: data }))
    } catch {
      setContractData(prev => ({ ...prev, [key]: null }))
    } finally {
      setContractLoading(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  useEffect(() => {
    getAnalisisTabla(proyectoSel ? { proyecto: proyectoSel } : {}).then(setTabla)
  }, [proyectoSel])

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  const chartData = porProyecto.slice(0, 20).map((p, i) => ({
    ...p,
    _fill: PALETTE[i % PALETTE.length],
  }))

  const promedio = kpis.proyectos_con_ep > 0
    ? kpis.ep_total_clp / kpis.proyectos_con_ep
    : 0

  return (
    <div>
      <PageHeader
        title="Análisis por Proyecto"
        subtitle="EP consumido por proyecto y contrato"
        icon="🔬"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <KpiCard label="Proyectos con EP" value={kpis.proyectos_con_ep}    color="blue"   icon="🏗️" />
        <KpiCard label="EP Total"         value={mmclp(kpis.ep_total_clp)} color="blue"   icon="💵" />
        <KpiCard label="Contratos con EP" value={kpis.contratos_con_ep}    color="green"  icon="📄" />
        <KpiCard label="EP prom. / proyecto" value={mmclp(promedio)}       color="orange" icon="📐" />
      </div>

      {/* ── Proyección de saldo mínimo por proyecto ───────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm" style={{ padding: 0 }}>

          {/* Cabecera */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#001f3f' }}>
              Proyección de Saldo mínimo por Proyecto
            </span>
            {proyTimeline && (
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>
                {proyTimeline.proyectos.length} proyectos
              </span>
            )}

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { bg: '#f0fdf4', bd: '#bbf7d0', label: 'Sin riesgo' },
                { bg: '#bfdbfe', bd: '#93c5fd', label: 'Mes actual' },
                { bg: '#fef9c3', bd: '#fde68a', label: '≤6 meses'  },
                { bg: '#fee2e2', bd: '#fca5a5', label: 'Sin saldo'  },
              ].map(({ bg, bd, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9aa1b3' }}>
                  <span style={{ width: 11, height: 11, background: bg, border: `1px solid ${bd}`, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>

            {/* Selector proyección */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#9aa1b3', marginRight: 2 }}>Proyección:</span>
              {(['P&C', 'AdC', 'Lineal'] as const).map(t => {
                const activo = proyProyecciones.includes(t)
                return (
                  <button key={t}
                    style={{
                      fontSize: 11, padding: '2px 9px', borderRadius: 4, cursor: 'pointer',
                      border: activo ? '1px solid #001f3f' : '1px solid #e5e7eb',
                      background: activo ? '#001f3f' : '#fff',
                      color: activo ? '#fff' : '#6b7280',
                    }}
                    onClick={() => setProyProyecciones(prev =>
                      activo ? prev.filter(x => x !== t) : [...prev, t]
                    )}
                  >{t}</button>
                )
              })}
            </div>
          </div>

          {/* Cuerpo */}
          {proyTimelineLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              Calculando proyección…
            </div>
          ) : !proyTimeline || proyTimeline.proyectos.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              Sin datos de proyectos disponibles.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead>
                  <tr>
                    {TL_STICKY_A.map((col, ci) => (
                      <th key={col.label}
                        onClick={() => toggleProySort(col.field)}
                        style={{
                          position: 'sticky', top: 0, left: col.left, zIndex: 5,
                          minWidth: col.minW, padding: '7px 8px',
                          background: '#f9fafb', whiteSpace: 'nowrap',
                          borderBottom: '2px solid #e5e7eb', textAlign: 'left',
                          boxShadow: ci === TL_STICKY_A.length - 1 ? '3px 0 6px rgba(0,0,0,.07)' : undefined,
                          cursor: 'pointer', userSelect: 'none',
                        }}>
                        {col.label}
                        <span style={{ marginLeft: 3, opacity: proySortCol === col.field ? 1 : 0.3, color: proySortCol === col.field ? '#f59e0b' : undefined }}>
                          {proySortCol === col.field ? (proySortDir === 'asc' ? '↑' : '↓') : '⇅'}
                        </span>
                      </th>
                    ))}
                    {proyTimeline.meses.map((m: string) => (
                      <th key={m} style={{
                        position: 'sticky', top: 0, zIndex: 3,
                        minWidth: 63, padding: '7px 4px', textAlign: 'center',
                        background:  m === proyTimeline.mes_actual ? '#bfdbfe' : '#f9fafb',
                        color:       m === proyTimeline.mes_actual ? '#1e40af' : '#9aa1b3',
                        fontWeight:  m === proyTimeline.mes_actual ? 700 : 400,
                        borderBottom: '2px solid #e5e7eb',
                        borderLeft:  m === proyTimeline.mes_actual ? '2px solid #93c5fd' : undefined,
                        whiteSpace: 'nowrap',
                      }}>
                        {fmtMesA(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedProyectos.map((proy: any) => {
                    const agotIdx = proy._agotIdx ?? null
                    const expanded = expandedProys.has(proy.proyecto)
                    const loading  = contractLoading.has(proy.proyecto)
                    const ctData   = contractData[proy.proyecto]
                    const bd       = '1px solid #f0f0f0'
                    const rowBg    = '#fff'

                    // Lookup de saldo por mes para cada contrato del detalle
                    const cttSalMap = (ctt: any): Map<string, number> => {
                      const map = new Map<string, number>()
                      if (!ctData) return map
                      ctData.meses.forEach((m: string, i: number) => map.set(m, ctt.saldos[i]))
                      return map
                    }

                    return (
                      <React.Fragment key={proy.proyecto}>
                        {/* Fila proyecto */}
                        <tr
                          onClick={() => toggleProject(proy)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ position: 'sticky', left: 0, zIndex: 2, background: rowBg, padding: '5px 8px', fontWeight: 700, borderBottom: bd, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={proy.proyecto}>
                            <span style={{ marginRight: 5, fontSize: 9, color: '#9aa1b3' }}>{expanded ? '▼' : '▶'}</span>
                            {proy.proyecto}
                          </td>
                          <td style={{ position: 'sticky', left: 160, zIndex: 2, background: rowBg, padding: '5px 8px', textAlign: 'right', color: '#9aa1b3', borderBottom: bd }}>
                            {proy.n_contratos}
                          </td>
                          <td style={{ position: 'sticky', left: 212, zIndex: 2, background: rowBg, padding: '5px 8px', boxShadow: '3px 0 6px rgba(0,0,0,.07)', borderBottom: bd }}>
                            {proy.mes_agotamiento ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}
                                title={proy.contrato_critico ? `Cuello de botella: ${proy.contrato_critico}` : undefined}>
                                {fmtMesA(proy.mes_agotamiento)}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: '#16a34a' }}>OK</span>
                            )}
                          </td>
                          {proyTimeline.meses.map((m: string, mi: number) => {
                            const saldo = proy.saldos_min[mi]
                            return (
                              <td key={m} style={{
                                minWidth: 63, padding: '5px 5px', textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums', fontSize: 10,
                                background: proyBgA(mi, proyTimeline.mes_actual_idx, agotIdx),
                                color: saldo < 0 ? '#dc2626' : saldo < 1e6 ? '#b45309' : undefined,
                                borderLeft: m === proyTimeline.mes_actual ? '2px solid #93c5fd' : undefined,
                                borderBottom: bd,
                              }}
                              title={`${proy.proyecto} · ${m}: ${fmtMMA(saldo)}${proy.contrato_critico && agotIdx !== null && mi >= agotIdx ? ` — cuello de botella: ${proy.contrato_critico}` : ''}`}
                              >
                                {fmtMMA(saldo)}
                              </td>
                            )
                          })}
                        </tr>

                        {/* Filas de contratos (detalle) */}
                        {expanded && (
                          loading || !ctData ? (
                            <tr>
                              <td colSpan={3 + proyTimeline.meses.length}
                                style={{ paddingLeft: 28, paddingTop: 6, paddingBottom: 6, fontSize: 11, color: '#9aa1b3', background: '#fafafa', borderBottom: bd }}>
                                {loading ? 'Cargando contratos…' : 'Sin datos'}
                              </td>
                            </tr>
                          ) : (
                            ctData.contratos.map((ctt: any) => {
                              const cttAgotIdx = ctt.mes_agotamiento ? proyTimeline.meses.indexOf(ctt.mes_agotamiento) : null
                              const salMap     = cttSalMap(ctt)
                              const isCritico  = ctt.codigo_ctt === proy.contrato_critico
                              return (
                                <tr key={ctt.codigo_ctt} style={{ background: '#fafafa' }}>
                                  {/* Contrato */}
                                  <td style={{ position: 'sticky', left: 0, zIndex: 2, background: '#fafafa', padding: '4px 8px 4px 22px', borderBottom: bd, whiteSpace: 'nowrap', maxWidth: 160 }}
                                    title={`${ctt.codigo_ctt} — ${ctt.descripcion}${ctt.tipo ? ` (${ctt.tipo})` : ''}`}>
                                    <span style={{ fontSize: 9, color: '#cbd5e1', marginRight: 4 }}>└</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: isCritico ? 700 : 400, color: isCritico ? '#dc2626' : '#374151' }}>
                                      {ctt.codigo_ctt}
                                    </span>
                                    {ctt.tipo && (
                                      <span style={{
                                        marginLeft: 5, fontSize: 9, padding: '1px 5px',
                                        borderRadius: 3, background: isCritico ? '#fef2f2' : '#eff6ff',
                                        color: isCritico ? '#dc2626' : '#2563eb',
                                        border: `1px solid ${isCritico ? '#fecaca' : '#bfdbfe'}`,
                                        fontFamily: 'sans-serif', fontWeight: 400,
                                      }}>
                                        {ctt.tipo}
                                      </span>
                                    )}
                                  </td>
                                  {/* Ctrs (vacío en sub-fila) */}
                                  <td style={{ position: 'sticky', left: 160, zIndex: 2, background: '#fafafa', borderBottom: bd }} />
                                  {/* Agota en */}
                                  <td style={{ position: 'sticky', left: 212, zIndex: 2, background: '#fafafa', padding: '4px 8px', boxShadow: '3px 0 6px rgba(0,0,0,.07)', borderBottom: bd }}>
                                    {ctt.mes_agotamiento ? (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>{fmtMesA(ctt.mes_agotamiento)}</span>
                                    ) : (
                                      <span style={{ fontSize: 10, color: '#16a34a' }}>OK</span>
                                    )}
                                  </td>
                                  {/* Celdas de meses */}
                                  {proyTimeline.meses.map((m: string, mi: number) => {
                                    const saldo  = salMap.get(m) ?? 0
                                    const isMin  = Math.abs(saldo - proy.saldos_min[mi]) < 1
                                    const bg     = proyBgA(mi, proyTimeline.mes_actual_idx, cttAgotIdx)
                                    return (
                                      <td key={m} style={{
                                        minWidth: 63, padding: '4px 5px', textAlign: 'right',
                                        fontVariantNumeric: 'tabular-nums', fontSize: 10,
                                        background: bg,
                                        fontWeight: isMin ? 700 : 400,
                                        color: saldo < 0 ? '#dc2626' : saldo < 1e6 ? '#b45309' : '#374151',
                                        borderLeft:   m === proyTimeline.mes_actual ? '2px solid #93c5fd' : undefined,
                                        borderBottom: isMin ? '2px solid #3b82f6' : bd,
                                        outline: isMin ? '1px solid rgba(59,130,246,.35)' : undefined,
                                        outlineOffset: isMin ? '-1px' : undefined,
                                      }}
                                      title={`${ctt.codigo_ctt} · ${m}: ${fmtMMA(saldo)}${isMin ? ' ← mínimo' : ''}`}
                                      >
                                        {fmtMMA(saldo)}
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })
                          )
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de barras por proyecto */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            EP Consumido por Proyecto — Top {Math.min(porProyecto.length, 20)} (MM CLP)
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis
                type="number"
                tickFormatter={v => `$${(v / 1e9).toFixed(0)}MM`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="Proyecto"
                type="category"
                tick={{ fontSize: 10, fill: '#374151' }}
                width={170}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [clp(Number(v)), 'EP Consumido']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="EP_Consumido_CLP" radius={[0, 5, 5, 0]}>
                {chartData.map((p, i) => <Cell key={i} fill={p._fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de contratos */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-gray-700">Contratos por Proyecto</span>
            <select
              value={proyectoSel}
              onChange={e => setProyectoSel(e.target.value)}
              className="ml-auto text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 shadow-xs"
            >
              <option value="">Todos los proyectos</option>
              {porProyecto.map((p: any) => (
                <option key={p.Proyecto} value={p.Proyecto}>{p.Proyecto}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">Proyecto</th>
                  <th className="px-3 py-2.5 text-left">Contrato</th>
                  <th className="px-3 py-2.5 text-left">Descripción</th>
                  <th className="px-3 py-2.5 text-left">Tipo</th>
                  <th className="px-3 py-2.5 text-left">Área</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-right">EP Consumido</th>
                  <th className="px-3 py-2.5 text-right"># EPs</th>
                </tr>
              </thead>
              <tbody>
                {tabla.slice(0, 300).map((r: any, i: number) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-50 hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                  >
                    <td className="px-3 py-2 font-semibold text-blue-700 max-w-[130px] truncate" title={r.Proyecto}>
                      {r.Proyecto}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">{r.codigo_ctt}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate text-gray-600" title={r.Descripcion_ctt}>
                      {r.Descripcion_ctt}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.Tipo_contrato}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Area_contrato}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.Estado_ctt === 'Vigente'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {r.Estado_ctt || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">
                      {mmclp(r.EP_Consumido_CLP)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.Num_EPs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tabla.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
