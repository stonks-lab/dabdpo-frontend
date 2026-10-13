import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList,
} from 'recharts'
import { getSourcingKpis, getSourcingTabla, getSourcingCoberturaMetros, getSourcingCoberturaDetalle } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

// ── helpers ───────────────────────────────────────────────────────────────────

const MESES_ABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fmtMes = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MESES_ABR[parseInt(mo) - 1]}-${y.slice(2)}`
}
const fmtN = (v: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(v)

const ESTATUS_BADGE: Record<string, string> = {
  TERMINADO:   'bg-slate-100 text-slate-600',
  'EN CURSO':  'bg-blue-100 text-blue-700',
  VIGENTE:     'bg-emerald-100 text-emerald-700',
  PLANIFICADO: 'bg-amber-100 text-amber-700',
}

const ESTADO_CONTRATO_BADGE: Record<string, string> = {
  'Con contrato':               'bg-emerald-100 text-emerald-700',
  'En licitación':              'bg-amber-100 text-amber-700',
  'Sin contrato ni licitación': 'bg-red-100 text-red-600',
}

// ── drill-down tooltip (proyectos) ────────────────────────────────────────────

function ProyectoTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b', maxWidth: 220 }}>{label}</p>
      <p style={{ color: '#334155' }}>Metros: <strong>{fmtN(payload[0].value)} m</strong></p>
    </div>
  )
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function CoberturaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const cub    = payload.find((p: any) => p.dataKey === 'cubiertos')?.value    ?? 0
  const noCub  = payload.find((p: any) => p.dataKey === 'no_cubiertos')?.value ?? 0
  const total  = cub + noCub
  const pct    = total > 0 ? Math.round((cub / total) * 100) : 0
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>{label}</p>
      <p style={{ color: '#16a34a' }}>Cubiertos: <strong>{fmtN(cub)} m</strong></p>
      <p style={{ color: '#ea580c' }}>No cubiertos: <strong>{fmtN(noCub)} m</strong></p>
      <p style={{ color: '#64748b', borderTop: '1px solid #f1f5f9', marginTop: 4, paddingTop: 4 }}>
        Total: {fmtN(total)} m — <strong>{pct}% cubierto</strong>
      </p>
    </div>
  )
}

// ── página ────────────────────────────────────────────────────────────────────

type DrillKey = { mes: string; mesLabel: string; cubierto: boolean }
type DrillData = { por_proyecto: { proyecto: string; metros: number }[]; detalle: any[] }

export default function SourcingPlan() {
  const [kpis,      setKpis]      = useState<any>(null)
  const [tabla,     setTabla]     = useState<any[]>([])
  const [cobertura, setCobertura] = useState<any[]>([])
  const [filtro,        setFiltro]        = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroEstado,   setFiltroEstado]   = useState('')
  const [filtroTipo,     setFiltroTipo]     = useState('')

  const [drill,      setDrill]      = useState<DrillKey | null>(null)
  const [drillData,  setDrillData]  = useState<DrillData | null>(null)
  const [drillLoad,  setDrillLoad]  = useState(false)
  const [drillOpen,  setDrillOpen]  = useState(false)
  const [tablaOpen,  setTablaOpen]  = useState(false)

  useEffect(() => {
    getSourcingKpis().then(setKpis).catch(() => {})
    getSourcingTabla().then(setTabla).catch(() => setTabla([]))
    getSourcingCoberturaMetros().then(setCobertura).catch(() => setCobertura([]))
  }, [])

  const handleSegmentClick = useCallback((cubierto: boolean) => (data: any) => {
    // data.mes contiene YYYY-MM (el campo original preservado en chartData)
    const mesRaw: string = data?.mes ?? ''
    const mesLabel: string = data?.mesLabel ?? mesRaw
    if (!mesRaw) return
    setDrill({ mes: mesRaw, mesLabel, cubierto })
    setDrillData(null)
    setDrillLoad(true)
    setDrillOpen(false)
    getSourcingCoberturaDetalle(mesRaw, cubierto)
      .then(res => {
        if (res && Array.isArray(res.por_proyecto) && Array.isArray(res.detalle)) {
          setDrillData(res)
        } else {
          setDrillData({ por_proyecto: [], detalle: [] })
        }
      })
      .catch(() => setDrillData({ por_proyecto: [], detalle: [] }))
      .finally(() => setDrillLoad(false))
  }, [])

  // KPIs de cobertura derivados del gráfico
  const cobKpis = useMemo(() => {
    const totCub   = cobertura.reduce((s, r) => s + (r.cubiertos    ?? 0), 0)
    const totNoCub = cobertura.reduce((s, r) => s + (r.no_cubiertos ?? 0), 0)
    const total    = totCub + totNoCub
    return { totCub, totNoCub, total, pct: total > 0 ? Math.round((totCub / total) * 100) : 0 }
  }, [cobertura])

  // Preservar mes raw (YYYY-MM) para el drill-down; mesLabel es el texto del eje
  const chartData = cobertura.map(r => ({ ...r, mesLabel: fmtMes(r.mes) }))

  const proyectosUnicos  = useMemo(() => [...new Set(tabla.map((r: any) => r.proyecto).filter(Boolean))].sort() as string[], [tabla])
  const estadosUnicos    = useMemo(() => [...new Set(tabla.map((r: any) => r.estado_contrato).filter(Boolean))].sort() as string[], [tabla])
  const tiposUnicos      = useMemo(() => [...new Set(tabla.map((r: any) => r.tipo).filter(Boolean))].sort() as string[], [tabla])

  const tablaFiltrada = useMemo(() => {
    let rows = tabla
    if (filtroProyecto) rows = rows.filter((r: any) => r.proyecto === filtroProyecto)
    if (filtroEstado)   rows = rows.filter((r: any) => r.estado_contrato === filtroEstado)
    if (filtroTipo)     rows = rows.filter((r: any) => r.tipo === filtroTipo)
    if (!filtro) return rows
    const q = filtro.toLowerCase()
    return rows.filter((r: any) =>
      String(r.contrato        ?? '').toLowerCase().includes(q) ||
      String(r.proyecto        ?? '').toLowerCase().includes(q) ||
      String(r.id_blanco       ?? '').toLowerCase().includes(q) ||
      String(r.alcance         ?? '').toLowerCase().includes(q) ||
      String(r.empresa         ?? '').toLowerCase().includes(q) ||
      String(r.lic             ?? '').toLowerCase().includes(q) ||
      String(r.estado_contrato ?? '').toLowerCase().includes(q)
    )
  }, [tabla, filtro])

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <PageHeader
        title="Sourcing Plan"
        subtitle="Cobertura contractual y metros por proyecto"
        icon="🗺️"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
        <KpiCard label="Proyectos en Plan"    value={kpis.total_proyectos}     color="blue"   icon="📌" />
        <KpiCard label="Contratos únicos"     value={kpis.total_contratos}     color="blue"   icon="📄" />
        <KpiCard label="Metros cubiertos"     value={`${fmtN(cobKpis.totCub)} m`}    color="green"  icon="✅" />
        <KpiCard label="Metros no cubiertos"  value={`${fmtN(cobKpis.totNoCub)} m`}  color="orange" icon="⚠️"
          sub={cobKpis.pct > 0 ? `${cobKpis.pct}% cubierto` : undefined} />
      </div>

      {/* Filtros */}
      <div className="filters-bar px-4 pb-3" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          type="text" placeholder="Buscar contrato, proyecto, alcance…" value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ flex: '1 1 200px', fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}
        />
        {[
          { key: 'proyecto', label: 'Proyecto',         opts: proyectosUnicos, val: filtroProyecto, set: setFiltroProyecto },
          { key: 'tipo',     label: 'Tipo contrato',    opts: tiposUnicos,     val: filtroTipo,     set: setFiltroTipo     },
          { key: 'estado',   label: 'Estado contrato',  opts: estadosUnicos,   val: filtroEstado,   set: setFiltroEstado   },
        ].map(({ key, label, opts, val, set }) => opts.length > 0 && (
          <select key={key} value={val} onChange={e => set(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}>
            <option value="">— {label} —</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {(filtro || filtroProyecto || filtroEstado || filtroTipo) && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }}
            onClick={() => { setFiltro(''); setFiltroProyecto(''); setFiltroEstado(''); setFiltroTipo('') }}>
            ✕ Limpiar
          </button>
        )}
        <span style={{ fontSize: 12, color: '#9aa1b3', marginLeft: 'auto' }}>{tablaFiltrada.length} contratos</span>
      </div>

      {/* Gráfico cobertura de metros */}
      <div className="px-4 pb-4">
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-500)' }}>
              Metros por mes — cobertura contractual
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Haz clic en una barra para ver el detalle</span>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
              {[
                { color: '#16a34a', label: 'Cubiertos' },
                { color: '#ea580c', label: 'No cubiertos' },
              ].map(({ color, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {cobertura.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              Sin datos de metros. Verificá que PAI_Proyectos esté disponible.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} barCategoryGap="25%" margin={{ left: 10 }}
                style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip content={<CoberturaTooltip />} />
                <Bar dataKey="cubiertos" name="Cubiertos" stackId="a" radius={[0, 0, 0, 0]}
                  fill={drill?.cubierto === true ? '#15803d' : '#16a34a'}
                  onClick={handleSegmentClick(true)} />
                <Bar dataKey="no_cubiertos" name="No cubiertos" stackId="a" radius={[3, 3, 0, 0]}
                  fill={drill?.cubierto === false ? '#c2410c' : '#ea580c'}
                  onClick={handleSegmentClick(false)} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Drill-down panel */}
      {drill && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">

            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">
                Detalle — metros{' '}
                <span className={drill.cubierto ? 'text-emerald-600' : 'text-orange-600'}>
                  {drill.cubierto ? 'cubiertos' : 'no cubiertos'}
                </span>
                {' '}· {drill.mesLabel}
              </span>
              {drillLoad && (
                <span className="text-xs text-gray-400">Cargando…</span>
              )}
              <button
                onClick={() => { setDrill(null); setDrillData(null) }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-slate-200 rounded-lg px-2.5 py-1"
              >
                Cerrar ✕
              </button>
            </div>

            {!drillLoad && drillData && Array.isArray(drillData.por_proyecto) && (
              <>
                <div className="border-t border-slate-100" />

                {/* Gráfico — siempre visible */}
                {drillData.por_proyecto.length > 0 && (
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Metros por proyecto</p>
                    <ResponsiveContainer width="100%" height={Math.min(drillData.por_proyecto.length * 28 + 20, 320)}>
                      <BarChart
                        data={drillData.por_proyecto.slice(0, 15)}
                        layout="vertical"
                        margin={{ left: 10, right: 60, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number"
                          tickFormatter={(v: any) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                          tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="proyecto" width={180}
                          tick={{ fontSize: 10, fill: '#374151' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ProyectoTooltip />} />
                        <Bar dataKey="metros" fill={drill.cubierto ? '#16a34a' : '#ea580c'} radius={[0, 3, 3, 0]}>
                          <LabelList dataKey="metros" position="right"
                            style={{ fontSize: 10, fill: '#6b7280' }}
                            formatter={(v: any) => fmtN(Number(v))} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tabla — colapsable */}
                <div
                  className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 cursor-pointer select-none hover:bg-slate-50/60 transition-colors"
                  onClick={() => setDrillOpen(o => !o)}
                >
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{drillOpen ? '▾' : '▸'}</span>
                  <span className="text-xs font-semibold text-gray-600">Tabla de contratos</span>
                  <span className="text-xs text-gray-400">{(drillData.detalle ?? []).length} filas</span>
                </div>

                {drillOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Estado Contrato</th>
                          <th className="px-3 py-2.5 text-left">Proyecto</th>
                          <th className="px-3 py-2.5 text-left">ID Blanco</th>
                          <th className="px-3 py-2.5 text-left">Contrato</th>
                          <th className="px-3 py-2.5 text-left">Licitación</th>
                          <th className="px-3 py-2.5 text-left">Inicio</th>
                          <th className="px-3 py-2.5 text-left">Término</th>
                          <th className="px-3 py-2.5 text-right">Metros Plan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(drillData.detalle ?? []).map((r: any, i: number) => (
                          <tr key={i}
                            className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTADO_CONTRATO_BADGE[r.estado_contrato] ?? 'bg-gray-100 text-gray-500'}`}>
                                {r.estado_contrato || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[160px] truncate text-gray-700" title={r.proyecto}>{r.proyecto || '—'}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{r.id_blanco || '—'}</td>
                            <td className="px-3 py-2 font-mono text-blue-600">{r.contrato || '—'}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{r.lic || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.inicio || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.termino || '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {r.metros_plan ? fmtN(Number(r.metros_plan)) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!Array.isArray(drillData.detalle) || drillData.detalle.length === 0) && (
                      <p className="text-xs text-gray-400 text-center py-6">Sin datos para esta selección</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabla Sourcing Plan */}
      <div className="px-4 pb-6" style={{ marginTop: drill ? 8 : 0 }}>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          {/* Header — clic para colapsar/expandir */}
          <div
            className="px-4 py-3 flex items-center gap-3 flex-wrap cursor-pointer select-none hover:bg-slate-50/60 transition-colors"
            onClick={() => setTablaOpen(o => !o)}
          >
            <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1 }}>
              {tablaOpen ? '▾' : '▸'}
            </span>
            <span className="text-sm font-semibold text-gray-700">Contratos del Plan</span>
            <span className="text-xs text-gray-400">{tabla.length} contratos</span>
            {tablaOpen && (
              <input
                type="text"
                placeholder="Filtrar contrato, proyecto, alcance…"
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="ml-auto text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 w-56"
              />
            )}
          </div>

          {tablaOpen && (
            <>
              <div className="border-t border-slate-100" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Estatus</th>
                      <th className="px-3 py-2.5 text-left">Estado Contrato</th>
                      <th className="px-3 py-2.5 text-left">ID Blanco</th>
                      <th className="px-3 py-2.5 text-left">Proyecto</th>
                      <th className="px-3 py-2.5 text-left">Alcance</th>
                      <th className="px-3 py-2.5 text-left">Contrato</th>
                      <th className="px-3 py-2.5 text-left">Licitación</th>
                      <th className="px-3 py-2.5 text-left">Empresa</th>
                      <th className="px-3 py-2.5 text-left">Tipo</th>
                      <th className="px-3 py-2.5 text-left">Inicio</th>
                      <th className="px-3 py-2.5 text-left">Término</th>
                      <th className="px-3 py-2.5 text-right">Metros Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tablaFiltrada.slice(0, 300).map((r: any, i: number) => (
                      <tr
                        key={i}
                        className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 ? 'bg-slate-50/30' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTATUS_BADGE[r.estatus] ?? 'bg-gray-100 text-gray-500'}`}>
                            {r.estatus || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTADO_CONTRATO_BADGE[r.estado_contrato] ?? 'bg-gray-100 text-gray-500'}`}>
                            {r.estado_contrato || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.id_blanco || '—'}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate text-gray-700" title={r.proyecto}>{r.proyecto || '—'}</td>
                        <td className="px-3 py-2 max-w-[130px] truncate text-gray-500" title={r.alcance}>{r.alcance || '—'}</td>
                        <td className="px-3 py-2 font-mono text-blue-600">{r.contrato || '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{r.lic || '—'}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate text-gray-500" title={r.empresa}>{r.empresa || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.tipo || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.inicio || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.termino || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {r.cantidad_total_plan ? fmtN(Number(r.cantidad_total_plan)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tablaFiltrada.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Sin resultados para el filtro aplicado</p>
                )}
                {tablaFiltrada.length > 300 && (
                  <p className="text-xs text-gray-400 text-center py-2 bg-slate-50">
                    Mostrando 300 de {tablaFiltrada.length} filas
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
