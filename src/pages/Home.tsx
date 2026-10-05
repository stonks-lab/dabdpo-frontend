import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Link } from 'react-router-dom'
import { getHomeKpis, getHomeFiltros, getEpPorMes, getEpPorTipo, getDpoCostoMetroUltimo, getContratos, getAlertasBoletas, getEstadoProyectosResumen, getHomeCampanaProyectos } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'
import MultiSelectSearch from '../components/MultiSelectSearch'

const ALCANCE_COLORS = [
  'var(--navy-500)', 'var(--gold-500)', '#64748b', '#0ea5e9',
  '#8b5cf6', '#10b981', '#f97316', '#ec4899',
]

const IMPACTO_ORDER: Record<string, number> = { Alto: 0, Medio: 1, Bajo: 2 }

const SEM_CLASS: Record<string, string> = {
  VERDE:    'verde',
  AMARILLO: 'amarillo',
  NARANJA:  'naranja',
  ROJO:     'rojo',
}
const SEM_LABEL: Record<string, string> = {
  VERDE:    'Estado normal — sin alertas críticas',
  AMARILLO: 'Advertencia — revisar contratos',
  NARANJA:  'Atención — boletas por vencer',
  ROJO:     'Crítico — contratos sin saldo',
}

const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)
const mmclp = (v: number) => `$${(v / 1e9).toFixed(1)} Miles M CLP`

const SHORTCUTS = [
  { to: '/saldo',           icon: '💰', label: 'Saldo Contratos' },
  { to: '/proyecciones',    icon: '📈', label: 'Proyecciones P&C' },
  { to: '/analisis',        icon: '🔬', label: 'Por Proyecto' },
  { to: '/modificaciones',  icon: '🔄', label: 'Modificaciones' },
  { to: '/licitaciones',    icon: '📋', label: 'Licitaciones' },
  { to: '/alertas',         icon: '🚨', label: 'Alertas' },
]

const ESTADO_SALDO = [
  { key: 'contratos_negativos',   label: 'Negativo',            color: 'var(--error-500)',   bg: 'var(--error-50)',   panel: 'saldo_negativo',    estados: ['NEGATIVO'] },
  { key: 'contratos_criticos',    label: 'Crítico (<10%)',       color: '#c0392b',            bg: '#fdf2f2',           panel: 'saldo_critico',     estados: ['CRÍTICO'] },
  { key: 'contratos_advertencia', label: 'Advertencia (10-25%)', color: 'var(--warning-500)', bg: 'var(--warning-50)', panel: 'saldo_advertencia', estados: ['ADVERTENCIA'] },
  { key: 'contratos_regulares',   label: 'Regulares',            color: 'var(--navy-400)',    bg: 'var(--navy-50)',    panel: 'saldo_regulares',   estados: ['ATENCIÓN', 'OK'] },
  { key: 'contratos_totales',     label: 'Total',                color: 'var(--gray-700)',    bg: 'var(--gray-100)',   panel: 'saldo_total',       estados: [] },
]

const PANEL_TITLES: Record<string, string> = {
  criticos:          'Contratos Críticos y Negativos',
  advertencia:       'Contratos en Advertencia',
  boletas_vencidas:  'Boletas Vencidas',
  boletas_criticas:  'Boletas Críticas — vencen en ≤30 días',
  saldo_negativo:    'Contratos con Saldo Negativo',
  saldo_critico:     'Contratos Críticos (<10% saldo)',
  saldo_advertencia: 'Contratos en Advertencia (10–25%)',
  saldo_regulares:   'Contratos Regulares (>25% saldo)',
  saldo_total:       'Todos los Contratos',
}

