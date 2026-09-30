import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { getIncidencias } from '../api/client'

// ── helpers ──────────────────────────────────────────────────────────────────
const clp = (n: number) => {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n).toLocaleString('es-CL')}`
}
const clpFull = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

const PALETTE = ['#2563eb','#d97706','#059669','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#6366f1','#14b8a6','#f59e0b']

function impScore(v: string) {
  const s = (v || '').toLowerCase()
  if (s.includes('alto'))  return 3
  if (s.includes('medio')) return 2
  if (s.includes('bajo'))  return 1
  return 0
}
function impColor(v: string) {
  const s = (v || '').toLowerCase()
  if (s.includes('alto'))  return { bg: 'bg-red-100',    text: 'text-red-700' }
  if (s.includes('medio')) return { bg: 'bg-yellow-100', text: 'text-yellow-700' }
  if (s.includes('bajo'))  return { bg: 'bg-green-100',  text: 'text-green-700' }
  return { bg: 'bg-slate-100', text: 'text-slate-500' }
}
function maxImpact(rows: any[]): string {
  const m = Math.max(0, ...rows.map(r => impScore(r.impacto)))
  if (m === 3) return 'Alto'
  if (m === 2) return 'Medio'
  if (m === 1) return 'Bajo'
  return ''
}
function getMonday(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  return m
}
function weekKey(d: Date | null) {
  if (!d || isNaN(d.getTime())) return null
  const m = getMonday(d)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}
function weekLabel(key: string) {
  const [yr, mo, da] = key.split('-')
  const mon = new Date(+yr, +mo - 1, +da)
  const sun = new Date(mon.getTime()); sun.setDate(mon.getDate() + 6)
  const ms = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}-${sun.getDate()} ${ms[mon.getMonth()]}`
    : `${mon.getDate()} ${ms[mon.getMonth()]}-${sun.getDate()} ${ms[sun.getMonth()]}`
}

