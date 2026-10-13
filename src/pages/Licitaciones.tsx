import { Fragment, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import {
  getLicitKpis, getLicitPorEstado, getLicitPorAnio, getLicitTabla,
  getLicitProcesosKpis, getLicitProcesos, getLicitProcesoDetalle,
} from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

// ── colores ──────────────────────────────────────────────────────────────────

const AVANCE_COLOR: Record<string, string> = {
  'A TIEMPO':  '#16a34a',
  'RIESGO':    '#d97706',
  'ATRASADO':  '#dc2626',
  'PROGRAMADO':'#2563eb',
}
const AVANCE_BG: Record<string, string> = {
  'A TIEMPO':  '#dcfce7',
  'RIESGO':    '#fef3c7',
  'ATRASADO':  '#fee2e2',
  'PROGRAMADO':'#dbeafe',
}

const SOLPE_COLORS: Record<string, string> = {
  Cerrada:      '#27ae60',
  'En Proceso': '#2563eb',
  Iniciada:     '#94a3b8',
  Rechazada:    '#e74c3c',
}
const BADGE: Record<string, string> = {
  Cerrada:      'bg-emerald-100 text-emerald-700',
  'En Proceso': 'bg-blue-100 text-blue-700',
  Iniciada:     'bg-slate-100 text-slate-600',
  Rechazada:    'bg-red-100 text-red-700',
}

const clp = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined) return <span style={{ color: '#9aa1b3', fontSize: 10 }}>—</span>
  const color = delta > 0 ? '#dc2626' : delta < 0 ? '#16a34a' : '#9aa1b3'
  const sign  = delta > 0 ? '+' : ''
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
      {sign}{delta}d
    </span>
  )
}

// ── Detalle modal-like expandible ─────────────────────────────────────────────

