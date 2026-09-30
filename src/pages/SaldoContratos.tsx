import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { getSaldoKpis, getSaldoFiltros, getContratos } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
const mmclp = (v: number) => `$${(v / 1e9).toFixed(1)} MM`

const ESTADO_COLOR: Record<string, string> = {
  NEGATIVO:    '#c0392b',
  CRÍTICO:     '#e74c3c',
  ADVERTENCIA: '#f39c12',
  ATENCIÓN:    '#f1c40f',
  OK:          '#27ae60',
}
const ESTADO_TEXT: Record<string, string> = {
  NEGATIVO:    'text-red-700 bg-red-100',
  CRÍTICO:     'text-red-600 bg-red-50',
  ADVERTENCIA: 'text-amber-700 bg-amber-50',
  ATENCIÓN:    'text-yellow-700 bg-yellow-50',
  OK:          'text-emerald-700 bg-emerald-50',
}

export default function SaldoContratos() {
  const [kpis,     setKpis]     = useState<any>(null)
  const [filtros,  setFiltros]  = useState<any>(null)
  const [contratos,setContratos]= useState<any[]>([])
  const [filters,  setFilters]  = useState({ estado_saldo: '', area: '', tipo: '', estado_ctt: '' })

  useEffect(() => {
    getSaldoKpis().then(setKpis)
    getSaldoFiltros().then(setFiltros)
  }, [])

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    getContratos(params).then(setContratos)
  }, [filters])

  const setFilter = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const estadoCount = ['NEGATIVO','CRÍTICO','ADVERTENCIA','ATENCIÓN','OK'].map(e => ({
    name: e, value: contratos.filter(c => c.Estado_Saldo === e).length,
    fill: ESTADO_COLOR[e],
  })).filter(x => x.value > 0)

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  return (
    <div>
      <PageHeader
        title="Saldo de Contratos"
        subtitle="Presupuesto itemizado vs EP consumido por contrato"
        icon="💰"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
        <KpiCard label="Presupuesto Total"    value={mmclp(kpis.presupuesto_total_clp)} color="blue"   icon="🏦" />
        <KpiCard label="EP Consumido"         value={mmclp(kpis.ep_consumido_clp)}      color="blue"   icon="📤" sub={`${(kpis.pct_consumido*100).toFixed(1)}% del presupuesto`} />
        <KpiCard label="Saldo Real"           value={mmclp(kpis.saldo_real_clp)}        color="green"  icon="✅" />
        <KpiCard label="% Consumido"          value={`${(kpis.pct_consumido*100).toFixed(1)}%`} color="blue" icon="📊" />
        <KpiCard label="Contratos Críticos"   value={kpis.contratos_criticos}           color="red"    icon="🔴" />
        <KpiCard label="En Advertencia"       value={kpis.contratos_advertencia}        color="yellow" icon="⚠️" />
      </div>

      {/* Filtros */}
      {filtros && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {[
            { key: 'estado_saldo', label: 'Estado saldo',    opts: filtros.estados_saldo },
            { key: 'area',         label: 'Área',            opts: filtros.areas },
            { key: 'tipo',         label: 'Tipo contrato',   opts: filtros.tipos },
            { key: 'estado_ctt',   label: 'Estado contrato', opts: filtros.estados_ctt },
          ].map(({ key, label, opts }) => (
            <select
              key={key}
              value={(filters as any)[key]}
              onChange={e => setFilter(key, e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white shadow-sm text-gray-700"
            >
              <option value="">— {label} —</option>
              {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({ estado_saldo: '', area: '', tipo: '', estado_ctt: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      )}

      {/* Tabla + gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 pb-6">
        {/* Tabla principal */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {contratos.length} contratos
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">Contrato</th>
                  <th className="px-3 py-2.5 text-left">Descripción</th>
                  <th className="px-3 py-2.5 text-left">Tipo</th>
                  <th className="px-3 py-2.5 text-left">Área</th>
                  <th className="px-3 py-2.5 text-center">Estado Cto</th>
                  <th className="px-3 py-2.5 text-right">Presupuesto</th>
                  <th className="px-3 py-2.5 text-right">EP Cons.</th>
                  <th className="px-3 py-2.5 text-right">Saldo</th>
                  <th className="px-3 py-2.5 text-center min-w-[90px]">% Saldo</th>
                  <th className="px-3 py-2.5 text-center">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {contratos.slice(0, 100).map((c, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-3 py-1.5 font-mono font-semibold text-gray-700">{c.codigo_ctt}</td>
                    <td className="px-3 py-1.5 max-w-[160px] truncate text-gray-600" title={c.Descripcion_ctt}>
                      {c.Descripcion_ctt}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[80px] truncate" title={c.Tipo_contrato}>
                      {c.Tipo_contrato}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 max-w-[80px] truncate" title={c.Area_contrato}>
                      {c.Area_contrato}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        c.Estado_ctt === 'Vigente' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {c.Estado_ctt}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{mmclp(c.Presupuesto_CLP)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{mmclp(c.EP_Consumido_CLP)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${c.Saldo_CLP < 0 ? 'text-red-600' : ''}`}>
                      {mmclp(c.Saldo_CLP)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-0.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.max(0, Math.min(100, c.Pct_Saldo * 100))}%`,
                            background: ESTADO_COLOR[c.Estado_Saldo],
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 tabular-nums">
                        {(c.Pct_Saldo * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTADO_TEXT[c.Estado_Saldo] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.Estado_Saldo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contratos.length > 100 && (
              <p className="text-xs text-gray-400 text-center py-2 bg-slate-50">
                Mostrando 100 de {contratos.length} contratos
              </p>
            )}
          </div>
        </div>

        {/* Gráficos laterales */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Distribución por estado
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={estadoCount} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={72} innerRadius={28}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {estadoCount.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Top 10 por EP Consumido
            </h2>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={[...contratos].sort((a, b) => b.EP_Consumido_CLP - a.EP_Consumido_CLP).slice(0, 10)}
                layout="vertical"
              >
                <XAxis type="number" tickFormatter={v => `$${(v/1e9).toFixed(0)}MM`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="codigo_ctt" type="category" tick={{ fontSize: 9 }} width={75} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [clp(Number(v)), 'EP']} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="EP_Consumido_CLP" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
