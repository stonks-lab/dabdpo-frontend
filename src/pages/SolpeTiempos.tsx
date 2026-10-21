import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getSolpeTiempos, getLicitAdjudicacionKpis, getLicitGestionProveedores } from '../api/client'
import PageHeader from '../components/PageHeader'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Kpis {
  total: number
  completadas: number
  prom_total: number | null
  mediana_total: number | null
  prom_etapa1: number | null
  prom_etapa2: number | null
}

interface AdjKpis {
  total: number
  finalizados: number
  a_tiempo: number
  pct_a_tiempo: number
  desviacion_promedio: number | null
  criticos_pendientes: number
  activos: number
  meta_pct: number
}

interface GestionKpis {
  base_oferentes: number
  meta_oferentes: number
  desvio_costos_pct: number
  meta_desvio_pct: number
  modificaciones_fuera_cc: number
  meta_fuera_cc: number
  estado_seccion: 'ok' | 'proximo' | 'critico'
}

interface MesRow {
  mes: string
  cantidad: number
  prom_etapa1: number | null
  prom_etapa2: number | null
  prom_total: number | null
}

interface EstadoRow {
  estado: string
  cantidad: number
  prom_etapa1: number | null
  prom_etapa2: number | null
  prom_total: number | null
}

interface TablaRow {
  Código?: string
  Nombre?: string
  Contrato?: string
  Proyecto?: string
  Grupo_Estado?: string
  fecha_hes?: string
  fecha_factura?: string
  fecha_pago?: string
  dias_etapa1?: number | null
  dias_etapa2?: number | null
  dias_total?: number | null
}

// ── Colores ───────────────────────────────────────────────────────────────────

const NAVY  = 'var(--color-navy)'
const GOLD  = 'var(--color-gold)'
const TEAL  = '#2a9d8f'

const ESTADO_CHIP: Record<string, string> = {
  'Pagado':     'chip-green',
  'Por pagar':  'chip-yellow',
  'Facturando': 'chip-blue',
  'Pendiente':  'chip-gray',
}

