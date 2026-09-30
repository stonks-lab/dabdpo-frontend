import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, BarChart, AreaChart, Area,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { getMetrosPai, getMetrosAvance } from '../api/client'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k m` : `${Math.round(n)} m`

const fmtFull = (n: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(n) + ' m'

function toMonth(s: string): string {
  if (!s) return ''
  if (/^\d{4}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}
const monthLabel = (m: string) => {
  const [yr, mo] = m.split('-')
  return `${MONTH_LABELS[mo] ?? mo} ${yr}`
}

type PaiRow = Record<string, any>
type AvRow  = Record<string, any>

// Detecta la columna de metros real en avance (flexible por nombre)
function metrosRealCol(row: AvRow): string {
  return Object.keys(row).find(k =>
    k.includes('metro') && (k.includes('real') || k.includes('avance'))
  ) ?? Object.keys(row).find(k => k.includes('metro')) ?? ''
}

export default function MetrosPerforados() {
  const [rawPai,  setRawPai]  = useState<PaiRow[]>([])
  const [rawAv,   setRawAv]   = useState<AvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [fProy,  setFProy]  = useState('')
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')

  useEffect(() => {
    Promise.all([getMetrosPai(), getMetrosAvance()])
      .then(([pai, av]) => { setRawPai(pai); setRawAv(av) })
      .catch(e => setError(String(e?.response?.data?.detail ?? e)))
      .finally(() => setLoading(false))
  }, [])

  // Clave de proyecto en cada tabla
  const proyPaiKey = useMemo(() =>
    rawPai[0] ? (Object.keys(rawPai[0]).find(k => k.includes('project') || k.includes('blanco')) ?? 'projectcode') : 'projectcode',
  [rawPai])
  const proyAvKey = useMemo(() =>
    rawAv[0] ? (Object.keys(rawAv[0]).find(k => k.includes('proyecto') || k.includes('project')) ?? 'proyecto') : 'proyecto',
  [rawAv])
  const metRealKey = useMemo(() =>
    rawAv[0] ? metrosRealCol(rawAv[0]) : '',
  [rawAv])
  const fechaAvKey = useMemo(() =>
    rawAv[0] ? (Object.keys(rawAv[0]).find(k => k.includes('fecha') && !k.includes('carga')) ?? 'fecha') : 'fecha',
  [rawAv])

  const proyectosPai = useMemo(() =>
    [...new Set(rawPai.map(r => String(r[proyPaiKey] ?? '')).filter(Boolean))].sort(),
  [rawPai, proyPaiKey])

  // Filtros
  const pai = useMemo(() => rawPai.filter(r => {
    if (fProy && String(r[proyPaiKey]) !== fProy) return false
    if (fDesde && toMonth(String(r.mes ?? '')) < fDesde) return false
    if (fHasta && toMonth(String(r.mes ?? '')) > fHasta) return false
    return true
  }), [rawPai, fProy, fDesde, fHasta, proyPaiKey])

  const av = useMemo(() => rawAv.filter(r => {
    if (fProy && String(r[proyAvKey]) !== fProy) return false
    if (fDesde) { const m = toMonth(String(r[fechaAvKey] ?? '')); if (!m || m < fDesde) return false }
    if (fHasta) { const m = toMonth(String(r[fechaAvKey] ?? '')); if (!m || m > fHasta) return false }
    return true
  }), [rawAv, fProy, fDesde, fHasta, proyAvKey, fechaAvKey])

  // KPIs
  const kpis = useMemo(() => {
    const totalPai  = pai.reduce((s, r) => s + (Number(r.metros_pai) || 0), 0)
    const totalReal = av.reduce((s,  r) => s + (Number(r[metRealKey]) || 0), 0)
    const pct       = totalPai > 0 ? (totalReal / totalPai) * 100 : 0
    const proyectos = new Set(pai.map(r => String(r[proyPaiKey]))).size
    const ultimaCarga = rawAv
      .map(r => String(r.fecha_carga ?? r.fecha_de_carga ?? ''))
      .filter(Boolean).sort().at(-1) ?? ''
    return { totalPai, totalReal, pct, proyectos, ultimaCarga }
  }, [pai, av, metRealKey, proyPaiKey, rawAv])

  // Datos mensuales para gráfico comparativo
  const monthlyData = useMemo(() => {
    const mp: Record<string, number> = {}
    const mr: Record<string, number> = {}
    pai.forEach(r => {
      const m = toMonth(String(r.mes ?? ''))
      if (m) mp[m] = (mp[m] ?? 0) + (Number(r.metros_pai) || 0)
    })
    av.forEach(r => {
      const m = toMonth(String(r[fechaAvKey] ?? ''))
      if (m) mr[m] = (mr[m] ?? 0) + (Number(r[metRealKey]) || 0)
    })
    const months = [...new Set([...Object.keys(mp), ...Object.keys(mr)])].sort()
    let cumPai = 0, cumReal = 0
    return months.map(m => {
      cumPai  += mp[m]  ?? 0
      cumReal += mr[m]  ?? 0
      return {
        mes:          monthLabel(m),
        metros_pai:   mp[m]  ?? 0,
        metros_real:  mr[m]  ?? 0,
        cum_pai:      cumPai,
        cum_real:     cumReal,
      }
    })
  }, [pai, av, metRealKey, fechaAvKey])

  // Datos por proyecto
  const byProy = useMemo(() => {
    const mp: Record<string, number> = {}
    const mr: Record<string, number> = {}
    pai.forEach(r => {
      const k = String(r[proyPaiKey] ?? '(sin proyecto)')
      mp[k] = (mp[k] ?? 0) + (Number(r.metros_pai) || 0)
    })
    av.forEach(r => {
      const k = String(r[proyAvKey] ?? '(sin proyecto)')
      mr[k] = (mr[k] ?? 0) + (Number(r[metRealKey]) || 0)
    })
    const keys = [...new Set([...Object.keys(mp), ...Object.keys(mr)])]
    return keys
      .map(k => ({ proyecto: k, metros_pai: mp[k] ?? 0, metros_real: mr[k] ?? 0 }))
      .sort((a, b) => b.metros_pai - a.metros_pai)
      .slice(0, 15)
  }, [pai, av, proyPaiKey, proyAvKey, metRealKey])

  if (loading) return <div className="p-6 text-slate-400 text-sm">Cargando datos...</div>
  if (error)   return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <p className="font-semibold mb-1">Error al conectar</p>
        <p className="font-mono text-xs">{error}</p>
      </div>
    </div>
  )

  const selCls = "text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
  const pctColor = kpis.pct >= 90 ? 'green' : kpis.pct >= 60 ? 'orange' : 'red'

  return (
    <div>
      <PageHeader title="Metros Perforados" subtitle="PAI vs avance real por proyecto y período" icon="⛏️" />

      {/* Filtros */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Proyecto</span>
          <select value={fProy} onChange={e => setFProy(e.target.value)} className={selCls}>
            <option value="">Todos</option>
            {proyectosPai.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Desde (mes)</span>
          <input type="month" value={fDesde} onChange={e => setFDesde(e.target.value)} className={selCls} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Hasta (mes)</span>
          <input type="month" value={fHasta} onChange={e => setFHasta(e.target.value)} className={selCls} />
        </div>
        <button
          onClick={() => { setFProy(''); setFDesde(''); setFHasta('') }}
          className="text-xs text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          ✕ Limpiar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 pb-3">
        <KpiCard label="Metros PAI"    value={fmt(kpis.totalPai)}  color="blue"   icon="📋" />
        <KpiCard label="Metros Real"   value={fmt(kpis.totalReal)} color="green"  icon="⛏️" />
        <KpiCard label="% Avance"      value={`${kpis.pct.toFixed(1)}%`} color={pctColor} icon="📊" />
        <KpiCard label="Proyectos"     value={kpis.proyectos}      color="blue"   icon="🏗️" />
        <KpiCard label="Última carga"  value={kpis.ultimaCarga || '—'} color="orange" icon="🕐" />
      </div>

      {/* Gráfico mensual PAI vs Real */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Metros mensuales — PAI vs Avance Real
        </h2>
        <p className="text-[11px] text-slate-400 mb-3">
          Barras: metros del período · Líneas: acumulado
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={monthlyData} margin={{ top: 4, right: 24, bottom: 40, left: 8 }}
            barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6b7280' }}
              angle={-35} textAnchor="end" interval={0} height={60}
              axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={65} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} width={65} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              formatter={(v: any, name: any) => [fmtFull(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
            <Bar yAxisId="left" dataKey="metros_pai"  name="PAI"        fill="#93c5fd" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="metros_real" name="Real"       fill="#2563eb" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cum_pai"  name="Acum. PAI"  stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="cum_real" name="Acum. Real" stroke="#059669" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Por proyecto */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Metros por Proyecto — PAI vs Real
        </h2>
        <p className="text-[11px] text-slate-400 mb-3">Top 15 proyectos por metros PAI</p>
        <ResponsiveContainer width="100%" height={Math.max(240, byProy.length * 34)}>
          <BarChart data={byProy} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 8 }}
            barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
            <YAxis type="category" dataKey="proyecto" width={180}
              tick={{ fontSize: 10, fill: '#374151' }} axisLine={false} tickLine={false}
              tickFormatter={v => v.length > 28 ? v.slice(0, 28) + '…' : v} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              formatter={(v: any, name: any) => [fmtFull(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
            <Bar dataKey="metros_pai"  name="PAI"  fill="#93c5fd" radius={[0, 3, 3, 0]} />
            <Bar dataKey="metros_real" name="Real" fill="#2563eb" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Acumulado real vs PAI acumulado */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Avance Acumulado
        </h2>
        <p className="text-[11px] text-slate-400 mb-3">Metros acumulados PAI vs real en el tiempo</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyData} margin={{ top: 4, right: 24, bottom: 40, left: 8 }}>
            <defs>
              <linearGradient id="gradPai"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#059669" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6b7280' }}
              angle={-35} textAnchor="end" interval={0} height={60}
              axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
              tickFormatter={v => fmt(v)} width={65} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              formatter={(v: any, name: any) => [fmtFull(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
            <Area type="monotone" dataKey="cum_pai"  name="Acum. PAI"  stroke="#f59e0b"
              strokeWidth={2} fill="url(#gradPai)"  />
            <Area type="monotone" dataKey="cum_real" name="Acum. Real" stroke="#059669"
              strokeWidth={2} fill="url(#gradReal)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla avance detalle */}
      <div className="mx-4 mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-gray-700">Detalle Avance Real</span>
          <span className="text-xs text-slate-400 ml-auto">{av.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Fecha</th>
                <th className="px-3 py-2.5 text-left">Proyecto</th>
                <th className="px-3 py-2.5 text-left">Campaña</th>
                <th className="px-3 py-2.5 text-right">Metros Real</th>
              </tr>
            </thead>
            <tbody>
              {av.length === 0
                ? <tr><td colSpan={4} className="text-center py-6 text-slate-400">Sin resultados</td></tr>
                : av.slice(0, 200).map((r, i) => (
                  <tr key={i} className={`border-t border-slate-50 hover:bg-blue-50/30 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {r[fechaAvKey] ? new Date(r[fechaAvKey]).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-blue-700">{String(r[proyAvKey] ?? '—')}</td>
                    <td className="px-3 py-2 text-slate-600">{String(r.campana ?? r.campaña ?? '—')}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {metRealKey ? fmtFull(Number(r[metRealKey]) || 0) : '—'}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {av.length > 200 && (
          <p className="text-center text-xs text-slate-400 py-2 border-t border-slate-100">
            Mostrando 200 de {av.length} registros · usa los filtros para acotar
          </p>
        )}
      </div>
    </div>
  )
}