export default function Home() {
  const [kpis,       setKpis]       = useState<any>(null)
  const [epMes,      setEpMes]      = useState<{ rows: any[]; alcances: string[] }>({ rows: [], alcances: [] })
  const [epTipo,     setEpTipo]     = useState<any[]>([])
  const [costoMetro,      setCostoMetro]      = useState<any>(null)
  const [estadoProyectos,  setEstadoProyectos]  = useState<any>(null)
  const [proyDetailPanel,  setProyDetailPanel]  = useState<string | null>(null)
  const [proyDetailData,   setProyDetailData]   = useState<any[]>([])
  const [proyDetailLoading,setProyDetailLoading]= useState(false)
  const proyDetailRef = useRef<HTMLDivElement>(null)
  const [activeImpactoPie,   setActiveImpactoPie]   = useState<number | null>(null)
  const [activeTipoPie,      setActiveTipoPie]      = useState<number | null>(null)
  const [donutDetailKey,     setDonutDetailKey]     = useState<string | null>(null)
  const [donutDetailLabel,   setDonutDetailLabel]   = useState('')
  const [donutDetailData,    setDonutDetailData]    = useState<any[]>([])
  const [donutDetailLoading, setDonutDetailLoading] = useState(false)
  const donutDetailRef = useRef<HTMLDivElement>(null)
  const [donutDetailSort, setDonutDetailSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'fecha', dir: 'desc' })
  const [proyDetailSort,  setProyDetailSort]  = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'fecha', dir: 'desc' })
  const [filtros,       setFiltros]       = useState<any>(null)
  const [filters,           setFilters]           = useState({ estado_ctt: '', area: '', tipo: '', desde: '', hasta: '' })
  const [selProyectos,      setSelProyectos]      = useState<string[]>([])
  const [selContratos,      setSelContratos]      = useState<string[]>([])
  const [selCampanas,       setSelCampanas]       = useState<string[]>([])
  const [campanaProyectos,  setCampanaProyectos]  = useState<string[]>([])
  const [activePie,     setActivePie]     = useState<number | null>(null)
  const [activeBar,     setActiveBar]     = useState<string | null>(null)
  const [detailPanel,   setDetailPanel]   = useState<string | null>(null)
  const [detailData,    setDetailData]    = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailSort,    setDetailSort]    = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'Pct_Saldo', dir: 'asc' })
  const detailRef      = useRef<HTMLDivElement>(null)
  const saldoDetailRef = useRef<HTMLDivElement>(null)

  // Carga filtros (una sola vez)
  useEffect(() => {
    getHomeFiltros().then(setFiltros).catch(() => {})
  }, [])

  // Recarga costoMetro cuando cambian las campañas seleccionadas
  useEffect(() => {
    const campana = selCampanas.length > 0 ? selCampanas[0] : undefined
    getDpoCostoMetroUltimo(campana ? { campana } : undefined).then(setCostoMetro).catch(() => null)
  }, [selCampanas])

  // Resuelve proyectos de las campañas seleccionadas para filtrado local de incidencias
  useEffect(() => {
    if (!selCampanas.length) { setCampanaProyectos([]); return }
    getHomeCampanaProyectos(selCampanas.join(',')).then(setCampanaProyectos).catch(() => setCampanaProyectos([]))
  }, [selCampanas])

  // Recarga Estado de Proyectos cuando cambian filtros de proyecto/contrato/campaña
  useEffect(() => {
    const p: Record<string, string> = {}
    if (selProyectos.length) p.proyecto = selProyectos.join(',')
    if (selContratos.length) p.contrato = selContratos.join(',')
    if (selCampanas.length)  p.campana  = selCampanas.join(',')
    setEstadoProyectos(null)
    setDonutDetailKey(null); setDonutDetailData([])
    setProyDetailPanel(null); setProyDetailData([])
    setActiveImpactoPie(null); setActiveTipoPie(null)
    getEstadoProyectosResumen(Object.keys(p).length ? p : undefined).then(setEstadoProyectos).catch(() => null)
  }, [selProyectos, selContratos, selCampanas])

  // Recarga KPIs y gráficos cuando cambian los filtros
  useEffect(() => {
    const p: Record<string, string> = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    if (selProyectos.length) p.proyecto = selProyectos.join(',')
    if (selContratos.length) p.contrato = selContratos.join(',')
    if (selCampanas.length)  p.campana  = selCampanas.join(',')
    setKpis(null)
    setDetailPanel(null)
    setDetailData([])
    setActivePie(null)
    setActiveBar(null)
    Promise.all([
      getHomeKpis(p),
      getEpPorMes(p),
      getEpPorTipo(p),
    ]).then(([k, mes, tipo]) => {
      setKpis(k); setEpMes(mes); setEpTipo(tipo)
    })
  }, [filters, selProyectos, selContratos, selCampanas])

  const setFilter  = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))
  const hasFilters = Object.values(filters).some(Boolean) || selProyectos.length > 0 || selContratos.length > 0 || selCampanas.length > 0
  const INPUT_STYLE = { fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: '#fff' }

  const buildHomeP = () => {
    const p: Record<string, string> = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    if (selProyectos.length) p.proyecto = selProyectos.join(',')
    if (selContratos.length) p.contrato = selContratos.join(',')
    if (selCampanas.length)  p.campana  = selCampanas.join(',')
    return p
  }

  const openDetail = async (panel: string, estados: string[]) => {
    // toggle: si ya está abierto, cierra
    if (detailPanel === panel) {
      setDetailPanel(null); setDetailData([]); return
    }
    setDetailPanel(panel)
    setLoadingDetail(true)
    try {
      if (panel === 'boletas_criticas' || panel === 'boletas_vencidas') {
        setDetailSort({ col: 'Dias_Para_Vencer', dir: 'asc' })
        const rows = await getAlertasBoletas(buildHomeP())
        const alerta = panel === 'boletas_vencidas' ? 'VENCIDA' : 'CRÍTICO'
        setDetailData((rows as any[]).filter(r => r.Alerta_Vencimiento === alerta))
      } else {
        setDetailSort({ col: 'Pct_Saldo', dir: 'asc' })
        const homeP = buildHomeP()
        let flat: any[]
        if (estados.length === 0) {
          flat = await getContratos(homeP)
        } else {
          const rows = await Promise.all(estados.map(e => getContratos({ ...homeP, estado_saldo: e })))
          flat = rows.flat()
        }
        setDetailData(flat.sort((a: any, b: any) => a.Pct_Saldo - b.Pct_Saldo))
      }
    } finally {
      setLoadingDetail(false)
      const ref = panel.startsWith('saldo_') ? saldoDetailRef : detailRef
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  if (!kpis && !filtros) return <div className="loading">Cargando datos...</div>

  const semClass = kpis ? (SEM_CLASS[kpis.semaforo] ?? 'rojo') : 'verde'
  const semLabel = kpis ? (SEM_LABEL[kpis.semaforo] ?? 'Crítico') : '…'
  const pct      = kpis ? kpis.pct_consumido * 100 : 0

  return (
    <>
      <PageHeader
        title="Tablero DAB-DPO — Resumen Ejecutivo"
        subtitle={`EMSA · Actualizado ${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}`}
        icon="📊"
      />

      {/* Semáforo */}
      <div className={`semaforo-bar ${semClass}`}>
        <span style={{
          display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
          background: semClass === 'verde' ? 'var(--success-500)' : semClass === 'rojo' ? 'var(--error-500)' : 'var(--warning-500)',
          flexShrink: 0,
        }} />
        <strong>{kpis?.semaforo ?? '…'}</strong>
        <span>·</span>
        <span>{semLabel}</span>
        {kpis?.contratos_negativos > 0 && (
          <span className="chip danger" style={{ marginLeft: 'auto' }}>
            {kpis.contratos_negativos} sin saldo
          </span>
        )}
      </div>

      {/* Barra de filtros */}
      {filtros && (
        <div className="filters-bar" style={{ gap: 8, flexWrap: 'wrap' }}>
          {/* Estado contrato — el más importante */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['', ...(filtros.estados_ctt ?? [])].map((v: string) => (
              <button
                key={v || '__todos__'}
                onClick={() => setFilter('estado_ctt', v)}
                className={filters.estado_ctt === v ? 'btn' : 'btn btn-ghost'}
                style={{ fontSize: 12, padding: '3px 10px' }}
              >
                {v || 'Todos'}
              </button>
            ))}
          </div>

          <div style={{ width: 1, background: 'var(--color-border)', alignSelf: 'stretch' }} />

          {/* Área */}
          <select
            value={filters.area}
            onChange={e => setFilter('area', e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
          >
            <option value="">— Área —</option>
            {(filtros.areas ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>

          {/* Tipo contrato */}
          <select
            value={filters.tipo}
            onChange={e => setFilter('tipo', e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
          >
            <option value="">— Tipo contrato —</option>
            {(filtros.tipos ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>

          <div style={{ width: 1, background: 'var(--color-border)', alignSelf: 'stretch' }} />

          {/* Proyecto multi-select */}
          {(filtros.proyectos ?? []).length > 0 && (
            <MultiSelectSearch
              options={(filtros.proyectos ?? []).map((p: string) => ({ value: p, label: p }))}
              selected={selProyectos}
              onChange={setSelProyectos}
              placeholder="Proyecto…"
              width={180}
            />
          )}

          {/* Contrato multi-select con código + nombre */}
          {(filtros.contratos ?? []).length > 0 && (
            <MultiSelectSearch
              options={(filtros.contratos ?? []).map((c: any) => ({
                value: c.codigo,
                label: c.nombre ? `${c.codigo} — ${c.nombre}` : c.codigo,
              }))}
              selected={selContratos}
              onChange={setSelContratos}
              placeholder="Contrato…"
              width={220}
            />
          )}

          {/* Campaña multi-select */}
          {(filtros.campanas ?? []).length > 0 && (
            <MultiSelectSearch
              options={(filtros.campanas ?? []).map((c: string) => ({ value: c, label: c }))}
              selected={selCampanas}
              onChange={setSelCampanas}
              placeholder="Campaña…"
              width={180}
            />
          )}

          <div style={{ width: 1, background: 'var(--color-border)', alignSelf: 'stretch' }} />

          {/* Rango de fechas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Desde</span>
            <input type="month" value={filters.desde} onChange={e => setFilter('desde', e.target.value)}
              style={INPUT_STYLE} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Hasta</span>
            <input type="month" value={filters.hasta} onChange={e => setFilter('hasta', e.target.value)}
              style={INPUT_STYLE} />
          </div>

          {hasFilters && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={() => { setFilters({ estado_ctt: '', area: '', tipo: '', desde: '', hasta: '' }); setSelProyectos([]); setSelContratos([]); setSelCampanas([]) }}>
              ✕ Limpiar
            </button>
          )}

          {hasFilters && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
              Filtrando por:{' '}
              {[
                filters.estado_ctt          && `Estado: ${filters.estado_ctt}`,
                filters.area                && `Área: ${filters.area}`,
                filters.tipo                && `Tipo: ${filters.tipo}`,
                selCampanas.length > 0      && `Campaña: ${selCampanas.join(', ')}`,
                selProyectos.length > 0     && `Proyecto: ${selProyectos.join(', ')}`,
                selContratos.length > 0     && `Contrato: ${selContratos.join(', ')}`,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}

      <div className="page">

        {/* Costo Metro — último mes */}
        {costoMetro && (
          <section className="panel">
            <h2>Costo Metro — {costoMetro.mes_nombre} {costoMetro.anio}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) auto', gap: 12, alignItems: 'center' }}>
              {[
                { label: 'Programado', value: `${costoMetro.costo_metro_programado.toFixed(2)} US$/m`, color: 'var(--navy-400)' },
                { label: 'Real',       value: `${costoMetro.costo_metro_real.toFixed(2)} US$/m`,
                  color: costoMetro.costo_metro_real > costoMetro.costo_metro_programado ? 'var(--error-500)' : 'var(--success-500)' },
                { label: 'Brecha Ajustada', value: `${(costoMetro.brecha * 100).toFixed(2)}%`,
                  color: costoMetro.brecha < 0 ? 'var(--success-500)' : costoMetro.brecha > 0.05 ? 'var(--error-500)' : 'var(--warning-500)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--gray-50)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--gray-200)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block' }}>{label}</span>
                  <strong style={{ fontSize: 20, fontWeight: 800, color, display: 'block', marginTop: 4, lineHeight: 1.1 }}>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* KPIs */}
        {kpis
          ? <div className="kpi-grid">
              <KpiCard label="Presupuesto Total"  value={mmclp(kpis.presupuesto_total_clp)} color="blue" />
              <KpiCard label="EP Consumido"       value={mmclp(kpis.ep_consumido_clp)}      color="blue"   sub={`${pct.toFixed(1)}% del presupuesto`} />
              <KpiCard label="Saldo Real"         value={mmclp(kpis.saldo_real_clp)}        color="green" />
              <KpiCard
                label="Contratos Críticos"
                value={kpis.contratos_criticos + kpis.contratos_negativos}
                color="red"
                sub={detailPanel === 'criticos' ? '▲ ocultar detalle' : '<10% saldo o negativo · ver detalle'}
                onClick={() => openDetail('criticos', ['CRÍTICO', 'NEGATIVO'])}
              />
              <KpiCard
                label="En Advertencia"
                value={kpis.contratos_advertencia}
                color="yellow"
                sub={detailPanel === 'advertencia' ? '▲ ocultar detalle' : '10–25% saldo restante · ver detalle'}
                onClick={() => openDetail('advertencia', ['ADVERTENCIA'])}
              />
              <KpiCard label="SOLPEs Activas"     value={kpis.solpes_activas}               color="orange" />
              <KpiCard
                label="Boletas Vencidas"
                value={kpis.boletas_vencidas ?? 0}
                color="red"
                sub={detailPanel === 'boletas_vencidas' ? '▲ ocultar detalle' : 'boletas ya vencidas · ver detalle'}
                onClick={() => openDetail('boletas_vencidas', [])}
              />
              <KpiCard
                label="Boletas Críticas"
                value={kpis.boletas_criticas}
                color="yellow"
                sub={detailPanel === 'boletas_criticas' ? '▲ ocultar detalle' : 'vencen en ≤30 días · ver detalle'}
                onClick={() => openDetail('boletas_criticas', [])}
              />
            </div>
          : <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 0' }}>Recalculando…</div>
        }

        {/* Panel de detalle de contratos (KPI cards superiores) */}
        {detailPanel && !detailPanel.startsWith('saldo_') && (
          <div ref={detailRef} className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>
                {`${PANEL_TITLES[detailPanel ?? ''] ?? detailPanel} (${detailData.length})`}
                {hasFilters && detailPanel !== 'boletas_criticas' && detailPanel !== 'boletas_vencidas' && (
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                    · filtrado por {[filters.estado_ctt, filters.area, filters.tipo].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <button className="btn btn-ghost" onClick={() => { setDetailPanel(null); setDetailData([]) }}>✕</button>
            </div>

            {loadingDetail
              ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {detailPanel?.startsWith('boletas') ? 'Cargando boletas…' : 'Cargando contratos…'}
                </p>
              : detailData.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {detailPanel?.startsWith('boletas') ? 'Sin boletas en esta categoría.' : 'Sin contratos en esta categoría con los filtros actuales.'}
                  </p>
                : detailPanel?.startsWith('boletas')
                  ? (() => {
                      const { col, dir } = detailSort
                      const sorted = [...detailData].sort((a, b) => {
                        const av = a[col] ?? 0, bv = b[col] ?? 0
                        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
                        return dir === 'asc' ? cmp : -cmp
                      })
                      const thSort = (c: string, label: string, align?: string) => {
                        const active = detailSort.col === c
                        return (
                          <th
                            onClick={() => setDetailSort(s => ({ col: c, dir: s.col === c && s.dir === 'asc' ? 'desc' : 'asc' }))}
                            style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: align as any }}
                          >
                            {label}{' '}
                            <span style={{ opacity: active ? 1 : 0.25, color: active ? 'var(--gold-500)' : undefined }}>
                              {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
                            </span>
                          </th>
                        )
                      }
                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="data-table">
                            <thead><tr>
                              {thSort('Contrato',           'Contrato')}
                              {thSort('Nro Boleta',         'Nro Boleta')}
                              {thSort('Servicio',           'Servicio')}
                              {thSort('Proveedor',          'Proveedor')}
                              {thSort('Monto',              'Monto',            'right')}
                              {thSort('Fecha_Vencimiento',  'Vencimiento')}
                              {thSort('Dias_Para_Vencer',   'Días restantes',   'right')}
                              {thSort('Alerta_Vencimiento', 'Alerta')}
                              {thSort('Estado_Garantia',    'Estado garantía')}
                            </tr></thead>
                            <tbody>
                              {sorted.map((b, i) => {
                                const vencida  = b.Alerta_Vencimiento === 'VENCIDA'
                                const critica  = b.Alerta_Vencimiento === 'CRÍTICO'
                                const rowBg    = vencida ? '#fef2f2' : critica ? '#fff7ed' : undefined
                                const diasColor = b.Dias_Para_Vencer <= 0 ? '#dc2626' : b.Dias_Para_Vencer <= 15 ? '#ea580c' : '#d97706'
                                return (
                                  <tr key={i} style={{ background: rowBg }}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.Contrato}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{b['Nro Boleta']}</td>
                                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                      title={b.Servicio}>{b.Servicio || '—'}</td>
                                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                      title={b.Proveedor}>{b.Proveedor || '—'}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                      {new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(b.Monto)}{' '}
                                      <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{b.Moneda}</span>
                                    </td>
                                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{b.Fecha_Vencimiento}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: diasColor }}>
                                      {b.Dias_Para_Vencer <= 0 ? 'VENCIDA' : `${b.Dias_Para_Vencer} días`}
                                    </td>
                                    <td>
                                      <span className={`chip ${vencida || critica ? 'danger' : 'warn'}`}>
                                        {b.Alerta_Vencimiento}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{b.Estado_Garantia || '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()
                  : (() => {
                      const { col, dir } = detailSort
                      const sorted = [...detailData].sort((a, b) => {
                        const av = a[col] ?? 0, bv = b[col] ?? 0
                        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
                        return dir === 'asc' ? cmp : -cmp
                      })
                      const thSort = (c: string, label: string, align?: string) => {
                        const active = detailSort.col === c
                        return (
                          <th
                            onClick={() => setDetailSort(s => ({ col: c, dir: s.col === c && s.dir === 'asc' ? 'desc' : 'asc' }))}
                            style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: align as any }}
                          >
                            {label}{' '}
                            <span style={{ opacity: active ? 1 : 0.25, color: active ? 'var(--gold-500)' : undefined }}>
                              {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
                            </span>
                          </th>
                        )
                      }
                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="data-table">
                            <thead><tr>
                              {thSort('codigo_ctt',       'Contrato')}
                              {thSort('Descripcion_ctt',  'Descripción')}
                              {thSort('Area_contrato',    'Área')}
                              {thSort('Estado_ctt',       'Estado')}
                              {thSort('Presupuesto_CLP',  'Presupuesto',  'right')}
                              {thSort('EP_Consumido_CLP', 'EP Consumido', 'right')}
                              {thSort('Saldo_CLP',        'Saldo',        'right')}
                              {thSort('Pct_Saldo',        '% Saldo')}
                            </tr></thead>
                            <tbody>
                              {sorted.map((c, i) => (
                                <tr key={i} style={{ background: c.Saldo_CLP < 0 ? '#fef2f2' : undefined }}>
                                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.codigo_ctt}</td>
                                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    title={c.Descripcion_ctt}>{c.Descripcion_ctt}</td>
                                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.Area_contrato || '—'}</td>
                                  <td>
                                    <span className={`chip ${c.Estado_ctt === 'Vigente' ? 'ok' : 'warn'}`}>{c.Estado_ctt}</span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mmclp(c.Presupuesto_CLP)}</td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mmclp(c.EP_Consumido_CLP)}</td>
                                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                                    color: c.Saldo_CLP < 0 ? '#dc2626' : '#d97706' }}>
                                    {mmclp(c.Saldo_CLP)}
                                  </td>
                                  <td>
                                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, marginBottom: 2 }}>
                                      <div style={{
                                        height: 6, borderRadius: 99,
                                        width: `${Math.max(0, Math.min(100, c.Pct_Saldo * 100))}%`,
                                        background: c.Saldo_CLP < 0 ? '#dc2626' : '#f39c12',
                                      }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                      {(c.Pct_Saldo * 100).toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()
            }
          </div>
        )}

        {/* Gráficos */}
        <div className="two-col">
          <section className="panel">
            <h2>EP Consumido por Mes (Miles M CLP)</h2>
            {(() => {
              const renderTooltip = ({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const total = (payload[0]?.payload?.monto as number) ?? 0
                return (
                  <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '6px 10px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{label}</span>
                    <span style={{ marginLeft: 10, color: 'var(--gray-600)', fontVariantNumeric: 'tabular-nums' }}>{mmclp(total)}</span>
                  </div>
                )
              }
              return (<>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={epMes.rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
                    onClick={(data) => {
                      const label = data?.activeLabel as string | undefined
                      setActiveBar(label && label !== activeBar ? label : null)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                    <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: 'var(--gray-400)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `$${(v/1e9).toFixed(1)}M CLP`} tick={{ fontSize: 10, fill: 'var(--gray-400)' }} width={64} axisLine={false} tickLine={false} tickCount={5} />
                    <Tooltip content={renderTooltip} />
                    {epMes.alcances.map((alcance, i) => (
                      <Bar key={alcance} dataKey={alcance} stackId="ep"
                        fill={ALCANCE_COLORS[i % ALCANCE_COLORS.length]}
                        radius={i === epMes.alcances.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {activeBar && (() => {
                  const row = epMes.rows.find(r => r.periodo === activeBar)
                  if (!row) return null
                  const total = row.monto ?? 0
                  const items = epMes.alcances
                    .map((a, i) => ({ name: a, value: row[a] ?? 0, color: ALCANCE_COLORS[i % ALCANCE_COLORS.length] }))
                    .filter(x => x.value > 0)
                    .sort((a, b) => b.value - a.value)
                  return (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>
                        {activeBar} — desglose por tipo
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {items.map(item => (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                            <span style={{ flex: 1, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gray-500)' }}>{total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : ''}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gray-400)' }}>{mmclp(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </>)
            })()}
          </section>

          <section className="panel">
            <h2>EP por Tipo de Contrato (MM CLP)</h2>
            {(() => {
              const total     = epTipo.reduce((s, d) => s + d.monto, 0)
              const PIE_COLORS = ['var(--navy-500)', 'var(--gold-500)', '#64748b', '#0ea5e9', '#8b5cf6', '#10b981', '#f97316', '#ec4899']
              return (<>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={epTipo}
                      dataKey="monto"
                      nameKey="tipo"
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={88}
                      onClick={(_, i) => setActivePie(activePie === i ? null : i)}
                      style={{ cursor: 'pointer' }}
                    >
                      {epTipo.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}
                          opacity={activePie === null || activePie === -1 || activePie === i ? 1 : 0.35} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [`${mmclp(v)} · ${((v / total) * 100).toFixed(1)}%`, name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11 }}
                    onClick={() => setActivePie(activePie === -1 ? null : -1)}>
                    {activePie === -1 ? '▲ Cerrar desglose' : '▼ Ver desglose'}
                  </button>
                </div>
                {activePie !== null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--gray-100)' }}>
                    {epTipo.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                        opacity: activePie === -1 || activePie === i ? 1 : 0.4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.tipo}</span>
                        <span style={{ color: 'var(--gray-500)', fontVariantNumeric: 'tabular-nums' }}>{((d.monto / total) * 100).toFixed(1)}%</span>
                        <span style={{ color: 'var(--gray-400)', fontVariantNumeric: 'tabular-nums' }}>{mmclp(d.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>)
            })()}
          </section>
        </div>

        {/* Estado de saldo + módulos */}
        <div className="two-col" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <section className="panel">
            <h2>Resumen por Estado de Saldo</h2>
            {kpis && <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)', marginBottom: 5 }}>
                  <span>Ejecución presupuestaria</span>
                  <strong style={{ color: 'var(--gray-800)' }}>{pct.toFixed(1)}%</strong>
                </div>
                <div style={{ background: 'var(--gray-100)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, transition: 'width .5s',
                    width: `${Math.min(100, pct)}%`,
                    background: pct > 90 ? 'var(--error-500)' : pct > 75 ? 'var(--warning-500)' : 'var(--navy-400)',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-400)', marginTop: 4 }}>
                  <span>EP: {mmclp(kpis.ep_consumido_clp)}</span>
                  <span>Presupuesto: {mmclp(kpis.presupuesto_total_clp)}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                {ESTADO_SALDO.map(({ key, label, color, bg, panel, estados }) => {
                  const active = detailPanel === panel
                  return (
                    <div key={key} onClick={() => openDetail(panel, estados)}
                      style={{ background: bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center',
                        border: `1px solid ${active ? color : 'rgba(0,0,0,.05)'}`,
                        cursor: 'pointer', outline: active ? `2px solid ${color}` : 'none',
                        outlineOffset: 1, transition: 'border-color .15s, outline .15s' }}>
                      <strong style={{ fontSize: 22, fontWeight: 800, color, display: 'block', lineHeight: 1 }}>{kpis[key] ?? 0}</strong>
                      <span style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 4, display: 'block', lineHeight: 1.3 }}>{label}</span>
                      <span style={{ fontSize: 9, color, display: 'block', marginTop: 2 }}>{active ? '▲ ocultar' : '▼ ver detalle'}</span>
                    </div>
                  )
                })}
              </div>

              {/* Panel de detalle inline — saldo_* */}
              {detailPanel?.startsWith('saldo_') && (
                <div ref={saldoDetailRef} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>
                      {`${PANEL_TITLES[detailPanel] ?? detailPanel} (${detailData.length})`}
                    </span>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => { setDetailPanel(null); setDetailData([]) }}>✕</button>
                  </div>
                  {loadingDetail
                    ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando contratos…</p>
                    : detailData.length === 0
                      ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin contratos en esta categoría.</p>
                      : (() => {
                          const { col, dir } = detailSort
                          const sorted = [...detailData].sort((a, b) => {
                            const av = a[col] ?? 0, bv = b[col] ?? 0
                            const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
                            return dir === 'asc' ? cmp : -cmp
                          })
                          const thSort = (c: string, label: string, align?: string) => {
                            const active = detailSort.col === c
                            return (
                              <th onClick={() => setDetailSort(s => ({ col: c, dir: s.col === c && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: align as any }}>
                                {label}{' '}
                                <span style={{ opacity: active ? 1 : 0.25, color: active ? 'var(--gold-500)' : undefined }}>
                                  {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
                                </span>
                              </th>
                            )
                          }
                          return (
                            <div style={{ overflowX: 'auto' }}>
                              <table className="data-table">
                                <thead><tr>
                                  {thSort('codigo_ctt',       'Contrato')}
                                  {thSort('Descripcion_ctt',  'Descripción')}
                                  {thSort('Area_contrato',    'Área')}
                                  {thSort('Estado_ctt',       'Estado')}
                                  {thSort('Presupuesto_CLP',  'Presupuesto',  'right')}
                                  {thSort('EP_Consumido_CLP', 'EP Consumido', 'right')}
                                  {thSort('Saldo_CLP',        'Saldo',        'right')}
                                  {thSort('Pct_Saldo',        '% Saldo')}
                                </tr></thead>
                                <tbody>
                                  {sorted.map((c, i) => (
                                    <tr key={i} style={{ background: c.Saldo_CLP < 0 ? '#fef2f2' : undefined }}>
                                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.codigo_ctt}</td>
                                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={c.Descripcion_ctt}>{c.Descripcion_ctt}</td>
                                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.Area_contrato || '—'}</td>
                                      <td><span className={`chip ${c.Estado_ctt === 'Vigente' ? 'ok' : 'warn'}`}>{c.Estado_ctt}</span></td>
                                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mmclp(c.Presupuesto_CLP)}</td>
                                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mmclp(c.EP_Consumido_CLP)}</td>
                                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                                        color: c.Saldo_CLP < 0 ? '#dc2626' : '#d97706' }}>{mmclp(c.Saldo_CLP)}</td>
                                      <td>
                                        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, marginBottom: 2 }}>
                                          <div style={{ height: 6, borderRadius: 99,
                                            width: `${Math.max(0, Math.min(100, c.Pct_Saldo * 100))}%`,
                                            background: c.Saldo_CLP < 0 ? '#dc2626' : '#f39c12' }} />
                                        </div>
                                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                          {(c.Pct_Saldo * 100).toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        })()
                  }
                </div>
              )}
            </>}
          </section>

          <section className="panel">
            <h2>Módulos</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SHORTCUTS.map(({ to, icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '10px 8px', borderRadius: 8,
                    border: '1px solid var(--gray-200)', textDecoration: 'none',
                    background: 'var(--gray-50)', transition: 'background 100ms, border-color 100ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--navy-50)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--navy-200)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--gray-50)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--gray-200)' }}
                >
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-600)', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Estado de Proyectos */}
        {estadoProyectos && (() => {
          const IMPACTO_COLOR: Record<string, string> = { Alto: '#dc2626', Medio: '#f59e0b', Bajo: '#10b981' }
          const TIPO_COLORS   = ['var(--navy-500)', 'var(--gold-500)', '#64748b', '#0ea5e9', '#8b5cf6', '#10b981']
          const totalInc      = estadoProyectos.total || 1

          const PROY_CARDS = [
            { key: 'activas',               label: 'Activas',                value: estadoProyectos.activas,                color: 'var(--error-500)',   bg: 'var(--error-50)',   filter: (r: any) => r.estado?.trim().toLowerCase() === 'activa' },
            { key: 'pendientes',            label: 'Pendientes',             value: estadoProyectos.pendientes,             color: 'var(--warning-500)', bg: 'var(--warning-50)', filter: (r: any) => r.estado?.trim().toLowerCase() === 'pendiente' },
            { key: 'alto_impacto',          label: 'Alto Impacto',           value: estadoProyectos.alto_impacto,           color: '#c0392b',            bg: '#fdf2f2',           filter: (r: any) => r.impacto?.trim().toLowerCase() === 'alto' },
            { key: 'compromisos_pendientes',label: 'Compromisos Pendientes', value: estadoProyectos.compromisos_pendientes, color: 'var(--navy-500)',    bg: 'var(--navy-50)',    filter: (r: any) => r.estado_compromiso?.trim().toLowerCase() === 'pendiente' },
          ]

          const _incFilter = (r: any, fn: (r: any) => boolean) => {
            if (!fn(r)) return false
            const allProyectos = [...new Set([...selProyectos, ...campanaProyectos])]
            if (allProyectos.length) {
              const rp = (r.proyecto ?? '').trim()
              if (!allProyectos.some(p => p.trim().toLowerCase() === rp.toLowerCase())) return false
            }
            if (selContratos.length) {
              const rc = (r.contrato ?? '').trim().toLowerCase()
              if (!selContratos.some(c => c.trim().toLowerCase() === rc)) return false
            }
            return true
          }

          const openProyDetail = async (key: string, filterFn: (r: any) => boolean) => {
            if (proyDetailPanel === key) { setProyDetailPanel(null); setProyDetailData([]); return }
            setProyDetailPanel(key)
            setProyDetailLoading(true)
            try {
              const { getIncidencias } = await import('../api/client')
              const rows = await getIncidencias()
              setProyDetailData((rows as any[]).filter(r => _incFilter(r, filterFn)))
            } finally {
              setProyDetailLoading(false)
              setTimeout(() => proyDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }
          }

          const openDonutDetail = async (key: string, label: string, filterFn: (r: any) => boolean) => {
            if (donutDetailKey === key) {
              setDonutDetailKey(null); setDonutDetailData([])
              setActiveImpactoPie(null); setActiveTipoPie(null)
              return
            }
            setDonutDetailKey(key); setDonutDetailLabel(label); setDonutDetailLoading(true)
            try {
              const { getIncidencias } = await import('../api/client')
              const rows = await getIncidencias()
              setDonutDetailData((rows as any[]).filter(r => _incFilter(r, filterFn)))
            } finally {
              setDonutDetailLoading(false)
              setTimeout(() => donutDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }
          }

          const handleImpacto = (i: number) => {
            const { impacto } = estadoProyectos.por_impacto[i]
            const key = `impacto_${impacto}`
            setActiveImpactoPie(donutDetailKey === key ? null : i)
            openDonutDetail(key, `Impacto: ${impacto}`, (r: any) => r.impacto?.trim() === impacto)
          }
          const handleTipo = (i: number) => {
            const { tipo } = estadoProyectos.por_tipo[i]
            const key = `tipo_${tipo}`
            setActiveTipoPie(donutDetailKey === key ? null : i)
            openDonutDetail(key, tipo, (r: any) => r.tipo?.trim() === tipo)
          }

          return (
            <section className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <h2 style={{ margin: 0 }}>Estado de Proyectos</h2>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{estadoProyectos.total} incidencias registradas</span>
              </div>

              {/* Fila superior: impacto + tipos donut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>

                {/* Distribución por impacto */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                    Distribución por impacto
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 6 }}>
                    {estadoProyectos.por_impacto.map(({ impacto, count }: any, i: number) => (
                      <div key={impacto}
                        onClick={() => handleImpacto(i)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer',
                          opacity: activeImpactoPie === null || activeImpactoPie === i ? 1 : 0.4, transition: 'opacity .15s' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: IMPACTO_COLOR[impacto] ?? 'var(--gray-400)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--gray-700)', fontWeight: activeImpactoPie === i ? 700 : 400 }}>{impacto}</span>
                        <span style={{ color: 'var(--gray-400)', fontVariantNumeric: 'tabular-nums' }}>({count})</span>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={estadoProyectos.por_impacto} dataKey="count" nameKey="impacto"
                        cx="50%" cy="50%" innerRadius={42} outerRadius={70}
                        onClick={(_: any, i: number) => handleImpacto(i)}
                        style={{ cursor: 'pointer' }}>
                        {estadoProyectos.por_impacto.map(({ impacto }: any, i: number) => (
                          <Cell key={i} fill={IMPACTO_COLOR[impacto] ?? 'var(--gray-400)'}
                            opacity={activeImpactoPie === null || activeImpactoPie === i ? 1 : 0.35} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} (${((v / totalInc) * 100).toFixed(1)}%)`, name]}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Tipos — donut */}
                <div>
                  {(() => {
                    const tipoTotal = estadoProyectos.por_tipo.reduce((s: number, t: any) => s + t.count, 0) || 1
                    return (<>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        Principales tipos de incidencia
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 6 }}>
                        {estadoProyectos.por_tipo.map(({ tipo, count }: any, i: number) => (
                          <div key={tipo}
                            onClick={() => handleTipo(i)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer',
                              opacity: activeTipoPie === null || activeTipoPie === i ? 1 : 0.4, transition: 'opacity .15s' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: TIPO_COLORS[i % TIPO_COLORS.length], flexShrink: 0 }} />
                            <span style={{ color: 'var(--gray-700)', fontWeight: activeTipoPie === i ? 700 : 400,
                              maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tipo}</span>
                            <span style={{ color: 'var(--gray-400)', fontVariantNumeric: 'tabular-nums' }}>({count})</span>
                          </div>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={estadoProyectos.por_tipo} dataKey="count" nameKey="tipo"
                            cx="50%" cy="50%" innerRadius={42} outerRadius={70}
                            onClick={(_: any, i: number) => handleTipo(i)}
                            style={{ cursor: 'pointer' }}>
                            {estadoProyectos.por_tipo.map((_: any, i: number) => (
                              <Cell key={i} fill={TIPO_COLORS[i % TIPO_COLORS.length]}
                                opacity={activeTipoPie === null || activeTipoPie === i ? 1 : 0.35} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number, name: string) => [`${v} (${((v / tipoTotal) * 100).toFixed(1)}%)`, name]}
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </>)
                  })()}
                </div>
              </div>

              {/* Panel detalle de donuts */}
              {donutDetailKey && (
                <div ref={donutDetailRef} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>
                      {donutDetailLabel} ({donutDetailData.length})
                    </span>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => { setDonutDetailKey(null); setDonutDetailData([]); setActiveImpactoPie(null); setActiveTipoPie(null) }}>✕</button>
                  </div>
                  {donutDetailLoading
                    ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando…</p>
                    : donutDetailData.length === 0
                      ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin incidencias en esta categoría.</p>
                      : (() => {
                          const { col, dir } = donutDetailSort
                          const sorted = [...donutDetailData].sort((a, b) => {
                            const av = a[col] ?? '', bv = b[col] ?? ''
                            const cmp = col === 'impacto'
                              ? (IMPACTO_ORDER[String(av)] ?? 99) - (IMPACTO_ORDER[String(bv)] ?? 99)
                              : typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
                            return dir === 'asc' ? cmp : -cmp
                          })
                          const th = (c: string, label: string) => {
                            const active = donutDetailSort.col === c
                            return (
                              <th onClick={() => setDonutDetailSort(s => ({ col: c, dir: s.col === c && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                {label}{' '}
                                <span style={{ opacity: active ? 1 : 0.25, color: active ? 'var(--gold-500)' : undefined }}>
                                  {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
                                </span>
                              </th>
                            )
                          }
                          return (
                            <div style={{ overflowX: 'auto' }}>
                              <table className="data-table">
                                <thead><tr>
                                  {th('fecha',      'Fecha')}
                                  {th('proyecto',   'Proyecto')}
                                  {th('contrato',   'Contrato')}
                                  {th('tipo',       'Tipo')}
                                  {th('impacto',    'Impacto')}
                                  {th('descripcion','Descripción')}
                                  {th('estado',     'Estado')}
                                  {th('compromiso', 'Compromiso')}
                                </tr></thead>
                                <tbody>
                                  {sorted.map((r, i) => (
                                    <tr key={i} style={{ background: r.impacto === 'Alto' ? '#fef2f2' : r.impacto === 'Medio' ? '#fffbeb' : undefined }}>
                                      <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.proyecto}>{r.proyecto || '—'}</td>
                                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.contrato || '—'}</td>
                                      <td style={{ fontSize: 11 }}>{r.tipo || '—'}</td>
                                      <td>
                                        <span style={{ fontSize: 11, fontWeight: 700,
                                          color: r.impacto === 'Alto' ? '#dc2626' : r.impacto === 'Medio' ? '#f59e0b' : '#10b981' }}>
                                          {r.impacto || '—'}
                                        </span>
                                      </td>
                                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
                                      <td><span className={`chip ${r.estado?.toLowerCase() === 'activa' ? 'danger' : r.estado?.toLowerCase() === 'pendiente' ? 'warn' : 'ok'}`}>{r.estado || '—'}</span></td>
                                      <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.compromiso}>{r.compromiso || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        })()
                  }
                </div>
              )}

              {/* Tarjetas KPI clickeables */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {PROY_CARDS.map(({ key, label, value, color, bg, filter }) => {
                  const active = proyDetailPanel === key
                  return (
                    <div key={key} onClick={() => openProyDetail(key, filter)}
                      style={{ background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                        border: `1px solid ${active ? color : 'rgba(0,0,0,.05)'}`,
                        cursor: 'pointer', outline: active ? `2px solid ${color}` : 'none',
                        outlineOffset: 1, transition: 'border-color .15s' }}>
                      <strong style={{ fontSize: 24, fontWeight: 800, color, display: 'block', lineHeight: 1 }}>{value}</strong>
                      <span style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>{label}</span>
                      <span style={{ fontSize: 9, color, display: 'block', marginTop: 2 }}>{active ? '▲ ocultar' : '▼ ver detalle'}</span>
                    </div>
                  )
                })}
              </div>

              {/* Panel de detalle inline */}
              {proyDetailPanel && (
                <div ref={proyDetailRef} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>
                      {PROY_CARDS.find(c => c.key === proyDetailPanel)?.label} ({proyDetailData.length})
                    </span>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => { setProyDetailPanel(null); setProyDetailData([]) }}>✕</button>
                  </div>
                  {proyDetailLoading
                    ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando…</p>
                    : proyDetailData.length === 0
                      ? <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin incidencias en esta categoría.</p>
                      : (() => {
                          const { col, dir } = proyDetailSort
                          const sorted = [...proyDetailData].sort((a, b) => {
                            const av = a[col] ?? '', bv = b[col] ?? ''
                            const cmp = col === 'impacto'
                              ? (IMPACTO_ORDER[String(av)] ?? 99) - (IMPACTO_ORDER[String(bv)] ?? 99)
                              : typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
                            return dir === 'asc' ? cmp : -cmp
                          })
                          const th = (c: string, label: string) => {
                            const active = proyDetailSort.col === c
                            return (
                              <th onClick={() => setProyDetailSort(s => ({ col: c, dir: s.col === c && s.dir === 'asc' ? 'desc' : 'asc' }))}
                                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                {label}{' '}
                                <span style={{ opacity: active ? 1 : 0.25, color: active ? 'var(--gold-500)' : undefined }}>
                                  {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
                                </span>
                              </th>
                            )
                          }
                          return (
                            <div style={{ overflowX: 'auto' }}>
                              <table className="data-table">
                                <thead><tr>
                                  {th('fecha',      'Fecha')}
                                  {th('proyecto',   'Proyecto')}
                                  {th('contrato',   'Contrato')}
                                  {th('tipo',       'Tipo')}
                                  {th('impacto',    'Impacto')}
                                  {th('descripcion','Descripción')}
                                  {th('estado',     'Estado')}
                                  {th('compromiso', 'Compromiso')}
                                </tr></thead>
                                <tbody>
                                  {sorted.map((r, i) => (
                                    <tr key={i} style={{ background: r.impacto === 'Alto' ? '#fef2f2' : r.impacto === 'Medio' ? '#fffbeb' : undefined }}>
                                      <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.fecha}</td>
                                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.proyecto}>{r.proyecto || '—'}</td>
                                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.contrato || '—'}</td>
                                      <td style={{ fontSize: 11 }}>{r.tipo || '—'}</td>
                                      <td>
                                        <span style={{ fontSize: 11, fontWeight: 700,
                                          color: r.impacto === 'Alto' ? '#dc2626' : r.impacto === 'Medio' ? '#f59e0b' : '#10b981' }}>
                                          {r.impacto || '—'}
                                        </span>
                                      </td>
                                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
                                      <td><span className={`chip ${r.estado?.toLowerCase() === 'activa' ? 'danger' : r.estado?.toLowerCase() === 'pendiente' ? 'warn' : 'ok'}`}>{r.estado || '—'}</span></td>
                                      <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.compromiso}>{r.compromiso || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        })()
                  }
                </div>
              )}
            </section>
          )
        })()}

      </div>
    </>
  )
}