// ── ImpChip ───────────────────────────────────────────────────────────────────
function ImpChip({ value }: { value: string }) {
  if (!value) return <span className="text-slate-300">—</span>
  const { bg, text } = impColor(value)
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${bg} ${text}`}>{value}</span>
}

// ── EstadoChip ────────────────────────────────────────────────────────────────
function EstadoChip({ value }: { value: string }) {
  const s = (value || '').toLowerCase()
  const cls = s.includes('pendiente') ? 'bg-yellow-100 text-yellow-700'
            : s.includes('corregida') ? 'bg-green-100 text-green-700'
            : s.includes('cerrado')   ? 'bg-slate-100 text-slate-500'
            : 'bg-slate-100 text-slate-500'
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{value || '—'}</span>
}

// ── Drill-down matrix ─────────────────────────────────────────────────────────
function ImpCell({ value }: { value: string }) {
  if (!value) return <td className="px-2 py-1.5 text-center text-slate-200 text-xs">—</td>
  const { bg, text } = impColor(value)
  return <td className={`px-2 py-1.5 text-center text-[11px] font-bold ${bg} ${text}`}>{value}</td>
}

function Matrix({ data }: { data: any[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !(p[k] ?? true) }))

  const proyectos = useMemo(() =>
    [...new Set(data.map(r => r.proyecto).filter(Boolean))].sort(), [data])

  const tree = useMemo(() => {
    const t: Record<string, Record<string, Record<string, Record<string, any[]>>>> = {}
    data.forEach(r => {
      const alc = r.alcance   || '(sin alcance)'
      const con = r.contrato  || '(sin contrato)'
      const pro = r.proveedor || '(sin proveedor)'
      const pry = r.proyecto  || '(sin proyecto)'
      if (!t[alc]) t[alc] = {}
      if (!t[alc][con]) t[alc][con] = {}
      if (!t[alc][con][pro]) t[alc][con][pro] = {}
      if (!t[alc][con][pro][pry]) t[alc][con][pro][pry] = []
      t[alc][con][pro][pry].push(r)
    })
    return t
  }, [data])

  if (!data.length) return <p className="text-xs text-slate-400 py-4 text-center">Sin datos</p>

  return (
    <div className="overflow-auto max-h-[500px] text-xs">
      <table className="w-full border-collapse" style={{ minWidth: Math.max(600, 220 + proyectos.length * 110) }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 text-left font-semibold text-[11px] sticky left-0 bg-slate-800 min-w-[200px]">
              Alcance / Contrato / Proveedor
            </th>
            {proyectos.map(p => (
              <th key={p} className="px-2 py-2 text-center font-semibold text-[10px] min-w-[100px]" title={p}>
                {p.length > 14 ? p.slice(0, 14) + '…' : p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(tree).sort().map(alc => {
            const alcKey  = alc
            const alcOpen = expanded[alcKey] !== false
            const allCons = Object.keys(tree[alc]).sort()
            const alcByProy: Record<string, any[]> = {}
            proyectos.forEach(p => {
              alcByProy[p] = allCons.flatMap(con =>
                Object.values(tree[alc][con]).flatMap(provMap => provMap[p] || []))
            })
            return [
              // Alcance row
              <tr key={alcKey} className="bg-slate-100 hover:bg-slate-200 cursor-pointer" onClick={() => toggle(alcKey)}>
                <td className="px-3 py-2 font-bold text-slate-700 sticky left-0 bg-slate-100">
                  <span className="mr-1.5 text-slate-400">{alcOpen ? '▼' : '▶'}</span>{alc}
                </td>
                {proyectos.map(p => <ImpCell key={p} value={maxImpact(alcByProy[p])} />)}
              </tr>,
              // Contratos
              ...(!alcOpen ? [] : allCons.map(con => {
                const conKey  = `${alcKey}|||${con}`
                const conOpen = expanded[conKey] !== false
                const allProvs = Object.keys(tree[alc][con]).sort()
                const conByProy: Record<string, any[]> = {}
                proyectos.forEach(p => { conByProy[p] = allProvs.flatMap(prov => tree[alc][con][prov][p] || []) })
                return [
                  <tr key={conKey} className="hover:bg-blue-50 cursor-pointer" onClick={() => toggle(conKey)}>
                    <td className="px-3 py-1.5 text-slate-600 sticky left-0 bg-white border-l-2 border-blue-200 pl-6">
                      <span className="mr-1.5 text-slate-300">{conOpen ? '▼' : '▶'}</span>📄 {con.length > 30 ? con.slice(0, 30) + '…' : con}
                    </td>
                    {proyectos.map(p => <ImpCell key={p} value={maxImpact(conByProy[p])} />)}
                  </tr>,
                  ...(!conOpen ? [] : allProvs.map(prov => {
                    const provByProy: Record<string, any[]> = {}
                    proyectos.forEach(p => { provByProy[p] = tree[alc][con][prov][p] || [] })
                    return (
                      <tr key={`${conKey}|||${prov}`} className="hover:bg-slate-50">
                        <td className="px-3 py-1 text-slate-500 italic sticky left-0 bg-white pl-12">
                          🏢 {prov.length > 34 ? prov.slice(0, 34) + '…' : prov}
                        </td>
                        {proyectos.map(p => <ImpCell key={p} value={maxImpact(provByProy[p])} />)}
                      </tr>
                    )
                  }))
                ]
              }))
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Inc = {
  administrador: string; codigo: string; fecha: string; proyecto: string
  contrato: string; proveedor: string; alcance: string; tipo: string
  impacto: string; descripcion: string; estado: string
  horas_perdidas: number; impacto_metros: number; impacto_economico: number
  estado_compromiso: string; categoria_compromiso: string
}

const PAGE_SIZE = 20

export default function EstadoProyectos() {
  const [raw,  setRaw]  = useState<Inc[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filtros
  const [fProyecto,  setFProyecto]  = useState('')
  const [fContrato,  setFContrato]  = useState('')
  const [fAlcance,   setFAlcance]   = useState('')
  const [fImpacto,   setFImpacto]   = useState('')
  const [fTipo,      setFTipo]      = useState('')
  const [fAdmin,     setFAdmin]     = useState('')
  const [fDesde,     setFDesde]     = useState('')
  const [fHasta,     setFHasta]     = useState('')

  useEffect(() => {
    getIncidencias().then(d => { setRaw(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const data = useMemo(() => {
    return raw.filter(r => {
      if (fProyecto && r.proyecto !== fProyecto) return false
      if (fContrato && r.contrato !== fContrato) return false
      if (fAlcance  && r.alcance  !== fAlcance)  return false
      if (fImpacto  && r.impacto  !== fImpacto)  return false
      if (fTipo     && r.tipo     !== fTipo)      return false
      if (fAdmin    && r.administrador !== fAdmin) return false
      if (fDesde) { const d = new Date(r.fecha); if (isNaN(d.getTime()) || d < new Date(fDesde)) return false }
      if (fHasta) { const d = new Date(r.fecha); if (isNaN(d.getTime()) || d > new Date(fHasta + 'T23:59:59')) return false }
      return true
    })
  }, [raw, fProyecto, fContrato, fAlcance, fImpacto, fTipo, fAdmin, fDesde, fHasta])

  const uniq = (key: keyof Inc) => [...new Set(raw.map(r => r[key]).filter(Boolean))].sort() as string[]

  // KPIs
  const kpis = useMemo(() => ({
    total:    data.length,
    pend:     data.filter(r => (r.estado || '').toLowerCase().includes('pendiente')).length,
    corr:     data.filter(r => (r.estado || '').toLowerCase().includes('corregida')).length,
    alto:     data.filter(r => (r.impacto || '').toLowerCase() === 'alto').length,
    horas:    data.reduce((s, r) => s + (r.horas_perdidas || 0), 0),
    eco:      data.reduce((s, r) => s + (r.impacto_economico || 0), 0),
  }), [data])

  // Scatter data
  const scatterByKey = (key: keyof Inc) => {
    const g: Record<string, { scores: number[]; eco: number; horas: number }> = {}
    data.forEach(r => {
      const k = String(r[key] || '(sin dato)')
      if (!g[k]) g[k] = { scores: [], eco: 0, horas: 0 }
      const sc = impScore(r.impacto)
      if (sc > 0) g[k].scores.push(sc)
      g[k].eco   += r.impacto_economico || 0
      g[k].horas += r.horas_perdidas    || 0
    })
    return Object.entries(g).map(([name, v], i) => ({
      name,
      x: v.scores.length ? +(v.scores.reduce((a, b) => a + b, 0) / v.scores.length).toFixed(2) : 0,
      y: v.eco,
      z: Math.max(80, v.horas * 8),
      fill: PALETTE[i % PALETTE.length],
    }))
  }
  const scProy = useMemo(() => scatterByKey('proyecto'), [data])
  const scCont = useMemo(() => scatterByKey('contrato'), [data])

  // Weekly bar
  const weekBar = useMemo(() => {
    const wm: Record<string, { Alto: number; Medio: number; Bajo: number }> = {}
    data.forEach(r => {
      const d = r.fecha ? new Date(r.fecha) : null
      const wk = weekKey(d)
      if (!wk) return
      if (!wm[wk]) wm[wk] = { Alto: 0, Medio: 0, Bajo: 0 }
      const s = (r.impacto || '').toLowerCase()
      if (s.includes('alto'))  wm[wk].Alto++
      else if (s.includes('medio')) wm[wk].Medio++
      else if (s.includes('bajo'))  wm[wk].Bajo++
    })
    return Object.keys(wm).sort().map(k => ({ semana: weekLabel(k), ...wm[k] }))
  }, [data])

  // Pie data
  const pieByKey = (key: keyof Inc) => {
    const g: Record<string, number> = {}
    data.forEach(r => { const k = String(r[key] || '(sin dato)'); g[k] = (g[k] || 0) + (r.impacto_economico || 1) })
    return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value], i) => ({ name, value, fill: PALETTE[i % PALETTE.length] }))
  }
  const pieAlc  = useMemo(() => pieByKey('alcance'),  [data])
  const pieProy = useMemo(() => pieByKey('proyecto'), [data])
  const pieCont = useMemo(() => pieByKey('contrato'), [data])

  // Table
  const tableData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(data.length / PAGE_SIZE)

  const resetFiltros = () => {
    setFProyecto(''); setFContrato(''); setFAlcance(''); setFImpacto('')
    setFTipo(''); setFAdmin(''); setFDesde(''); setFHasta(''); setPage(1)
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  const selCls = "text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"

  return (
    <div>
      <PageHeader title="Estado Proyectos" subtitle="Registro de incidencias por contrato y proyecto" icon="⚠️" />

      {/* Filtros */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Desde</span>
          <input type="date" value={fDesde} onChange={e => { setFDesde(e.target.value); setPage(1) }} className={selCls} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Hasta</span>
          <input type="date" value={fHasta} onChange={e => { setFHasta(e.target.value); setPage(1) }} className={selCls} />
        </div>
        {([['Proyecto', uniq('proyecto'), fProyecto, setFProyecto],
           ['Contrato', uniq('contrato'), fContrato, setFContrato],
           ['Alcance',  uniq('alcance'),  fAlcance,  setFAlcance],
           ['Impacto',  uniq('impacto'),  fImpacto,  setFImpacto],
           ['Tipo',     uniq('tipo'),     fTipo,     setFTipo],
           ['Admin',    uniq('administrador'), fAdmin, setFAdmin],
        ] as [string, string[], string, (v: string) => void][]).map(([label, opts, val, set]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
            <select value={val} onChange={e => { set(e.target.value); setPage(1) }} className={selCls}>
              <option value="">Todos</option>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <button onClick={resetFiltros} className="text-xs text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors">
          ✕ Limpiar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 px-4 pb-3">
        <KpiCard label="Total"          value={kpis.total}           color="blue"   icon="📋" />
        <KpiCard label="Pendientes"     value={kpis.pend}            color="orange" icon="⏳" />
        <KpiCard label="Corregidas"     value={kpis.corr}            color="green"  icon="✅" />
        <KpiCard label="Impacto Alto"   value={kpis.alto}            color="red"    icon="🔴" />
        <KpiCard label="Horas perdidas" value={`${kpis.horas} hrs`}  color="orange" icon="⏱️" />
        <KpiCard label="Imp. Económico" value={clp(kpis.eco)}        color="blue"   icon="💰" />
      </div>

      {/* Matriz */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Matriz de Impacto: Alcance × Contrato × Proveedor → Proyecto
        </h2>
        <p className="text-[11px] text-slate-400 mb-3">
          Impacto máximo por celda · <span className="text-green-600 font-semibold">■ Bajo</span> &nbsp;
          <span className="text-yellow-600 font-semibold">■ Medio</span> &nbsp;
          <span className="text-red-600 font-semibold">■ Alto</span> · Clic en fila para expandir
        </p>
        <Matrix data={data} />
      </div>

      {/* Scatter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 mb-3">
        {[
          { title: 'Impacto por Proyecto', pts: scProy },
          { title: 'Impacto por Contrato', pts: scCont },
        ].map(({ title, pts }) => (
          <div key={title} className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</h2>
            <p className="text-[11px] text-slate-400 mb-3">Eje X: promedio impacto · Eje Y: impacto económico CLP · Tamaño: horas perdidas</p>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" type="number" domain={[0.5, 3.5]} name="Impacto prom."
                  tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  ticks={[1, 2, 3]} tickFormatter={v => v === 1 ? 'Bajo' : v === 2 ? 'Medio' : 'Alto'} />
                <YAxis dataKey="y" type="number" name="Imp. económico"
                  tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={v => clp(v)} width={60} />
                <ZAxis dataKey="z" range={[60, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-slate-800 text-white text-xs rounded-lg p-2.5 shadow-lg space-y-0.5">
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-slate-300">Imp. prom: {d.x.toFixed(2)}</p>
                        <p className="text-slate-300">Imp. econ: {clpFull(d.y)}</p>
                      </div>
                    )
                  }}
                />
                <Scatter data={pts} fill="#2563eb">
                  {pts.map((p, i) => <Cell key={i} fill={p.fill} fillOpacity={0.8} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Bar semanal */}
      <div className="mx-4 mb-3 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Incidencias semanales por impacto</h2>
        <p className="text-[11px] text-slate-400 mb-3">
          Barras agrupadas — <span className="text-red-600 font-semibold">■ Alto</span>&nbsp;
          <span className="text-yellow-600 font-semibold">■ Medio</span>&nbsp;
          <span className="text-green-600 font-semibold">■ Bajo</span>
          &nbsp;·&nbsp;{weekBar.length} semana{weekBar.length !== 1 ? 's' : ''}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weekBar} margin={{ top: 4, right: 16, bottom: 48, left: 0 }}
            barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="semana"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              angle={-40}
              textAnchor="end"
              interval={0}
              height={60}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
            <Bar dataKey="Alto"  fill="#dc2626" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Medio" fill="#d97706" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Bajo"  fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 mb-3">
        {[
          { title: 'Imp. Económico por Alcance',   data: pieAlc  },
          { title: 'Imp. Económico por Proyecto',  data: pieProy },
          { title: 'Imp. Económico por Contrato',  data: pieCont },
        ].map(({ title, data: pd }) => (
          <div key={title} className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pd} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={2}>
                  {pd.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [clp(v), '']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Tabla detalle */}
      <div className="mx-4 mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-gray-700">Detalle de Incidencias</span>
          <span className="text-xs text-slate-400 ml-auto">{data.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left">Fecha</th>
                <th className="px-3 py-2.5 text-left">Tipo</th>
                <th className="px-3 py-2.5 text-left">Descripción</th>
                <th className="px-3 py-2.5 text-left">Contrato</th>
                <th className="px-3 py-2.5 text-left">Proyecto</th>
                <th className="px-3 py-2.5 text-right">Imp. Económico</th>
                <th className="px-3 py-2.5 text-center">Impacto</th>
                <th className="px-3 py-2.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tableData.length === 0
                ? <tr><td colSpan={8} className="text-center py-6 text-slate-400">Sin resultados</td></tr>
                : tableData.map((r, i) => (
                  <tr key={i} className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {r.fecha ? new Date(r.fecha).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.tipo || '—'}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate text-slate-600" title={r.descripcion}>{r.descripcion || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{r.contrato || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-blue-700">{r.proyecto || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{clpFull(r.impacto_economico)}</td>
                    <td className="px-3 py-2 text-center"><ImpChip value={r.impacto} /></td>
                    <td className="px-3 py-2 text-center"><EstadoChip value={r.estado} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:border-blue-300 hover:text-blue-600 transition-colors">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, i, arr) => [
                i > 0 && arr[i - 1] !== p - 1 ? <span key={`e${p}`} className="text-slate-300 px-1">…</span> : null,
                <button key={p} onClick={() => setPage(p)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-colors ${page === p ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}`}>
                  {p}
                </button>
              ])}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:border-blue-300 hover:text-blue-600 transition-colors">›</button>
          </div>
        )}
      </div>
    </div>
  )
}