function DetalleRow({ proceso }: { proceso: string }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLicitProcesoDetalle(proceso)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [proceso])

  if (loading) return (
    <tr>
      <td colSpan={12} style={{ padding: '8px 16px', background: '#f8fafc', color: '#9aa1b3', fontSize: 11 }}>
        Cargando detalle...
      </td>
    </tr>
  )
  if (items.length === 0) return (
    <tr>
      <td colSpan={12} style={{ padding: '8px 16px', background: '#f8fafc', color: '#9aa1b3', fontSize: 11 }}>
        Sin detalle disponible
      </td>
    </tr>
  )

  return (
    <tr>
      <td colSpan={12} style={{ padding: 0, background: '#f8fafc' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e0e7ef' }}>
                <th style={{ padding: '4px 10px', textAlign: 'left', whiteSpace: 'nowrap', color: '#4b5563' }}>Subelemento</th>
                <th style={{ padding: '4px 10px', textAlign: 'left', color: '#4b5563' }}>Estado</th>
                <th style={{ padding: '4px 10px', textAlign: 'left', color: '#4b5563' }}>Avance</th>
                <th style={{ padding: '4px 10px', textAlign: 'left', color: '#4b5563' }}>Área</th>
                <th style={{ padding: '4px 10px', textAlign: 'right', color: '#4b5563' }}>Ini Prog.</th>
                <th style={{ padding: '4px 10px', textAlign: 'right', color: '#4b5563' }}>Fin Prog.</th>
                <th style={{ padding: '4px 10px', textAlign: 'right', color: '#4b5563' }}>Ini Real</th>
                <th style={{ padding: '4px 10px', textAlign: 'right', color: '#4b5563' }}>Fin Real</th>
                <th style={{ padding: '4px 10px', textAlign: 'right', color: '#4b5563' }}>Ciclo Prog.</th>
                <th style={{ padding: '4px 10px', textAlign: 'right', color: '#4b5563' }}>Ciclo Real</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '3px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={d['Subelemento']}>{d['Subelemento'] || '—'}</td>
                  <td style={{ padding: '3px 10px' }}>
                    {d['Estado_Inicio-Fin'] ? (
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 3,
                        background: d['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#dcfce7' : '#fef9c3',
                        color: d['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#15803d' : '#854d0e',
                      }}>{d['Estado_Inicio-Fin']}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '3px 10px', color: '#6b7280' }}>{d['Avance Etapas'] || '—'}</td>
                  <td style={{ padding: '3px 10px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d['Área Responsable'] || '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fecha Inicio Acta inicio'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fecha Fin Acta Inicio'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Inicio real'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fin real'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{d['Ciclo programado'] ?? '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{d['Ciclo real'] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

// ── componente principal ──────────────────────────────────────────────────────

export default function Licitaciones() {
  // Procesos de licitación (CSV)
  const [pKpis,     setPKpis]     = useState<any>(null)
  const [procesos,  setProcesos]  = useState<any[]>([])
  const [pFiltro,   setPFiltro]   = useState('RIESGO')
  const [pBuscar,   setPBuscar]   = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)

  // SOLPEs (histórico)
  const [kpis,       setKpis]       = useState<any>(null)
  const [porEstado,  setPorEstado]  = useState<any[]>([])
  const [porAnio,    setPorAnio]    = useState<any[]>([])
  const [tabla,      setTabla]      = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    getLicitProcesosKpis().then(setPKpis).catch(() => {})
    getLicitKpis().then(setKpis).catch(() => {})
    getLicitPorEstado().then(setPorEstado).catch(() => {})
    getLicitPorAnio().then(setPorAnio).catch(() => {})
  }, [])

  useEffect(() => {
    getLicitProcesos(pFiltro ? { avance: pFiltro } : undefined)
      .then(setProcesos).catch(() => {})
  }, [pFiltro])

  useEffect(() => {
    getLicitTabla(filtroEstado ? { grupo_estado: filtroEstado } : {}).then(setTabla).catch(() => {})
  }, [filtroEstado])

  const procesosFiltrados = procesos.filter(p =>
    !pBuscar || (p['N°PROCESO'] + ' ' + p['Proceso']).toLowerCase().includes(pBuscar.toLowerCase())
  )

  // datos gráfico stacked SOLPE
  const anios = [...new Set(porAnio.map((r: any) => r.Año))].sort()
  const estadosAnio = [...new Set(porAnio.map((r: any) => r.Grupo_Estado))]
  const stackedData = anios.map(a => {
    const base: any = { año: a }
    estadosAnio.forEach(e => {
      const row = porAnio.find((r: any) => r.Año === a && r.Grupo_Estado === e)
      base[e] = row?.cantidad ?? 0
    })
    return base
  })

  return (
    <div>
      <PageHeader
        title="Licitaciones"
        subtitle="Seguimiento de procesos de licitación y pipeline SOLPE"
        icon="📋"
      />

      {/* ── Sección: Procesos de Licitación ─────────────────────────────────── */}
      <div className="px-4 pb-1 pt-1">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Procesos de Licitación</span>
      </div>

      {/* KPIs procesos */}
      {pKpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 pb-3">
          <KpiCard label="Total Procesos"  value={pKpis.total}      color="blue"   />
          <KpiCard label="A Tiempo"        value={pKpis.a_tiempo}   color="green"  />
          <KpiCard label="En Riesgo"       value={pKpis.riesgo}     color="yellow" />
          <KpiCard label="Atrasados"       value={pKpis.atrasado}   color="red"    />
          <KpiCard label="Programados"     value={pKpis.programado} color="blue"   />
        </div>
      )}

      {/* Filtros procesos */}
      <div className="filters-bar px-4 pb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          type="text" placeholder="Buscar N° proceso o nombre…" value={pBuscar}
          onChange={e => setPBuscar(e.target.value)}
          style={{ flex: '1 1 220px', fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 4 }}
        />
        {(['', 'A TIEMPO', 'RIESGO', 'ATRASADO', 'PROGRAMADO'] as const).map(v => (
          <button
            key={v || 'todos'}
            onClick={() => setPFiltro(v)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              border: 'none', fontWeight: 600,
              background: pFiltro === v ? (v ? AVANCE_COLOR[v] : 'var(--navy-500)') : '#e5e7eb',
              color: pFiltro === v ? '#fff' : '#6b7280',
            }}
          >{v || 'Todos'}</button>
        ))}
        <span style={{ fontSize: 12, color: '#9aa1b3', marginLeft: 'auto' }}>
          {procesosFiltrados.length} procesos
        </span>
      </div>

      {/* ── Sección: Pipeline SOLPE ──────────────────────────────────────────── */}
      <div className="px-4 pb-1">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pipeline SOLPE</span>
      </div>

      {kpis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 pb-2">
            <KpiCard label="Total SOLPEs"         value={kpis.total}        color="blue"   icon="📁" />
            <KpiCard label="En Proceso"           value={kpis.en_proceso}   color="orange" icon="⏳" sub="activas actualmente" />
            <KpiCard label="Cerradas / Adjud."    value={kpis.cerradas}     color="green"  icon="✅" />
            <KpiCard label="Tasa Adjudicación"    value={`${(kpis.tasa_adjudicacion * 100).toFixed(1)}%`} color="green" icon="🎯" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-3">
            <KpiCard label="Rechazadas"           value={kpis.rechazadas}   color="red"    icon="❌" />
            <KpiCard label="Iniciadas"            value={kpis.iniciadas}    color="blue"   icon="🆕" />
            <KpiCard label="Monto en Gestión"     value={kpis.monto_en_gestion ? clp(kpis.monto_en_gestion) : '—'} color="orange" icon="💲" />
            <KpiCard label="Días Prom. Gestión"   value={kpis.dias_promedio_gestion ?? '—'} color="blue" icon="📅" sub="SOLPEs cerradas" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">SOLPEs por Año y Estado</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stackedData.filter((d: any) => d.año >= 2018)}>
                  <XAxis dataKey="año" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  {estadosAnio.map(e => (
                    <Bar key={e} dataKey={e} stackId="a" fill={SOLPE_COLORS[e] ?? '#94a3b8'}
                      radius={estadosAnio.indexOf(e) === estadosAnio.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Distribución Estado Actual</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porEstado} dataKey="cantidad" nameKey="Grupo_Estado"
                    cx="50%" cy="50%" outerRadius={75} innerRadius={28}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {porEstado.map((e: any, i: number) => (
                      <Cell key={i} fill={SOLPE_COLORS[e.Grupo_Estado] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ── Tabla Procesos de Licitación ─────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '7px 8px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: 10, color: '#6b7280', fontWeight: 700 }}>N° Proceso</th>
                  <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: 10, color: '#6b7280', fontWeight: 700 }}>Nombre</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 10, color: '#6b7280', fontWeight: 700 }}>Avance</th>
                  <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Etapa Actual</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Ini. Prog.</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Ini. Real</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Fin Prog.</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Fin Real</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Ciclo Est.</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Ciclo Real</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>Delta</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 10, color: '#6b7280', fontWeight: 700 }}>Det.</th>
                </tr>
              </thead>
              <tbody>
                {procesosFiltrados.map((p: any, i: number) => {
                  const isOpen = expanded === p['N°PROCESO']
                  const av = p['Avance Gral Proceso']
                  return (
                    <Fragment key={p['N°PROCESO']}>
                      <tr
                        style={{
                          borderTop: '1px solid #f0f0f0',
                          background: isOpen ? '#f0f9ff' : i % 2 === 1 ? '#fafafa' : '#fff',
                        }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', color: 'var(--navy-500)' }}>
                          {p['N°PROCESO']}
                        </td>
                        <td style={{ padding: '5px 8px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={p['Proceso']}>
                          {p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                            background: AVANCE_BG[av] ?? '#f3f4f6',
                            color: AVANCE_COLOR[av] ?? '#6b7280',
                          }}>{av || '—'}</span>
                        </td>
                        <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {p['Etapa Actual'] || '—'}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>
                          {fmtFecha(p['Fecha inicio programado'])}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {fmtFecha(p['Fecha inicio real'])}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>
                          {fmtFecha(p['Fecha fin programado'])}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {fmtFecha(p['Fecha fin real'])}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', fontVariantNumeric: 'tabular-nums' }}>
                          {p['Ciclo estimado'] ?? '—'}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
                          {p['Ciclo real'] ?? '—'}
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                          <DeltaBadge delta={p['delta_dias']} />
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => setExpanded(isOpen ? null : p['N°PROCESO'])}
                            style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid #e5e7eb',
                              background: isOpen ? 'var(--navy-500)' : '#fff',
                              color: isOpen ? '#fff' : '#6b7280', cursor: 'pointer',
                            }}
                          >{isOpen ? '▲' : '▼'}</button>
                        </td>
                      </tr>
                      {isOpen && <DetalleRow proceso={p['N°PROCESO']} />}
                    </Fragment>
                  )
                })}
                {procesosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ padding: '20px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
                      Sin procesos con el filtro seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabla SOLPE */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-gray-700">Detalle SOLPEs</span>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="ml-auto text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
            >
              <option value="">Todos los estados</option>
              {['En Proceso', 'Cerrada', 'Iniciada', 'Rechazada'].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">Código</th>
                  <th className="px-3 py-2.5 text-left">Nombre</th>
                  <th className="px-3 py-2.5 text-left">Tipo</th>
                  <th className="px-3 py-2.5 text-left">Forma</th>
                  <th className="px-3 py-2.5 text-right">Monto</th>
                  <th className="px-3 py-2.5 text-left">Moneda</th>
                  <th className="px-3 py-2.5 text-left">Contrato</th>
                  <th className="px-3 py-2.5 text-left">Solicitante</th>
                  <th className="px-3 py-2.5 text-left">Gestor</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-right">Días</th>
                  <th className="px-3 py-2.5 text-left">Creación</th>
                </tr>
              </thead>
              <tbody>
                {tabla.slice(0, 100).map((r: any, i: number) => (
                  <tr key={i} className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-3 py-2 font-mono text-gray-700">{r['Código']}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate text-gray-600" title={r.Nombre}>{r.Nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Tipo}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Forma}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.Monto ? r.Monto.toLocaleString('es-CL') : '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Moneda || '—'}</td>
                    <td className="px-3 py-2 font-mono text-blue-600">{r.Contrato || '—'}</td>
                    <td className="px-3 py-2 max-w-[110px] truncate text-gray-500" title={r['Usuario Solicitante']}>{r['Usuario Solicitante'] || '—'}</td>
                    <td className="px-3 py-2 max-w-[110px] truncate text-gray-500" title={r['Ges. de Contratos y Compras']}>{r['Ges. de Contratos y Compras'] || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${BADGE[r.Grupo_Estado] ?? 'bg-gray-100 text-gray-500'}`}>
                        {r.Grupo_Estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.Dias_Gestion ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Fecha_Creacion_SOLPE?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tabla.length > 100 && (
              <p className="text-xs text-gray-400 text-center py-2 bg-slate-50">
                Mostrando 100 de {tabla.length} SOLPEs
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
