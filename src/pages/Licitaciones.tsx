import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { getLicitKpis, getLicitPorEstado, getLicitPorAnio, getLicitTabla } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const COLORS: Record<string, string> = {
  Cerrada:    '#27ae60',
  'En Proceso': '#2563eb',
  Iniciada:   '#94a3b8',
  Rechazada:  '#e74c3c',
}
const BADGE: Record<string, string> = {
  Cerrada:    'bg-emerald-100 text-emerald-700',
  'En Proceso': 'bg-blue-100 text-blue-700',
  Iniciada:   'bg-slate-100 text-slate-600',
  Rechazada:  'bg-red-100 text-red-700',
}

const clp = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

export default function Licitaciones() {
  const [kpis,       setKpis]       = useState<any>(null)
  const [porEstado,  setPorEstado]  = useState<any[]>([])
  const [porAnio,    setPorAnio]    = useState<any[]>([])
  const [tabla,      setTabla]      = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    getLicitKpis().then(setKpis)
    getLicitPorEstado().then(setPorEstado)
    getLicitPorAnio().then(setPorAnio)
  }, [])

  useEffect(() => {
    getLicitTabla(filtroEstado ? { grupo_estado: filtroEstado } : {}).then(setTabla)
  }, [filtroEstado])

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

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
        title="Licitaciones — Pipeline SOLPE"
        subtitle="Estado de solicitudes de pedido y proceso de adjudicación"
        icon="📋"
      />

      {/* KPIs fila 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 pb-2">
        <KpiCard label="Total SOLPEs"         value={kpis.total}        color="blue"   icon="📁" />
        <KpiCard label="En Proceso"           value={kpis.en_proceso}   color="orange" icon="⏳" sub="activas actualmente" />
        <KpiCard label="Cerradas / Adjud."    value={kpis.cerradas}     color="green"  icon="✅" />
        <KpiCard label="Tasa Adjudicación"    value={`${(kpis.tasa_adjudicacion * 100).toFixed(1)}%`} color="green" icon="🎯" />
      </div>
      {/* KPIs fila 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-3">
        <KpiCard label="Rechazadas"           value={kpis.rechazadas}   color="red"    icon="❌" />
        <KpiCard label="Iniciadas"            value={kpis.iniciadas}    color="blue"   icon="🆕" />
        <KpiCard label="Monto en Gestión"     value={kpis.monto_en_gestion ? clp(kpis.monto_en_gestion) : '—'} color="orange" icon="💲" />
        <KpiCard label="Días Prom. Gestión"   value={kpis.dias_promedio_gestion ?? '—'} color="blue" icon="📅" sub="SOLPEs cerradas" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">SOLPEs por Año y Estado</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stackedData.filter(d => d.año >= 2018)}>
              <XAxis dataKey="año" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              {estadosAnio.map(e => (
                <Bar key={e} dataKey={e} stackId="a" fill={COLORS[e] ?? '#94a3b8'} radius={estadosAnio.indexOf(e) === estadosAnio.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Distribución Estado Actual</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={porEstado} dataKey="cantidad" nameKey="Grupo_Estado"
                cx="50%" cy="50%" outerRadius={90} innerRadius={35}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {porEstado.map((e: any, i: number) => (
                  <Cell key={i} fill={COLORS[e.Grupo_Estado] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla */}
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
                  <tr
                    key={i}
                    className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-gray-700">{r['Código']}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate text-gray-600" title={r.Nombre}>{r.Nombre}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Tipo}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Forma}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.Monto ? r.Monto.toLocaleString('es-CL') : '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.Moneda || '—'}</td>
                    <td className="px-3 py-2 font-mono text-blue-600">{r.Contrato || '—'}</td>
                    <td className="px-3 py-2 max-w-[110px] truncate text-gray-500" title={r['Usuario Solicitante']}>
                      {r['Usuario Solicitante'] || '—'}
                    </td>
                    <td className="px-3 py-2 max-w-[110px] truncate text-gray-500" title={r['Ges. de Contratos y Compras']}>
                      {r['Ges. de Contratos y Compras'] || '—'}
                    </td>
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