const SECCION_LABEL: Record<string, { label: string; bg: string; color: string; border: string }> = {
  ok:      { label: 'Dentro de metas',      bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  proximo: { label: 'Próximo a lo esperado', bg: '#fef9c3', color: '#a16207', border: '#fde047' },
  critico: { label: 'Fuera de metas',        bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
}

function toYM(s: string): number {
  if (!s) return 0
  const parts = s.split('-')
  return parseInt(parts[0]) * 100 + parseInt(parts[1])
}

function fmtMonth(s: string): string {
  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const [y, m] = s.split('-')
  return `${meses[parseInt(m)] ?? m} ${y}`
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="panel" style={{ flex: '1 1 160px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function NumCard({ title, value, unit, sub, color = NAVY }: {
  title: string; value: number | null; unit?: string; sub?: string; color?: string
}) {
  return (
    <div className="panel">
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color, lineHeight: 1 }}>
        {value ?? '—'}
        {value != null && unit && (
          <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 4, color: 'var(--color-text-muted)' }}>{unit}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function ComplianceCard({ adj }: { adj: AdjKpis }) {
  const pct  = adj.pct_a_tiempo
  const meta = adj.meta_pct
  const fill = pct >= meta ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626'

  return (
    <div className="panel" style={{ gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Cumplimiento Adjudicación
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>% servicios adjudicados a tiempo · Meta {meta}%</span>
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color: fill, lineHeight: 1, marginBottom: 12 }}>
        {pct}<span style={{ fontSize: 20, fontWeight: 600, marginLeft: 2 }}>%</span>
      </div>
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{ position: 'absolute', left: `${meta}%`, bottom: 20, transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          ▼ Meta {meta}%
        </div>
        <div style={{ position: 'relative', height: 10, background: '#f1f5f9', borderRadius: 5 }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: fill, borderRadius: 5, transition: 'width .5s ease' }} />
          <div style={{ position: 'absolute', left: `${meta}%`, top: -3, bottom: -3, width: 2, background: '#dc2626', borderRadius: 1 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {[0, 25, 50, 75, 100].map(v => (
            <span key={v} style={{ fontSize: 9, color: '#9ca3af' }}>{v}%</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{adj.a_tiempo} / {adj.finalizados}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>adjudicados a tiempo</span>
      </div>
    </div>
  )
}

function GestionCard({ title, value, meta, met }: {
  title: string; value: string | number; meta: string; met: boolean
}) {
  const valueColor = met ? '#16a34a' : '#dc2626'
  return (
    <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: valueColor, lineHeight: 1, marginBottom: 10 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14, color: valueColor, lineHeight: 1 }}>{met ? '✓' : '✗'}</span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>Meta {meta}</span>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SolpeTiempos() {
  const [data,    setData]    = useState<{ kpis: Kpis; por_mes: MesRow[]; por_estado: EstadoRow[]; tabla: TablaRow[] } | null>(null)
  const [adj,     setAdj]     = useState<AdjKpis | null>(null)
  const [gestion, setGestion] = useState<GestionKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')
  const [search,       setSearch]       = useState('')
  const [filterEstado, setFilterEstado] = useState('')

  // Carga inicial: datos EP (filtrado client-side, no necesita re-fetch)
  useEffect(() => {
    getSolpeTiempos()
      .then(ep => setData(ep))
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [])

  // Re-fetch adj y gestion cuando cambia el filtro de fecha
  useEffect(() => {
    const params = {
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    }
    setAdj(null)
    setGestion(null)
    Promise.all([
      getLicitAdjudicacionKpis(params),
      getLicitGestionProveedores(params),
    ]).then(([adjData, gestData]) => {
      setAdj(adjData)
      setGestion(gestData)
    }).catch(() => {})
  }, [fechaDesde, fechaHasta])

  // ── Rango de fechas ──────────────────────────────────────────────────────────
  const tablaRango = useMemo(() => {
    if (!data) return []
    const desde = toYM(fechaDesde)
    const hasta = toYM(fechaHasta)
    if (!desde && !hasta) return data.tabla
    return data.tabla.filter(r => {
      if (!r.fecha_hes) return false   // sin HES no pertenece a ningún periodo
      const ym = toYM(r.fecha_hes.substring(0, 7))
      if (desde && ym < desde) return false
      if (hasta && ym > hasta) return false
      return true
    })
  }, [data, fechaDesde, fechaHasta])

  const estados = useMemo(() => {
    return [...new Set(tablaRango.map(r => r.Grupo_Estado ?? '').filter(Boolean))].sort()
  }, [tablaRango])

  const tablaFiltrada = useMemo(() => {
    return tablaRango.filter(r => {
      const matchSearch = !search ||
        (r.Código   ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.Nombre   ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.Contrato ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (r.Proyecto ?? '').toLowerCase().includes(search.toLowerCase())
      const matchEstado = !filterEstado || r.Grupo_Estado === filterEstado
      return matchSearch && matchEstado
    })
  }, [tablaRango, search, filterEstado])

  // ── KPIs derivados del rango ─────────────────────────────────────────────────
  const kpisFiltrados = useMemo((): Kpis => {
    const e1  = tablaRango.map(r => r.dias_etapa1).filter((v): v is number => v != null)
    const e2  = tablaRango.map(r => r.dias_etapa2).filter((v): v is number => v != null)
    const tot = tablaRango.map(r => r.dias_total ).filter((v): v is number => v != null)
    const mean = (a: number[]) =>
      a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null
    const median = (a: number[]) => {
      if (!a.length) return null
      const s = [...a].sort((x, y) => x - y)
      const mid = Math.floor(s.length / 2)
      return Math.round((s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) * 10) / 10
    }
    return {
      total:         tablaRango.length,
      completadas:   tot.length,
      prom_total:    mean(tot),
      mediana_total: median(tot),
      prom_etapa1:   mean(e1),
      prom_etapa2:   mean(e2),
    }
  }, [tablaRango])

  // ── Por estado derivado del rango ────────────────────────────────────────────
  const porEstadoFiltrado = useMemo(() => {
    const map = new Map<string, { e1: number[]; e2: number[]; tot: number[] }>()
    for (const r of tablaRango) {
      const est = r.Grupo_Estado ?? 'Pendiente'
      if (!map.has(est)) map.set(est, { e1: [], e2: [], tot: [] })
      const g = map.get(est)!
      if (r.dias_etapa1 != null) g.e1.push(r.dias_etapa1)
      if (r.dias_etapa2 != null) g.e2.push(r.dias_etapa2)
      if (r.dias_total  != null) g.tot.push(r.dias_total)
    }
    const mean = (a: number[]) =>
      a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null
    return Array.from(map.entries()).map(([estado, g]) => ({
      estado,
      'HES → Factura':  mean(g.e1),
      'Factura → Pago': mean(g.e2),
      'Total':          mean(g.tot),
    }))
  }, [tablaRango])

  // ── Por mes filtrado por rango ────────────────────────────────────────────────
  const porMesFiltrado = useMemo(() => {
    if (!data) return []
    const desde = toYM(fechaDesde)
    const hasta = toYM(fechaHasta)
    if (!desde && !hasta) return data.por_mes
    return data.por_mes.filter(r => {
      const ym = toYM(r.mes)
      if (desde && ym < desde) return false
      if (hasta && ym > hasta) return false
      return true
    })
  }, [data, fechaDesde, fechaHasta])

  if (loading) return <><PageHeader title="Dashboard DAB" /><div className="page"><p>Cargando...</p></div></>
  if (error)   return <><PageHeader title="Dashboard DAB" /><div className="page"><p style={{ color: 'red' }}>{error}</p></div></>
  if (!data)   return null

  const porMesChart    = porMesFiltrado.map(r => ({
    mes:              fmtMonth(r.mes),
    'HES → Factura':  r.prom_etapa1,
    'Factura → Pago': r.prom_etapa2,
    'Total':          r.prom_total,
  }))

  const porEstadoChart = porEstadoFiltrado

  const filtroActivo = !!(fechaDesde || fechaHasta)
  const subtitleFiltro = filtroActivo
    ? `${fechaDesde ? fmtMonth(fechaDesde) : '…'} → ${fechaHasta ? fmtMonth(fechaHasta) : '…'} · ${tablaRango.length} EPs`
    : `${data.tabla.length} EPs en total`

  const hasContrato = data.tabla.some(r => r.Contrato)
  const hasProyecto = data.tabla.some(r => r.Proyecto)
  const colSpan     = 5 + (hasContrato ? 1 : 0) + (hasProyecto ? 1 : 0) + 3

  return (
    <>
      <PageHeader title="Dashboard DAB" subtitle={subtitleFiltro} />
      <div className="page">

        {/* ── Filtro de página ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>
            Periodo
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="month"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              style={{ fontSize: 13, padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: 4, background: 'white' }}
            />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>→</span>
            <input
              type="month"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={e => setFechaHasta(e.target.value)}
              style={{ fontSize: 13, padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: 4, background: 'white' }}
            />
          </div>
          {filtroActivo && (
            <button
              onClick={() => { setFechaDesde(''); setFechaHasta('') }}
              style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              limpiar
            </button>
          )}
          {filtroActivo && (
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
              Mostrando {tablaRango.length} de {data.tabla.length} EPs
            </span>
          )}
        </div>

        {/* ── 1. Cumplimiento adjudicación ──────────────────────────────────── */}
        {adj && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 4 }}>
            <ComplianceCard adj={adj} />
            <NumCard
              title="Desviación promedio"
              value={adj.desviacion_promedio}
              unit="d"
              sub="Días vs. plan · procesos finalizados"
              color={adj.desviacion_promedio != null && adj.desviacion_promedio > 0 ? '#dc2626' : '#16a34a'}
            />
            <NumCard
              title="Críticos pendientes"
              value={adj.criticos_pendientes}
              sub={`Licitaciones activas: ${adj.activos}`}
              color={adj.criticos_pendientes > 0 ? '#dc2626' : '#16a34a'}
            />
          </div>
        )}

        {/* ── 2. Gestión de Proveedores y control de costos ─────────────────── */}
        {gestion && (() => {
          const sec  = SECCION_LABEL[gestion.estado_seccion]
          const sign = gestion.desvio_costos_pct > 0 ? '+' : ''
          return (
            <div className="panel" style={{ marginBottom: 4 }}>
              {/* Encabezado de sección */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                  Gestión de Proveedores y control de costos operativos
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: sec.bg, color: sec.color, border: `1px solid ${sec.border}`, whiteSpace: 'nowrap' }}>
                  {sec.label}
                </span>
              </div>

              {/* Tarjetas métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <GestionCard
                  title="Base oferentes críticos"
                  value={gestion.base_oferentes}
                  meta={`≥ ${gestion.meta_oferentes}`}
                  met={gestion.base_oferentes >= gestion.meta_oferentes}
                />
                <GestionCard
                  title="Desvío costos contratos"
                  value={`${sign}${gestion.desvio_costos_pct}%`}
                  meta={`≤ ${gestion.meta_desvio_pct}%`}
                  met={gestion.desvio_costos_pct <= gestion.meta_desvio_pct}
                />
                <GestionCard
                  title="Modificaciones fuera de CC"
                  value={gestion.modificaciones_fuera_cc}
                  meta={`= ${gestion.meta_fuera_cc}`}
                  met={gestion.modificaciones_fuera_cc <= gestion.meta_fuera_cc}
                />
              </div>

              {/* Nota al pie */}
              <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                CC: Control de Cambios &nbsp;·&nbsp; Datos a cierre del periodo de medición.
              </div>
            </div>
          )
        })()}

        {/* ── 3. KPIs ciclo EP ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard label="Total EPs"            value={kpisFiltrados.total} />
          <KpiCard label="Con fecha de pago"    value={kpisFiltrados.completadas} sub="ciclo completo" />
          <KpiCard label="Tiempo promedio"       value={kpisFiltrados.prom_total    != null ? `${kpisFiltrados.prom_total} d`    : null} sub="HES → pago" />
          <KpiCard label="Mediana"               value={kpisFiltrados.mediana_total != null ? `${kpisFiltrados.mediana_total} d` : null} sub="tiempo total" />
          <KpiCard label="Prom. HES → Factura"  value={kpisFiltrados.prom_etapa1   != null ? `${kpisFiltrados.prom_etapa1} d`   : null} sub="días en etapa 1" />
          <KpiCard label="Prom. Factura → Pago" value={kpisFiltrados.prom_etapa2   != null ? `${kpisFiltrados.prom_etapa2} d`   : null} sub="días en etapa 2" />
        </div>

        {/* ── 4. Gráficas ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="panel">
            <div className="panel-title">Días promedio por estado</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porEstadoChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="estado" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} días`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="HES → Factura"  fill={NAVY} maxBarSize={32} />
                <Bar dataKey="Factura → Pago" fill={GOLD} maxBarSize={32} />
                <Bar dataKey="Total"          fill={TEAL} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <div className="panel-title">Desglose de etapas (días promedio)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { etapa: 'HES → Factura',  dias: kpisFiltrados.prom_etapa1 },
                  { etapa: 'Factura → Pago', dias: kpisFiltrados.prom_etapa2 },
                  { etapa: 'Total',          dias: kpisFiltrados.prom_total  },
                ]}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="etapa" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} días`} />
                <Bar dataKey="dias" maxBarSize={48} fill={NAVY}
                  label={{ position: 'top', fontSize: 11, formatter: (v: number) => v != null ? `${v}d` : '' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 5. Por mes ────────────────────────────────────────────────────── */}
        {porMesChart.length > 0 && (
          <div className="panel">
            <div className="panel-title">Días promedio por mes (HES Fecha)</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porMesChart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} días`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="HES → Factura"  fill={NAVY} maxBarSize={28} />
                <Bar dataKey="Factura → Pago" fill={GOLD} maxBarSize={28} />
                <Bar dataKey="Total"          fill={TEAL} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── 6. Tabla detalle EP ───────────────────────────────────────────── */}
        <div className="panel">
          <div className="panel-title">Detalle por EP</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              className="form-control"
              style={{ flex: 1, maxWidth: 320, fontSize: 13, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
              placeholder="Buscar código, proveedor, contrato o proyecto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4, background: 'white' }}
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {estados.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre / Proveedor</th>
                  {hasContrato && <th>Contrato</th>}
                  {hasProyecto && <th>Proyecto</th>}
                  <th>Estado</th>
                  <th>HES Fecha</th>
                  <th>Factura Fecha</th>
                  <th>F. de Pago</th>
                  <th style={{ textAlign: 'right' }}>HES→Fac (d)</th>
                  <th style={{ textAlign: 'right' }}>Fac→Pago (d)</th>
                  <th style={{ textAlign: 'right' }}>Total (d)</th>
                </tr>
              </thead>
              <tbody>
                {tablaFiltrada.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.Código ?? '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Nombre}>{r.Nombre ?? '—'}</td>
                    {hasContrato && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.Contrato ?? '—'}</td>}
                    {hasProyecto && <td>{r.Proyecto ?? '—'}</td>}
                    <td>
                      <span className={`chip ${ESTADO_CHIP[r.Grupo_Estado ?? ''] ?? 'chip-gray'}`}>
                        {r.Grupo_Estado ?? '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.fecha_hes     || '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.fecha_factura || '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.fecha_pago    || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dias_etapa1 ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.dias_etapa2 ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.dias_total ?? '—'}</td>
                  </tr>
                ))}
                {tablaFiltrada.length === 0 && (
                  <tr><td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            {tablaFiltrada.length} de {data.tabla.length} registros
          </div>
        </div>

      </div>
    </>
  )
}
