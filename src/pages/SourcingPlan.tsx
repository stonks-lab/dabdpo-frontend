import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  getSourcingKpis, getSourcingPorMes, getSourcingPorEstatus,
  getSourcingPorProyecto, getSourcingTabla,
} from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const ESTATUS_COLORS: Record<string, string> = {
  TERMINADO:   '#94a3b8',
  'EN CURSO':  '#2563eb',
  VIGENTE:     '#27ae60',
  PLANIFICADO: '#f59e0b',
}

const ESTATUS_BADGE: Record<string, string> = {
  TERMINADO:   'bg-slate-100 text-slate-600',
  'EN CURSO':  'bg-blue-100 text-blue-700',
  VIGENTE:     'bg-emerald-100 text-emerald-700',
  PLANIFICADO: 'bg-amber-100 text-amber-700',
}

export default function SourcingPlan() {
  const [kpis,        setKpis]        = useState<any>(null)
  const [porMes,      setPorMes]      = useState<any[]>([])
  const [porEstatus,  setPorEstatus]  = useState<any[]>([])
  const [porProyecto, setPorProyecto] = useState<any[]>([])
  const [tabla,       setTabla]       = useState<any[]>([])

  useEffect(() => {
    getSourcingKpis().then(setKpis)
    getSourcingPorMes().then(setPorMes)
    getSourcingPorEstatus().then(setPorEstatus)
    getSourcingPorProyecto().then(d => setPorProyecto(d.filter((r: any) => r.cantidad_total > 0).slice(0, 12)))
    getSourcingTabla().then(setTabla)
  }, [])

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  return (
    <div>
      <PageHeader
        title="Sourcing Plan"
        subtitle="Cobertura contractual por proyecto, blanco y período 2025–2028"
        icon="🗺️"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 pb-3">
        <KpiCard label="Proyectos en Plan"  value={kpis.total_proyectos}    color="blue"   icon="📌" />
        <KpiCard label="Contratos únicos"   value={kpis.total_contratos}    color="blue"   icon="📄" />
        <KpiCard label="Activos este mes"   value={kpis.activos_mes_actual} color="green"  icon="✅" sub="con cantidad > 0" />
        <KpiCard label="Blancos cubiertos"  value={kpis.total_blancos}      color="orange" icon="🎯" />
      </div>

      {/* Charts fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
        {/* Cantidad por mes */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Cantidad Planificada por Mes
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porMes} margin={{ left: -10 }}>
              <XAxis dataKey="periodo" tick={{ fontSize: 9 }} interval={5} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="cantidad_total" name="Cantidad" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por estatus */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Contratos por Estatus
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={porEstatus} dataKey="contratos" nameKey="estatus"
                cx="50%" cy="50%" outerRadius={85} innerRadius={32}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {porEstatus.map((e: any, i: number) => (
                  <Cell key={i} fill={ESTATUS_COLORS[e.estatus] ?? '#e2e8f0'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top proyectos */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Top Proyectos por Cantidad Planificada
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porProyecto} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="proyecto" type="category"
                tick={{ fontSize: 10 }} width={200}
                axisLine={false} tickLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="cantidad_total" name="Cantidad" fill="#2563eb" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla contratos */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-gray-700">Contratos del Plan</span>
            <span className="ml-auto text-xs text-gray-400">{tabla.length} contratos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">Estatus</th>
                  <th className="px-3 py-2.5 text-left">Proyecto</th>
                  <th className="px-3 py-2.5 text-left">Blanco</th>
                  <th className="px-3 py-2.5 text-left">Contrato</th>
                  <th className="px-3 py-2.5 text-left">Empresa</th>
                  <th className="px-3 py-2.5 text-left">Tipo</th>
                  <th className="px-3 py-2.5 text-left">Inicio</th>
                  <th className="px-3 py-2.5 text-left">Término</th>
                  <th className="px-3 py-2.5 text-right">Cant. Plan</th>
                </tr>
              </thead>
              <tbody>
                {tabla.slice(0, 200).map((r: any, i: number) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTATUS_BADGE[r.estatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {r.estatus || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[150px] truncate text-gray-700" title={r.proyecto}>{r.proyecto || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.id_blanco || '—'}</td>
                    <td className="px-3 py-2 font-mono text-blue-600">{r.contrato}</td>
                    <td className="px-3 py-2 max-w-[120px] truncate text-gray-500" title={r.empresa}>{r.empresa || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.tipo || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.inicio || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.termino || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {r.cantidad_total_plan ? Number(r.cantidad_total_plan).toLocaleString('es-CL') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tabla.length > 200 && (
              <p className="text-xs text-gray-400 text-center py-2 bg-slate-50">
                Mostrando 200 de {tabla.length} contratos
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
