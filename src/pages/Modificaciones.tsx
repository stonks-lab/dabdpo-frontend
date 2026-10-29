import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getMondayKpis, getMondayTabla, getMondayFiltros, getMondayTendencia, getMondayTendenciaRazones } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const clp = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
const mmclp = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)} MM` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)} M` : clp(v)

function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null
  const da = new Date(a), db = new Date(b)
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

function diasColor(d: number): string {
  if (d <= 7)  return 'var(--success-500)'
  if (d <= 14) return 'var(--warning-500)'
  return 'var(--error-500)'
}

function DiasCell({ estado, dias }: { estado: string; dias: number | null }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {estado ? estadoChip(estado) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
      {dias !== null && (
        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: diasColor(dias) }}>
          {dias} día{dias !== 1 ? 's' : ''}
        </div>
      )}
      {dias === null && estado && !estado.toLowerCase().includes('aprobad') && !estado.toLowerCase().includes('rechaz') && (
        <div style={{ fontSize: 10, color: 'var(--gray-300)', marginTop: 3 }}>en curso</div>
      )}
    </div>
  )
}

function estadoChip(estado: string) {
  const e = estado.toLowerCase()
  if (e.includes('aprobad'))
    return <span className="chip ok">{estado}</span>
  if (e.includes('rechaz'))
    return <span className="chip danger">{estado}</span>
  if (e.includes('pendiente') || e.includes('revisión') || e.includes('revision') || e.includes('proceso') || e.includes('espera'))
    return <span className="chip warn">{estado}</span>
  return <span className="chip navy">{estado || '—'}</span>
}

const TIPO_COLORS = [
  'var(--navy-400)', 'var(--gold-500)', 'var(--warning-500)',
  'var(--success-500)', 'var(--info-500)', 'var(--error-500)',
  'var(--navy-300)', 'var(--gray-400)',
]

const TABS = ['Resumen', 'Detalle', 'Tiempos', 'Tendencia'] as const
type Tab = typeof TABS[number]

interface Filters { tipo: string; estado: string; proyecto: string; contrato: string; area: string }

