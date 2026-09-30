import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getAnalisisKpis, getAnalisisPorProyecto, getAnalisisTabla } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const mmclp = (v: number) => `$${(v / 1e9).toFixed(2)} MM`
const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

const PALETTE = [
  '#1e40af','#2563eb','#3b82f6','#1d4ed8','#1a56db',
  '#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e',
]

export default function AnalisisProyecto() {
  const [kpis,        setKpis]        = useState<any>(null)
  const [porProyecto, setPorProyecto] = useState<any[]>([])
  const [tabla,       setTabla]       = useState<any[]>([])
  const [proyectoSel, setProyectoSel] = useState('')

  useEffect(() => {
    getAnalisisKpis().then(setKpis)
    getAnalisisPorProyecto().then(setPorProyecto)
  }, [])

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
