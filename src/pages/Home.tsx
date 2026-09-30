import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Link } from 'react-router-dom'
import { getHomeKpis, getEpPorMes, getEpPorTipo } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const SEMAFORO: Record<string, { bg: string; dot: string; label: string }> = {
  VERDE:    { bg: 'bg-emerald-600',  dot: 'bg-emerald-300', label: 'Estado normal — sin alertas críticas' },
  AMARILLO: { bg: 'bg-amber-500',    dot: 'bg-amber-200',   label: 'Advertencia — revisar contratos' },
  NARANJA:  { bg: 'bg-orange-500',   dot: 'bg-orange-200',  label: 'Atención — boletas por vencer' },
  ROJO:     { bg: 'bg-red-600',      dot: 'bg-red-300',     label: 'Crítico — contratos sin saldo' },
}

const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
const mmclp = (v: number) => `$${(v / 1e9).toFixed(1)} MM`

const SHORTCUTS = [
  { to: '/saldo',        icon: '💰', label: 'Saldo Contratos',  color: 'blue' },
  { to: '/proyecciones', icon: '📈', label: 'Proyecciones P&C', color: 'blue' },
  { to: '/analisis',     icon: '🔬', label: 'Por Proyecto',     color: 'blue' },
  { to: '/licitaciones', icon: '📋', label: 'Licitaciones',     color: 'blue' },
  { to: '/alertas',      icon: '🚨', label: 'Alertas',          color: 'red' },
  { to: '/simulacion',   icon: '⚙️', label: 'Simulación',       color: 'blue' },
]

export default function Home() {
  const [kpis, setKpis]   = useState<any>(null)
  const [epMes, setEpMes] = useState<any[]>([])
  const [epTipo,setEpTipo]= useState<any[]>([])

  useEffect(() => {
    getHomeKpis().then(setKpis)
    getEpPorMes().then(setEpMes)
    getEpPorTipo().then(setEpTipo)
  }, [])

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando datos...</div>

  const sem = SEMAFORO[kpis.semaforo] ?? SEMAFORO.ROJO

  return (
    <div>
      <PageHeader
        title="Tablero DAB-DPO — Resumen Ejecutivo"
        subtitle={`EMSA · Actualizado ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`}
        icon="📊"
      />

      {/* Semáforo */}
      <div className={`flex items-center gap-3 px-5 py-2.5 text-white text-sm font-medium ${sem.bg}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${sem.dot} animate-pulse shrink-0`} />
        <span className="font-bold">{kpis.semaforo}</span>
        <span className="opacity-80">·</span>
        <span className="opacity-90">{sem.label}</span>
        {kpis.contratos_negativos > 0 && (
          <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            {kpis.contratos_negativos} sin saldo
          </span>
        )}
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
        <KpiCard label="Presupuesto Total"  value={mmclp(kpis.presupuesto_total_clp)} color="blue"   icon="🏦" />
        <KpiCard label="EP Consumido"       value={mmclp(kpis.ep_consumido_clp)}      color="blue"   icon="📤" sub={`${(kpis.pct_consumido*100).toFixed(1)}% del presupuesto`} />
        <KpiCard label="Saldo Real"         value={mmclp(kpis.saldo_real_clp)}        color="green"  icon="✅" />
        <KpiCard label="Contratos Críticos" value={kpis.contratos_criticos + kpis.contratos_negativos} color="red" icon="🔴" sub="<10% saldo o negativo" />
        <KpiCard label="SOLPEs Activas"     value={kpis.solpes_activas}               color="orange" icon="⏳" />
        <KpiCard label="Boletas Críticas"   value={kpis.boletas_criticas}             color={kpis.boletas_criticas > 0 ? 'red' : 'green'} icon="🏷️" sub="vencen en ≤30 días" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            EP Consumido por Mes (MM CLP)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={epMes} margin={{ top: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => `$${(v/1e9).toFixed(0)}MM`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                width={62}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [clp(Number(v)), 'EP Consumido']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Line
                type="monotone" dataKey="monto" stroke="#2563eb" strokeWidth={2.5}
                dot={false} activeDot={{ r: 5, fill: '#2563eb' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            EP por Tipo de Contrato (MM CLP)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={epTipo} layout="vertical" margin={{ right: 12 }}>
              <XAxis
                type="number" tickFormatter={v => `$${(v/1e9).toFixed(0)}MM`}
                tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
              />
              <YAxis
                dataKey="tipo" type="category"
                tick={{ fontSize: 10, fill: '#374151' }} width={130}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                formatter={(v) => [clp(Number(v)), 'EP']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="monto" fill="#2563eb" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumen de estados + accesos rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 pb-6">
        {/* Resumen estado de saldo */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Resumen por Estado de Saldo
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Negativo',         val: kpis.contratos_negativos,   bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
              { label: 'Crítico (<10%)',    val: kpis.contratos_criticos,    bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-100' },
              { label: 'Advertencia',      val: kpis.contratos_advertencia, bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100' },
              { label: 'Con EP activo',    val: kpis.contratos_con_ep,      bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
              { label: 'Total contratos',  val: kpis.contratos_totales,     bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
            ].map(({ label, val, bg, text, border }) => (
              <div key={label} className={`rounded-lg p-3 border ${bg} ${border} text-center`}>
                <p className={`text-2xl font-bold tabular-nums ${text}`}>{val}</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Barra de progreso presupuestal */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Ejecución presupuestaria</span>
              <span className="font-semibold text-gray-700">{(kpis.pct_consumido * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, kpis.pct_consumido * 100)}%`,
                  background: kpis.pct_consumido > 0.9 ? '#e74c3c' : kpis.pct_consumido > 0.75 ? '#f39c12' : '#2563eb',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>EP: {mmclp(kpis.ep_consumido_clp)}</span>
              <span>Presupuesto: {mmclp(kpis.presupuesto_total_clp)}</span>
            </div>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Módulos
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {SHORTCUTS.map(({ to, icon, label }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
                <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight group-hover:text-blue-700">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