export default function Modificaciones() {
  const [tab,       setTab]      = useState<Tab>('Resumen')
  const [kpis,      setKpis]     = useState<any>(null)
  const [tendencia,      setTendencia]     = useState<any[]>([])
  const [tendenciaRazones, setTendenciaRazones] = useState<{ razones: string[]; datos: any[]; variacion: any[]; mes_inicio: string | null; mes_fin: string | null }>({ razones: [], datos: [], variacion: [], mes_inicio: null, mes_fin: null })
  const [trDesde, setTrDesde] = useState('')
  const [trHasta, setTrHasta] = useState('')
  const [filtros,   setFiltros]  = useState<any>(null)
  const [tabla,     setTabla]    = useState<any[]>([])
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState('')
  const [filters,   setFilters]  = useState<Filters>({ tipo: '', estado: '', proyecto: '', contrato: '', area: '' })
  const [selectedTipo, setSelectedTipo] = useState<string | null>(null)
  const [tipoTabla,    setTipoTabla]    = useState<any[]>([])
  const [tipoLoading,  setTipoLoading]  = useState(false)

  const [selectedProyecto, setSelectedProyecto] = useState<string | null>(null)
  const [proyectoTabla,    setProyectoTabla]    = useState<any[]>([])
  const [proyectoLoading,  setProyectoLoading]  = useState(false)

  const [selectedAprobador, setSelectedAprobador] = useState<{ aprobador: string; cat: string } | null>(null)
  const [aprobadorTabla,    setAprobadorTabla]    = useState<any[]>([])
  const [aprobadorLoading,  setAprobadorLoading]  = useState(false)

  const [varSort, setVarSort] = useState<{ col: string; dir: 1 | -1 }>({ col: 'razon', dir: 1 })

  useEffect(() => {
    setLoading(true)
    Promise.all([getMondayKpis(), getMondayFiltros(), getMondayTendencia()])
      .then(([k, f, t]) => { setKpis(k); setFiltros(f); setTendencia(t) })
      .catch(err => setError(`Error al conectar con Monday.com: ${err?.response?.data?.detail ?? err.message}`))
      .finally(() => setLoading(false))

    getMondayTendenciaRazones()
      .then(tr => setTendenciaRazones(tr))
      .catch(() => {})
  }, [])

  const fetchTendenciaRazones = useCallback(() => {
    const p: Record<string, string> = {}
    if (trDesde) p.desde = trDesde
    if (trHasta) p.hasta = trHasta
    getMondayTendenciaRazones(p)
      .then(tr => setTendenciaRazones(tr))
      .catch(() => {})
  }, [trDesde, trHasta])

  const fetchTabla = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    getMondayTabla(params).then(setTabla).catch(() => setTabla([]))
  }, [filters])

  useEffect(() => {
    if (tab === 'Detalle' || tab === 'Tiempos') fetchTabla()
  }, [tab, fetchTabla])

  const handleTipoClick = useCallback((entry: any) => {
    const tipo = entry?.name ?? entry?.tipo ?? ''
    if (!tipo) return
    if (selectedTipo === tipo) { setSelectedTipo(null); setTipoTabla([]); return }
    setSelectedTipo(tipo)
    setTipoLoading(true)
    getMondayTabla({ tipo }).then(setTipoTabla).finally(() => setTipoLoading(false))
  }, [selectedTipo])

  const handleProyectoClick = useCallback((data: any) => {
    const proyecto = data?.proyecto ?? data?.activePayload?.[0]?.payload?.proyecto ?? ''
    if (!proyecto) return
    if (selectedProyecto === proyecto) { setSelectedProyecto(null); setProyectoTabla([]); return }
    setSelectedProyecto(proyecto)
    setProyectoLoading(true)
    getMondayTabla({ proyecto }).then(setProyectoTabla).finally(() => setProyectoLoading(false))
  }, [selectedProyecto])

  const CAT_LABEL: Record<string, string> = { aprobados: 'Aprobados', por_aprobar: 'Por aprobar', rechazados: 'Rechazados' }
  const CAT_API:   Record<string, string> = { aprobados: 'aprobado',  por_aprobar: 'por_aprobar',  rechazados: 'rechazado'  }
  const APROBADOR_FIELD: Record<string, string> = {
    'Supervisor de Abastecimiento': 'estado_supervisor',
    'DPO':                          'estado_dpo',
    'P&C':                          'estado_pyc',
  }

  const handleAprobadorClick = useCallback((cat: string) => (data: any) => {
    const aprobador = data?.aprobador ?? data?.activePayload?.[0]?.payload?.aprobador ?? ''
    if (!aprobador) return
    if (selectedAprobador?.aprobador === aprobador && selectedAprobador?.cat === cat) {
      setSelectedAprobador(null); setAprobadorTabla([]); return
    }
    setSelectedAprobador({ aprobador, cat })
    setAprobadorLoading(true)
    getMondayTabla({ aprobador, estado_cat: CAT_API[cat] ?? cat }).then(setAprobadorTabla).finally(() => setAprobadorLoading(false))
  }, [selectedAprobador])

  return (
    <>
      <PageHeader
        title="Modificaciones de Contratos"
        subtitle={`EMSA · Monday.com · ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`}
        icon="🔄"
      />

      {error && (
        <div className="page" style={{ flex: 'none', paddingBottom: 0 }}>
          <div className="alert-banner">{error}</div>
        </div>
      )}

      {loading && <div className="loading">Consultando Monday.com...</div>}

      {!loading && kpis && (
        <>
          {/* KPIs */}
          <div className="page" style={{ flex: 'none', paddingBottom: 0 }}>
            <div className="kpi-grid">
              <KpiCard label="Total Solicitudes"   value={kpis.total}          color="blue" />
              <KpiCard label="Aprobadas"           value={kpis.aprobados}      color="green" />
              <KpiCard label="En Proceso"          value={kpis.pendientes}     color="yellow" />
              <KpiCard label="Rechazadas"          value={kpis.rechazados}     color="red" />
              <KpiCard label="Impacto Monto"       value={mmclp(kpis.monto_total)} color="gold" sub="suma CLP" />
              <KpiCard
                label="Tasa Aprobación"
                value={kpis.total > 0 ? `${((kpis.aprobados / kpis.total) * 100).toFixed(0)}%` : '—'}
                color={kpis.total > 0 && (kpis.aprobados / kpis.total) >= 0.7 ? 'green' : 'orange'}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="page" style={{ paddingTop: 10 }}>
            <div className="tabs">
              {TABS.map(t => (
                <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>

            {/* ── Resumen ── */}
            {tab === 'Resumen' && (
              <>
                <div className="two-col">
                  <section className="panel">
                    <h2>Por Tipo de Modificación</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={kpis.por_tipo}
                          dataKey="cantidad"
                          nameKey="tipo"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          onClick={handleTipoClick}
                          style={{ cursor: 'pointer' }}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                            if (percent < 0.04) return null
                            const RADIAN = Math.PI / 180
                            const r = innerRadius + (outerRadius - innerRadius) * 0.5
                            const x = cx + r * Math.cos(-midAngle * RADIAN)
                            const y = cy + r * Math.sin(-midAngle * RADIAN)
                            return (
                              <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                                style={{ fontSize: 11, fontWeight: 700, fill: '#fff', pointerEvents: 'none' }}>
                                {`${(percent * 100).toFixed(0)}%`}
                              </text>
                            )
                          }}
                          labelLine={false}
                        >
                          {kpis.por_tipo.map((_: any, idx: number) => (
                            <Cell key={idx} fill={TIPO_COLORS[idx % TIPO_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, name: any) => [v, name]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span style={{ fontSize: 11, color: 'var(--gray-700)' }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </section>

                  <section className="panel">
                    <h2>Por Proyecto</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={kpis.por_proyecto} layout="vertical" margin={{ right: 16 }} style={{ cursor: 'pointer' }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis dataKey="proyecto" type="category" tick={{ fontSize: 11, fill: 'var(--gray-700)' }} width={160} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                        <Bar dataKey="cantidad" fill="var(--navy-300)" radius={[0, 5, 5, 0]} onClick={handleProyectoClick}
                          label={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>
                </div>

                {selectedTipo && (
                  <section className="panel" style={{ marginTop: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h2 style={{ margin: 0 }}>
                        {selectedTipo}
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>
                          {tipoLoading ? 'cargando…' : `${tipoTabla.length} proceso${tipoTabla.length !== 1 ? 's' : ''}`}
                        </span>
                      </h2>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => { setSelectedTipo(null); setTipoTabla([]) }}>✕ Cerrar</button>
                    </div>
                    {tipoLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-400)', fontSize: 13 }}>Cargando procesos…</div>
                    ) : (
                      <div className="scroll-x">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Contrato</th>
                              <th>Proyecto</th>
                              <th>Descripción</th>
                              <th>Estado</th>
                              <th>Est. DPO</th>
                              <th>Impacto Monto</th>
                              <th>F. Solicitud</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tipoTabla.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                            ) : tipoTabla.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</td>
                                <td style={{ fontSize: 11 }}>{row.proyecto || '—'}</td>
                                <td style={{ fontSize: 10, color: 'var(--gray-500)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || row.nombre || '—'}</td>
                                <td>{estadoChip(row.estado)}</td>
                                <td>{row.estado_dpo ? estadoChip(row.estado_dpo) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                                <td style={{ fontWeight: 700, color: row.impacto_monto_clp > 0 ? 'var(--navy-500)' : 'var(--gray-400)', fontSize: 12 }}>
                                  {row.impacto_monto_clp > 0 ? mmclp(row.impacto_monto_clp) : '—'}
                                </td>
                                <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_solicitud || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {selectedProyecto && (
                  <section className="panel" style={{ marginTop: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h2 style={{ margin: 0 }}>
                        {selectedProyecto}
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>
                          {proyectoLoading ? 'cargando…' : `${proyectoTabla.length} modificación${proyectoTabla.length !== 1 ? 'es' : ''}`}
                        </span>
                      </h2>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => { setSelectedProyecto(null); setProyectoTabla([]) }}>✕ Cerrar</button>
                    </div>
                    {proyectoLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-400)', fontSize: 13 }}>Cargando…</div>
                    ) : (
                      <div className="scroll-x">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Contrato</th>
                              <th>Descripción</th>
                              <th>Tipo</th>
                              <th>Estado</th>
                              <th>Est. DPO</th>
                              <th>Impacto Monto</th>
                              <th>F. Solicitud</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proyectoTabla.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                            ) : proyectoTabla.map((row: any) => (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</td>
                                <td style={{ fontSize: 10, color: 'var(--gray-500)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || row.nombre || '—'}</td>
                                <td style={{ fontSize: 11 }}>{row.tipo_modificacion || '—'}</td>
                                <td>{estadoChip(row.estado)}</td>
                                <td>{row.estado_dpo ? estadoChip(row.estado_dpo) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                                <td style={{ fontWeight: 700, color: row.impacto_monto_clp > 0 ? 'var(--navy-500)' : 'var(--gray-400)', fontSize: 12 }}>
                                  {row.impacto_monto_clp > 0 ? mmclp(row.impacto_monto_clp) : '—'}
                                </td>
                                <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_solicitud || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                <div className="two-col">
                  {/* Estado de aprobaciones por aprobador */}
                  <section className="panel">
                    <h2>Estado de Aprobaciones</h2>
                    {!kpis.por_aprobador && <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0 }}>Recarga la página para ver este gráfico.</p>}
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={kpis.por_aprobador ?? []}
                        layout="vertical"
                        margin={{ right: 24, left: 8 }}
                        barCategoryGap="30%"
                      >
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="aprobador" type="category" width={175} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                          formatter={(v: any, name: string) => [v, name === 'aprobados' ? 'Aprobados' : name === 'por_aprobar' ? 'Por aprobar' : 'Rechazados']}
                        />
                        <Bar dataKey="aprobados"   name="Aprobados"   stackId="a" fill="var(--success-500)" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} onClick={handleAprobadorClick('aprobados')} />
                        <Bar dataKey="por_aprobar" name="Por aprobar" stackId="a" fill="var(--warning-500)" radius={[0,0,0,0]} style={{ cursor: 'pointer' }} onClick={handleAprobadorClick('por_aprobar')} />
                        <Bar dataKey="rechazados"  name="Rechazados"  stackId="a" fill="var(--error-500)"   radius={[0,5,5,0]} style={{ cursor: 'pointer' }} onClick={handleAprobadorClick('rechazados')} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, justifyContent: 'center' }}>
                      {[['Aprobados','var(--success-500)'],['Por aprobar','var(--warning-500)'],['Rechazados','var(--error-500)']].map(([label, color]) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--gray-600)' }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </section>

                  {/* Resumen impacto */}
                  <section className="panel">
                    <h2>Impacto Total</h2>
                    <div className="metric-row">
                      <span>Monto total modificado</span>
                      <strong style={{ color: 'var(--gold-500)' }}>{mmclp(kpis.monto_total)}</strong>
                    </div>
                    <div style={{ height: 1, background: 'var(--gray-100)', margin: '8px 0' }} />
                    {[
                      { label: 'Aprobadas',             chip: 'aprobado',  count: kpis.aprobados,      color: 'var(--success-500)' },
                      { label: 'En proceso / revisión', chip: 'pendiente', count: kpis.pendientes,     color: 'var(--warning-500)' },
                      { label: 'Rechazadas',             chip: 'rechazado', count: kpis.rechazados,     color: 'var(--error-500)'   },
                      { label: 'Sin clasificar',         chip: '',          count: kpis.sin_clasificar, color: 'var(--gray-400)'    },
                    ].map(({ label, chip, count, color }) => (
                      <div key={label} className="metric-row" style={{ alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {chip ? estadoChip(chip) : <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>Sin clasificar</span>}
                        </span>
                        <strong style={{ fontSize: 13, color, fontWeight: 700 }}>{count}</strong>
                      </div>
                    ))}
                  </section>
                </div>
                {selectedAprobador && (
                  <section className="panel" style={{ marginTop: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h2 style={{ margin: 0 }}>
                        {selectedAprobador.aprobador}
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>
                          {selectedAprobador.cat === 'aprobados' ? 'Aprobados' : selectedAprobador.cat === 'por_aprobar' ? 'Por aprobar' : 'Rechazados'}
                          {!aprobadorLoading && ` · ${aprobadorTabla.length} modificación${aprobadorTabla.length !== 1 ? 'es' : ''}`}
                        </span>
                      </h2>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => { setSelectedAprobador(null); setAprobadorTabla([]) }}>✕ Cerrar</button>
                    </div>
                    {aprobadorLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--gray-400)', fontSize: 13 }}>Cargando…</div>
                    ) : (
                      <div className="scroll-x">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Contrato</th>
                              <th>Proyecto</th>
                              <th>Descripción</th>
                              <th>Tipo</th>
                              <th>Estado {selectedAprobador?.aprobador}</th>
                              <th>Impacto Monto</th>
                              <th>F. Solicitud</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aprobadorTabla.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                            ) : aprobadorTabla.map((row: any) => {
                              const estadoField = selectedAprobador ? APROBADOR_FIELD[selectedAprobador.aprobador] : 'estado'
                              const estadoVal   = row[estadoField] || row.estado || '—'
                              return (
                                <tr key={row.id}>
                                  <td style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</td>
                                  <td style={{ fontSize: 11 }}>{row.proyecto || '—'}</td>
                                  <td style={{ fontSize: 10, color: 'var(--gray-500)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || row.nombre || '—'}</td>
                                  <td style={{ fontSize: 11 }}>{row.tipo_modificacion || '—'}</td>
                                  <td>{estadoChip(estadoVal)}</td>
                                  <td style={{ fontWeight: 700, color: row.impacto_monto_clp > 0 ? 'var(--navy-500)' : 'var(--gray-400)', fontSize: 12 }}>
                                    {row.impacto_monto_clp > 0 ? mmclp(row.impacto_monto_clp) : '—'}
                                  </td>
                                  <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_solicitud || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {/* ── Detalle ── */}
            {tab === 'Detalle' && (
              <>
                <div className="filters-bar" style={{ marginBottom: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                  {filtros && (
                    <>
                      <div>
                        <label>Tipo</label>
                        <select value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
                          <option value="">Todos</option>
                          {filtros.tipos.map((t: string) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Estado</label>
                        <select value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
                          <option value="">Todos</option>
                          {filtros.estados.map((e: string) => <option key={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Proyecto</label>
                        <select value={filters.proyecto} onChange={e => setFilters(f => ({ ...f, proyecto: e.target.value }))}>
                          <option value="">Todos</option>
                          {filtros.proyectos.map((p: string) => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Contrato</label>
                        <select value={filters.contrato} onChange={e => setFilters(f => ({ ...f, contrato: e.target.value }))}>
                          <option value="">Todos</option>
                          {filtros.contratos.map((c: string) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Área</label>
                        <select value={filters.area} onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}>
                          <option value="">Todas</option>
                          {filtros.areas.map((a: string) => <option key={a}>{a}</option>)}
                        </select>
                      </div>
                      <button className="btn" onClick={fetchTabla}>Filtrar</button>
                      <button className="btn-ghost" onClick={() => { setFilters({ tipo: '', estado: '', proyecto: '', contrato: '', area: '' }); setTimeout(fetchTabla, 0) }}>Limpiar</button>
                    </>
                  )}
                </div>

                <section className="panel">
                  <h2>Solicitudes de Modificación — {tabla.length} registros</h2>
                  <div className="scroll-x">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Contrato / Solicitud</th>
                          <th>Proyecto</th>
                          <th>Tipo Modificación</th>
                          <th>Estado</th>
                          <th>Est. Supervisor</th>
                          <th>Est. DPO</th>
                          <th>Est. P&C</th>
                          <th>Impacto Monto</th>
                          <th>Impacto Plazo</th>
                          <th>Solicitante</th>
                          <th>F. Solicitud</th>
                          <th>F. Firma DPO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabla.length === 0 ? (
                          <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                        ) : tabla.map((row: any) => (
                          <tr key={row.id}>
                            <td style={{ maxWidth: 200 }}>
                              <div style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</div>
                              <div style={{ color: 'var(--gray-500)', fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || row.nombre}</div>
                            </td>
                            <td style={{ fontSize: 11 }}>{row.proyecto || '—'}</td>
                            <td style={{ fontSize: 11 }}>{row.tipo_modificacion || '—'}</td>
                            <td>{estadoChip(row.estado)}</td>
                            <td>{row.estado_supervisor ? estadoChip(row.estado_supervisor) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                            <td>{row.estado_dpo ? estadoChip(row.estado_dpo) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                            <td>{row.estado_pyc ? estadoChip(row.estado_pyc) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                            <td style={{ fontWeight: 700, color: row.impacto_monto_clp > 0 ? 'var(--navy-500)' : 'var(--gray-400)', fontSize: 12 }}>
                              {row.impacto_monto_clp > 0 ? mmclp(row.impacto_monto_clp) : '—'}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: 12, color: row.impacto_plazo_mes > 0 ? 'var(--warning-500)' : 'var(--gray-400)', fontWeight: row.impacto_plazo_mes > 0 ? 700 : 400 }}>
                              {row.impacto_plazo_mes > 0 ? `${row.impacto_plazo_mes} mes${row.impacto_plazo_mes !== 1 ? 'es' : ''}` : '—'}
                            </td>
                            <td style={{ fontSize: 11 }}>{row.solicitante || '—'}</td>
                            <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_solicitud || '—'}</td>
                            <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_dpo || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* ── Tiempos ── */}
            {tab === 'Tiempos' && (
              <section className="panel">
                <h2>Seguimiento por Etapa de Aprobación</h2>
                <p className="subtitle">Estado de cada solicitud en las etapas: Supervisor → DPO → P&C</p>
                <div className="scroll-x">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Contrato</th>
                        <th>Proyecto</th>
                        <th>Descripción</th>
                        <th style={{ textAlign: 'center' }}>Supervisor</th>
                        <th style={{ textAlign: 'center' }}>DPO</th>
                        <th style={{ textAlign: 'center' }}>P&C</th>
                        <th style={{ textAlign: 'center' }}>Días Sup.</th>
                        <th style={{ textAlign: 'center' }}>Días DPO</th>
                        <th style={{ textAlign: 'center' }}>Días P&C</th>
                        <th>F. Solicitud</th>
                        <th>F. Firma Sup.</th>
                        <th>F. Firma DPO</th>
                        <th>F. Firma P&C</th>
                        <th>Saldo Vigente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabla.length === 0 ? (
                        <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                      ) : tabla.map((row: any) => {
                        const dSup = daysBetween(row.fecha_solicitud, row.fecha_firma_sup)
                        const dDpo = daysBetween(row.fecha_firma_sup,  row.fecha_firma_dpo)
                        const dPyc = daysBetween(row.fecha_firma_dpo,  row.fecha_firma_pyc)
                        return (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</td>
                          <td style={{ fontSize: 11 }}>{row.proyecto || '—'}</td>
                          <td style={{ fontSize: 10, color: 'var(--gray-500)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{row.estado_supervisor ? estadoChip(row.estado_supervisor) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                          <td style={{ textAlign: 'center' }}>{row.estado_dpo        ? estadoChip(row.estado_dpo)        : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                          <td style={{ textAlign: 'center' }}>{row.estado_pyc        ? estadoChip(row.estado_pyc)        : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: dSup !== null ? diasColor(dSup) : 'var(--gray-300)' }}>{dSup !== null ? dSup : '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: dDpo !== null ? diasColor(dDpo) : 'var(--gray-300)' }}>{dDpo !== null ? dDpo : '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: dPyc !== null ? diasColor(dPyc) : 'var(--gray-300)' }}>{dPyc !== null ? dPyc : '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_solicitud || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_sup || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_dpo || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_pyc || '—'}</td>
                          <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy-400)' }}>{row.saldo_vigente > 0 ? mmclp(row.saldo_vigente) : '—'}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Tendencia ── */}
            {tab === 'Tendencia' && (
              <>
                {/* Filtro de período */}
                <div className="filters-bar" style={{ marginBottom: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                  <div>
                    <label>Desde (mes)</label>
                    <input type="month" value={trDesde} onChange={e => setTrDesde(e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 6 }} />
                  </div>
                  <div>
                    <label>Hasta (mes)</label>
                    <input type="month" value={trHasta} onChange={e => setTrHasta(e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 6 }} />
                  </div>
                  <button className="btn" onClick={fetchTendenciaRazones}>Aplicar</button>
                  <button className="btn-ghost" onClick={() => { setTrDesde(''); setTrHasta(''); getMondayTendenciaRazones().then(tr => setTendenciaRazones(tr)).catch(() => {}) }}>Limpiar</button>
                  {(tendenciaRazones.mes_inicio || tendenciaRazones.mes_fin) && (
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', alignSelf: 'center' }}>
                      Período: {tendenciaRazones.mes_inicio} → {tendenciaRazones.mes_fin}
                    </span>
                  )}
                </div>

                <div className="two-col">
                  <section className="panel">
                    <h2>Solicitudes Totales por Mes</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={tendencia} margin={{ top: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => [Number(v), 'Solicitudes']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                        <Line type="monotone" dataKey="cantidad" stroke="var(--navy-400)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--navy-400)', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </section>

                  <section className="panel">
                    <h2>Por Razón de Modificación</h2>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={tendenciaRazones.datos} margin={{ top: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: 'var(--gray-700)' }}>{v}</span>} />
                        {tendenciaRazones.razones.map((razon, idx) => (
                          <Line key={razon} type="monotone" dataKey={razon} stroke={TIPO_COLORS[idx % TIPO_COLORS.length]} strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: TIPO_COLORS[idx % TIPO_COLORS.length] }} activeDot={{ r: 6 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </section>
                </div>

                {/* Tabla de variación por razón */}
                {(tendenciaRazones.variacion ?? []).length > 0 && (() => {
                  const cols: { key: string; label: string; align: 'left' | 'right' }[] = [
                    { key: 'razon',         label: 'Razón',                               align: 'left'  },
                    { key: 'count_inicio',  label: `Cant. ${tendenciaRazones.mes_inicio}`, align: 'right' },
                    { key: 'pct_inicio',    label: '% inicio',                            align: 'right' },
                    { key: 'count_fin',     label: `Cant. ${tendenciaRazones.mes_fin}`,    align: 'right' },
                    { key: 'pct_fin',       label: '% fin',                               align: 'right' },
                    { key: 'variacion_pct', label: 'Variación',                           align: 'right' },
                  ]
                  const sorted = [...(tendenciaRazones.variacion ?? [])].sort((a, b) => {
                    const av = a[varSort.col], bv = b[varSort.col]
                    if (typeof av === 'string') return av.localeCompare(bv) * varSort.dir
                    return (av - bv) * varSort.dir
                  })
                  const thStyle = (key: string, align: string): React.CSSProperties => ({
                    textAlign: align as any,
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: varSort.col === key ? 'var(--navy-500)' : undefined,
                    whiteSpace: 'nowrap',
                  })
                  const arrow = (key: string) => varSort.col === key ? (varSort.dir === 1 ? ' ↑' : ' ↓') : ''
                  const handleSort = (key: string) =>
                    setVarSort(s => s.col === key ? { col: key, dir: s.dir === 1 ? -1 : 1 } : { col: key, dir: 1 })

                  return (
                    <section className="panel">
                      <h2>
                        Variación por Razón de Modificación
                        {tendenciaRazones.mes_inicio && tendenciaRazones.mes_fin && tendenciaRazones.mes_inicio !== tendenciaRazones.mes_fin && (
                          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--gray-400)' }}>
                            {tendenciaRazones.mes_inicio} → {tendenciaRazones.mes_fin}
                          </span>
                        )}
                      </h2>
                      <div className="scroll-x">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {cols.map(c => (
                                <th key={c.key} style={thStyle(c.key, c.align)} onClick={() => handleSort(c.key)}>
                                  {c.label}{arrow(c.key)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((row: any) => {
                              const v = row.variacion_pct as number
                              const isEqual = tendenciaRazones.mes_inicio === tendenciaRazones.mes_fin
                              const varColor = isEqual ? 'var(--gray-400)' : v > 0 ? 'var(--error-500)' : v < 0 ? 'var(--success-500)' : 'var(--gray-400)'
                              const varLabel = isEqual ? '—' : v > 0 ? `+${v}%` : `${v}%`
                              return (
                                <tr key={row.razon}>
                                  <td style={{ fontWeight: 600 }}>{row.razon}</td>
                                  <td style={{ textAlign: 'right' }}>{row.count_inicio}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--gray-500)', fontSize: 11 }}>{row.pct_inicio}%</td>
                                  <td style={{ textAlign: 'right' }}>{row.count_fin}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--gray-500)', fontSize: 11 }}>{row.pct_fin}%</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: varColor }}>{varLabel}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )
                })()}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
