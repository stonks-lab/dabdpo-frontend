import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { getMondayKpis, getMondayTabla, getMondayFiltros, getMondayTendencia } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const clp = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
const mmclp = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)} MM` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)} M` : clp(v)

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
  const [tendencia, setTendencia]= useState<any[]>([])
  const [filtros,   setFiltros]  = useState<any>(null)
  const [tabla,     setTabla]    = useState<any[]>([])
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState('')
  const [filters,   setFilters]  = useState<Filters>({ tipo: '', estado: '', proyecto: '', contrato: '', area: '' })

  useEffect(() => {
    setLoading(true)
    Promise.all([getMondayKpis(), getMondayFiltros(), getMondayTendencia()])
      .then(([k, f, t]) => { setKpis(k); setFiltros(f); setTendencia(t) })
      .catch(err => setError(`Error al conectar con Monday.com: ${err?.response?.data?.detail ?? err.message}`))
      .finally(() => setLoading(false))
  }, [])

  const fetchTabla = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    getMondayTabla(params).then(setTabla).catch(() => setTabla([]))
  }, [filters])

  useEffect(() => {
    if (tab === 'Detalle' || tab === 'Tiempos') fetchTabla()
  }, [tab, fetchTabla])

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
                      <BarChart data={kpis.por_tipo} layout="vertical" margin={{ right: 16 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis dataKey="tipo" type="category" tick={{ fontSize: 11, fill: 'var(--gray-700)' }} width={170} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                        <Bar dataKey="cantidad" radius={[0, 5, 5, 0]}>
                          {kpis.por_tipo.map((_: any, idx: number) => (
                            <Cell key={idx} fill={TIPO_COLORS[idx % TIPO_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </section>

                  <section className="panel">
                    <h2>Por Proyecto</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={kpis.por_proyecto} layout="vertical" margin={{ right: 16 }}>
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis dataKey="proyecto" type="category" tick={{ fontSize: 11, fill: 'var(--gray-700)' }} width={160} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                        <Bar dataKey="cantidad" fill="var(--navy-300)" radius={[0, 5, 5, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>
                </div>

                <div className="two-col">
                  {/* Estado por etapa */}
                  <section className="panel">
                    <h2>Estado DPO</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      {kpis.por_estado_dpo.map((r: any, i: number) => {
                        const pct = kpis.total > 0 ? (r.cantidad / kpis.total) * 100 : 0
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                              <span style={{ color: 'var(--gray-700)' }}>{r.estado}</span>
                              <span style={{ fontWeight: 700, color: 'var(--navy-500)' }}>{r.cantidad}</span>
                            </div>
                            <div style={{ background: 'var(--gray-100)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: TIPO_COLORS[i % TIPO_COLORS.length], borderRadius: 99 }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  {/* Resumen impacto */}
                  <section className="panel">
                    <h2>Impacto Total</h2>
                    <div className="metric-row">
                      <span>Monto total modificado</span>
                      <strong style={{ color: 'var(--gold-500)' }}>{mmclp(kpis.monto_total)}</strong>
                    </div>
                    <div className="metric-row">
                      <span>Aprobadas</span>
                      <span>{estadoChip('aprobado')}</span>
                    </div>
                    <div className="metric-row">
                      <span>En proceso / revisión</span>
                      <span>{estadoChip('pendiente')}</span>
                    </div>
                    <div className="metric-row">
                      <span>Rechazadas</span>
                      <span>{estadoChip('rechazado')}</span>
                    </div>
                    <div className="metric-row" style={{ marginTop: 8 }}>
                      <span>Sin clasificar</span>
                      <strong style={{ color: 'var(--gray-500)' }}>{kpis.sin_clasificar}</strong>
                    </div>
                  </section>
                </div>
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
                          <th>Est. DPO</th>
                          <th>Impacto Monto</th>
                          <th>Impacto Plazo</th>
                          <th>Solicitante</th>
                          <th>F. Solicitud</th>
                          <th>F. Firma DPO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabla.length === 0 ? (
                          <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                        ) : tabla.map((row: any) => (
                          <tr key={row.id}>
                            <td style={{ maxWidth: 200 }}>
                              <div style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</div>
                              <div style={{ color: 'var(--gray-500)', fontSize: 10, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || row.nombre}</div>
                            </td>
                            <td style={{ fontSize: 11 }}>{row.proyecto || '—'}</td>
                            <td style={{ fontSize: 11 }}>{row.tipo_modificacion || '—'}</td>
                            <td>{estadoChip(row.estado)}</td>
                            <td>{row.estado_dpo ? estadoChip(row.estado_dpo) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
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
                        <th>F. Solicitud</th>
                        <th>F. Firma Sup.</th>
                        <th>F. Firma DPO</th>
                        <th>F. Firma P&C</th>
                        <th>Saldo Vigente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabla.length === 0 ? (
                        <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>Sin registros</td></tr>
                      ) : tabla.map((row: any) => (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 600, color: 'var(--navy-500)', fontSize: 11 }}>{row.codigo_contrato || '—'}</td>
                          <td style={{ fontSize: 11 }}>{row.proyecto || '—'}</td>
                          <td style={{ fontSize: 10, color: 'var(--gray-500)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{row.estado_supervisor ? estadoChip(row.estado_supervisor) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                          <td style={{ textAlign: 'center' }}>{row.estado_dpo ? estadoChip(row.estado_dpo) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                          <td style={{ textAlign: 'center' }}>{row.estado_pyc ? estadoChip(row.estado_pyc) : <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_solicitud || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_sup || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_dpo || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-500)' }}>{row.fecha_firma_pyc || '—'}</td>
                          <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy-400)' }}>{row.saldo_vigente > 0 ? mmclp(row.saldo_vigente) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Tendencia ── */}
            {tab === 'Tendencia' && (
              <section className="panel">
                <h2>Solicitudes de Modificación por Mes</h2>
                <p className="subtitle">Cantidad de solicitudes ingresadas al tablero Monday por período</p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={tendencia} margin={{ top: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [Number(v), 'Solicitudes']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                    <Line type="monotone" dataKey="cantidad" stroke="var(--navy-400)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--navy-400)', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            )}
          </div>
        </>
      )}
    </>
  )
}
