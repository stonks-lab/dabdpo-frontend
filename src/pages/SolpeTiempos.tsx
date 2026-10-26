import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getSolpeTiempos, getLicitAdjudicacionKpis, getLicitGestionProveedores, getLicitAdjudicacionDetalle, getLicitGestionDetalle } from '../api/client'
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
  riesgo_pendientes: number
  activos_a_tiempo: number
  activos: number
  meta_pct: number
  tipos_disponibles?: string[]
}

interface GestionKpis {
  base_oferentes: number
  meta_oferentes: number
  desvio_costos_pct: number
  meta_desvio_pct: number
  modificaciones_fuera_cc: number
  meta_fuera_cc: number
  estado_seccion: 'ok' | 'proximo' | 'critico'
  criticos_only?: boolean
  tipos_disponibles?: string[]
}

interface AdjDetalleRow {
  'N°PROCESO'?: string
  Proceso?: string
  'Tipo Proceso'?: string
  'Tipo Servicio'?: string
  'Fecha fin programado'?: string
  'Fecha fin real'?: string
  delta_dias?: number | null
  fin_estimado?: string | null
  brecha_dias?: number | null
  Responsable?: string
}
interface AdjDetalle {
  criticos:        AdjDetalleRow[]
  riesgo:          AdjDetalleRow[]
  activos_a_tiempo: AdjDetalleRow[]
  a_tiempo:        AdjDetalleRow[]
  tarde:           AdjDetalleRow[]
}

interface GestionDetalleItem {
  nombre?: string
  codigo_contrato?: string
  proyecto?: string
  saldo_vigente?: number | null
  monto_actualizado?: number | null
  impacto_monto_clp?: number | null
  estado?: string
  fecha_aprobacion?: string
  fecha_firma_pyc?: string
  razon?: string
  tipo_modificacion?: string
}
interface ContratosRow {
  codigo_ctt?: string
  Descripcion_ctt?: string
  Tipo_contrato?: string
  es_critico?: string
  Proveedor?: string
  fecha_inicio?: string
}
interface GestionDetalle {
  contratos: ContratosRow[]
  modificaciones_desvio:   GestionDetalleItem[]
  modificaciones_fuera_cc: GestionDetalleItem[]
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

const NAVY  = 'var(--navy-500)'
const GOLD  = 'var(--gold-500)'
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

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toDays(v: unknown): number | null {
  const n = toNum(v)
  return n != null && n >= 0 && n <= 1000 ? n : null
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

// ── InfoTooltip ───────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          width: 15, height: 15, borderRadius: '50%', border: '1px solid #94a3b8',
          background: show ? '#e2e8f0' : 'white', color: '#64748b', fontSize: 9,
          cursor: 'default', lineHeight: 1, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
        }}
      >?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
          background: '#1e293b', color: 'white', borderRadius: 6, padding: '8px 10px',
          fontSize: 11, lineHeight: 1.5, zIndex: 200, width: 240, whiteSpace: 'normal',
          boxShadow: '0 4px 12px rgba(0,0,0,.25)', pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', right: 4,
            width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid #1e293b',
          }} />
        </div>
      )}
    </span>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function KpiCard({ label, value, sub, info }: {
  label: string; value: string | number | null; sub?: string; info?: string
}) {
  return (
    <div className="panel" style={{ flex: '1 1 160px', minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
          {label}
        </span>
        {info && <InfoTooltip text={info} />}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function NumCard({ title, value, unit, sub, color = NAVY, info, onClick, active, extra }: {
  title: string; value: number | null; unit?: string; sub?: string; color?: string; info?: string; onClick?: () => void; active?: boolean; extra?: React.ReactNode
}) {
  return (
    <div
      className="panel"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, outline: active ? `2px solid ${GOLD}` : undefined, outlineOffset: 2 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', flex: 1 }}>
          {title}
        </span>
        {info && <InfoTooltip text={info} />}
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color, lineHeight: 1 }}>
        {value ?? '—'}
        {value != null && unit && (
          <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 4, color: 'var(--color-text-muted)' }}>{unit}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>{sub}</div>}
      {extra}
    </div>
  )
}

function ComplianceCard({ adj, onClick, active }: { adj: AdjKpis; onClick?: () => void; active?: boolean }) {
  const pct  = adj.pct_a_tiempo
  const meta = adj.meta_pct
  const fill = pct >= meta ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626'

  return (
    <div
      className="panel"
      onClick={onClick}
      style={{ gridColumn: 'span 2', cursor: onClick ? 'pointer' : undefined, outline: active ? `2px solid ${GOLD}` : undefined, outlineOffset: 2 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Cumplimiento Adjudicación
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>% servicios adjudicados a tiempo · Meta {meta}%</span>
        <InfoTooltip text="Porcentaje de procesos licitatorios finalizados que se adjudicaron dentro del plazo planificado. Fuente: board Monday PROCESOS LICITACIÓN, campo Fecha fin planificada vs. Fecha fin real." />
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color: fill, lineHeight: 1, marginBottom: 12 }}>
        {pct}<span style={{ fontSize: 20, fontWeight: 600, marginLeft: 2 }}>%</span>
      </div>
      <div style={{ position: 'relative', marginBottom: 20, paddingTop: 18 }}>
        <div style={{ position: 'absolute', left: `${meta}%`, top: 0, transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
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

function GestionCard({ title, value, meta, met, info, onClick, active, extra }: {
  title: string; value: string | number; meta: string; met: boolean; info?: string; onClick?: () => void; active?: boolean; extra?: React.ReactNode
}) {
  const valueColor = met ? '#16a34a' : '#dc2626'
  return (
    <div
      onClick={onClick}
      style={{ background: '#fafafa', border: `1px solid ${active ? GOLD : '#f0f0f0'}`, borderRadius: 8, padding: '14px 16px', cursor: onClick ? 'pointer' : undefined }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', flex: 1 }}>
          {title}
        </span>
        {info && <InfoTooltip text={info} />}
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: valueColor, lineHeight: 1, marginBottom: 10 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 14, color: valueColor, lineHeight: 1 }}>{met ? '✓' : '✗'}</span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>Meta {meta}</span>
      </div>
      {extra}
    </div>
  )
}

// ── Paneles de detalle ────────────────────────────────────────────────────────

function AdjDetallePanel({ which, data, loading, error, onClose }: {
  which: 'cumplimiento' | 'desviacion' | 'criticos' | 'riesgo' | 'a_tiempo_activo'
  data: AdjDetalle | null
  loading: boolean
  error?: string | null
  onClose: () => void
}) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  useEffect(() => { setSortCol(null); setSortDir('asc') }, [which])

  function SortTh({ col, label, style }: { col: string; label: string; style?: React.CSSProperties }) {
    const active = sortCol === col
    return (
      <th
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
        onClick={() => sortCol === col ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortCol(col), setSortDir('asc'))}
      >
        {label}{' '}
        <span style={{ opacity: active ? 1 : 0.3, fontSize: 10 }}>{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </th>
    )
  }

  const titles = {
    cumplimiento:    'Procesos licitatorios finalizados en el período',
    desviacion:      'Detalle de desviación por proceso',
    criticos:        'Procesos activos — Atrasado estimado',
    riesgo:          'Procesos activos — Riesgo de atraso',
    a_tiempo_activo: 'Procesos activos — A tiempo',
  }

  const isActivo = which === 'criticos' || which === 'riesgo' || which === 'a_tiempo_activo'

  let rows: AdjDetalleRow[] = []
  if (data) {
    if (which === 'criticos')          rows = [...data.criticos]
    else if (which === 'riesgo')       rows = [...data.riesgo]
    else if (which === 'a_tiempo_activo') rows = [...data.activos_a_tiempo]
    else rows = [...data.a_tiempo, ...data.tarde]
  }

  if (sortCol) {
    rows.sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol]
      const vb = (b as Record<string, unknown>)[sortCol]
      if (va == null && vb == null) return 0
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  } else {
    if (which === 'desviacion') rows.sort((a, b) => (b.delta_dias ?? 0) - (a.delta_dias ?? 0))
    else if (which === 'cumplimiento') rows.sort((a, b) => {
      const la = (a.delta_dias ?? 0) > 0 ? 1 : 0
      const lb = (b.delta_dias ?? 0) > 0 ? 1 : 0
      return la !== lb ? la - lb : (a.delta_dias ?? 0) - (b.delta_dias ?? 0)
    })
  }

  const isCriticos = which === 'criticos'

  return (
    <div className="panel" style={{ borderLeft: `3px solid ${NAVY}`, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: NAVY, flex: 1 }}>{titles[which]}</span>
        {data && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: '#f1f5f9', padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>{rows.length} procesos</span>}
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8', lineHeight: 1 }}>✕</button>
      </div>
      {loading && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando...</p>}
      {!loading && error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}
      {!loading && !error && !data && <p style={{ fontSize: 13, color: '#dc2626' }}>No se pudo cargar. Reinicia el servidor backend.</p>}
      {!loading && data && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <SortTh col="N°PROCESO"           label="N° Proceso" />
                <SortTh col="Proceso"              label="Nombre proceso" />
                <SortTh col="Tipo Proceso"         label="Tipo" />
                <SortTh col="Tipo Servicio"        label="Tipo contrato" />
                <SortTh col="Fecha fin programado" label="Fin planificado" />
                <SortTh col={isActivo ? 'fin_estimado' : 'Fecha fin real'} label={isActivo ? 'Fin estimado' : 'Fin real'} />
                {isActivo  && <SortTh col="brecha_dias" label="Brecha (d)" style={{ textAlign: 'right' }} />}
                {!isActivo && <SortTh col="delta_dias"  label="Δ días"     style={{ textAlign: 'right' }} />}
                {isActivo  && <SortTh col="Responsable" label="Responsable" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>Sin datos</td></tr>
              )}
              {rows.map((r, i) => {
                const delta    = r.delta_dias
                const isLate   = delta != null && delta > 0
                const isOnTime = delta != null && delta <= 0
                return (
                  <tr key={i} style={!isActivo ? { background: isLate ? '#fff5f5' : isOnTime ? '#f0fdf4' : undefined } : {}}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{r['N°PROCESO'] ?? '—'}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={r.Proceso}>{r.Proceso ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{r['Tipo Proceso'] ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{r['Tipo Servicio'] ?? '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r['Fecha fin programado'] ?? '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{isActivo ? (r.fin_estimado ?? '—') : (r['Fecha fin real'] ?? '—')}</td>
                    {isActivo && (() => {
                      const b = r.brecha_dias
                      return (
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {b == null ? '—' : (
                            <span style={{ color: b > 0 ? '#dc2626' : b < 0 ? '#16a34a' : '#6b7280' }}>
                              {b > 0 ? '+' : ''}{b} d
                            </span>
                          )}
                        </td>
                      )
                    })()}
                    {!isActivo && (
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {delta == null ? '—' : (
                          <span style={{ color: isLate ? '#dc2626' : '#16a34a' }}>
                            {delta > 0 ? '+' : ''}{delta} d
                          </span>
                        )}
                      </td>
                    )}
                    {isActivo && <td style={{ fontSize: 12 }}>{r.Responsable ?? '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GestionDetallePanel({ which, data, loading, error, onClose }: {
  which: 'oferentes' | 'desvio' | 'fuera_cc'
  data: GestionDetalle | null
  loading: boolean
  error?: string | null
  onClose: () => void
}) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  useEffect(() => { setSortCol(null); setSortDir('asc') }, [which])

  function SortTh({ col, label, style }: { col: string; label: string; style?: React.CSSProperties }) {
    const active = sortCol === col
    return (
      <th
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
        onClick={() => sortCol === col ? setSortDir(d => d === 'asc' ? 'desc' : 'asc') : (setSortCol(col), setSortDir('asc'))}
      >
        {label}{' '}
        <span style={{ opacity: active ? 1 : 0.3, fontSize: 10 }}>{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </th>
    )
  }

  function sortRows<T extends Record<string, unknown>>(arr: T[]): T[] {
    if (!sortCol) return arr
    return [...arr].sort((a, b) => {
      const va = a[sortCol]; const vb = b[sortCol]
      if (va == null && vb == null) return 0
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const titles = {
    oferentes: 'Base de oferentes únicos',
    desvio:    'Modificaciones aprobadas con impacto en costo',
    fuera_cc:  'Modificaciones fuera de Control de Cambios',
  }

  const fmtClp = (v: number | null | undefined) =>
    v == null ? '—' : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

  // Group contratos by Proveedor for the oferentes view
  let porOferente: [string, ContratosRow[]][] = !data ? [] : (() => {
    const map = new Map<string, ContratosRow[]>()
    for (const c of data.contratos) {
      const key = c.Proveedor?.trim() || '(sin proveedor)'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return Array.from(map.entries())
  })()

  // Sort oferentes view
  if (sortCol && porOferente.length) {
    porOferente = [...porOferente].sort((a, b) => {
      let va: unknown, vb: unknown
      if (sortCol === 'empresa')       { va = a[0]; vb = b[0] }
      else if (sortCol === 'cantidad') { va = a[1].length; vb = b[1].length }
      else if (sortCol === 'tipos') {
        va = [...new Set(a[1].map(c => c.Tipo_contrato).filter(Boolean))].sort().join(', ')
        vb = [...new Set(b[1].map(c => c.Tipo_contrato).filter(Boolean))].sort().join(', ')
      } else if (sortCol === 'fecha_inicio') {
        va = a[1].map(c => c.fecha_inicio).filter(Boolean).sort()[0] ?? ''
        vb = b[1].map(c => c.fecha_inicio).filter(Boolean).sort()[0] ?? ''
      } else { va = a[0]; vb = b[0] }
      if (va == null && vb == null) return 0
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  } else if (!sortCol && porOferente.length) {
    porOferente = [...porOferente].sort((a, b) => a[0].localeCompare(b[0]))
  }

  const count = !data ? undefined
    : which === 'oferentes' ? porOferente.length
    : which === 'desvio'    ? data.modificaciones_desvio.length
    : data.modificaciones_fuera_cc.length

  return (
    <div className="panel" style={{ borderLeft: `3px solid ${NAVY}`, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: NAVY, flex: 1 }}>{titles[which]}</span>
        {count != null && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: '#f1f5f9', padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>{count} registros</span>}
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8', lineHeight: 1 }}>✕</button>
      </div>
      {loading && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cargando...</p>}
      {!loading && error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}
      {!loading && !error && !data && <p style={{ fontSize: 13, color: '#dc2626' }}>No se pudo cargar. Reinicia el servidor backend.</p>}
      {!loading && data && (
        <div style={{ overflowX: 'auto' }}>
          {which === 'oferentes' && (() => {
            const hasFechaInicio = porOferente.some(([, ctts]) => ctts.some(c => c.fecha_inicio))
            return (
              <table className="data-table">
                <thead>
                  <tr>
                    <SortTh col="empresa"  label="Empresa (Proveedor)" />
                    <SortTh col="cantidad" label="Contratos adj." style={{ textAlign: 'right' }} />
                    <th>Contratos</th>
                    <SortTh col="tipos" label="Tipos de contrato" />
                    {hasFechaInicio && <SortTh col="fecha_inicio" label="Fecha inicio" />}
                  </tr>
                </thead>
                <tbody>
                  {porOferente.length === 0 && (
                    <tr><td colSpan={hasFechaInicio ? 5 : 4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>Sin datos</td></tr>
                  )}
                  {porOferente.map(([empresa, contratos]) => {
                    const tipos = [...new Set(contratos.map(c => c.Tipo_contrato).filter(Boolean))].sort()
                    const fechaMin = contratos
                      .map(c => c.fecha_inicio).filter(Boolean).sort()[0] ?? ''
                    return (
                      <tr key={empresa}>
                        <td style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{empresa}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13, verticalAlign: 'top', color: NAVY }}>{contratos.length}</td>
                        <td style={{ fontSize: 11, verticalAlign: 'top' }}>
                          {contratos.map((c, i) => (
                            <div key={i} style={{ marginBottom: i < contratos.length - 1 ? 3 : 0 }}>
                              <span style={{ fontFamily: 'monospace', color: '#374151' }}>{c.codigo_ctt || '—'}</span>
                              <span style={{ color: '#9ca3af', margin: '0 4px' }}>/</span>
                              <span style={{ color: '#374151' }}>{c.Descripcion_ctt || '—'}</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ fontSize: 11, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{tipos.length ? tipos.join(', ') : '—'}</td>
                        {hasFechaInicio && <td style={{ fontSize: 11, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fechaMin || '—'}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          })()}
          {which === 'desvio' && (
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh col="nombre"            label="Modificación" />
                  <SortTh col="codigo_contrato"  label="Contrato" />
                  <SortTh col="proyecto"         label="Proyecto" />
                  <SortTh col="monto_actualizado" label="Monto actualizado" style={{ textAlign: 'right' }} />
                  <SortTh col="impacto_monto_clp" label="Aumento CLP"     style={{ textAlign: 'right' }} />
                  <SortTh col="estado"           label="Estado" />
                  <SortTh col="fecha_aprobacion" label="Fecha aprobación" />
                </tr>
              </thead>
              <tbody>
                {data.modificaciones_desvio.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>Sin datos</td></tr>}
                {sortRows(data.modificaciones_desvio as unknown as Record<string, unknown>[]).map((m, i) => {
                  const row = m as GestionDetalleItem
                  return (
                    <tr key={i}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={row.nombre}>{row.nombre ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.codigo_contrato ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{row.proyecto ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtClp(row.monto_actualizado)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: (row.impacto_monto_clp ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>{fmtClp(row.impacto_monto_clp)}</td>
                      <td style={{ fontSize: 12 }}>{row.estado ?? '—'}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.fecha_aprobacion || row.fecha_firma_pyc || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {which === 'fuera_cc' && (
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh col="nombre"           label="Modificación" />
                  <SortTh col="codigo_contrato"  label="Contrato" />
                  <SortTh col="proyecto"         label="Proyecto" />
                  <SortTh col="razon"            label="Razón" />
                  <SortTh col="descripcion"      label="Descripción" />
                  <SortTh col="tipo_modificacion" label="Tipo" />
                  <SortTh col="estado"           label="Estado" />
                  <SortTh col="fecha_firma_pyc"  label="Fecha firma" />
                </tr>
              </thead>
              <tbody>
                {data.modificaciones_fuera_cc.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>Sin datos</td></tr>}
                {sortRows(data.modificaciones_fuera_cc as unknown as Record<string, unknown>[]).map((m, i) => {
                  const row = m as GestionDetalleItem
                  return (
                    <tr key={i}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={row.nombre}>{row.nombre ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.codigo_contrato ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{row.proyecto ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{row.razon || '—'}</td>
                      <td style={{ fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descripcion}>{row.descripcion || '—'}</td>
                      <td style={{ fontSize: 12 }}>{row.tipo_modificacion ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>{row.estado ?? '—'}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.fecha_firma_pyc ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SolpeTiempos() {
  const [data,    setData]    = useState<{ kpis: Kpis; por_mes: unknown[]; por_estado: unknown[]; tabla: TablaRow[] } | null>(null)
  const [adj,     setAdj]     = useState<AdjKpis | null>(null)
  const [gestion, setGestion] = useState<GestionKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')
  const [search,       setSearch]       = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [sortCol, setSortCol] = useState<keyof TablaRow | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    new Set(['HES → Factura', 'Factura → Pago', 'Total'])
  )

  const [epOpen,                setEpOpen]                = useState(false)
  const [adjCriticsOnly,        setAdjCriticsOnly]        = useState(false)
  const [adjTipoProceso,        setAdjTipoProceso]        = useState('')
  const [criticsOnly,           setCriticsOnly]           = useState(true)
  const [tipoContrato,          setTipoContrato]          = useState('')
  const [activeAdj,             setActiveAdj]             = useState<'cumplimiento' | 'desviacion' | 'criticos' | 'riesgo' | 'a_tiempo_activo' | null>(null)
  const [activeGestion,         setActiveGestion]         = useState<'oferentes' | 'desvio' | 'fuera_cc' | null>(null)
  const [adjDetalle,            setAdjDetalle]            = useState<AdjDetalle | null>(null)
  const [adjDetalleLoading,     setAdjDetalleLoading]     = useState(false)
  const [adjDetalleError,       setAdjDetalleError]       = useState<string | null>(null)
  const [gestionDetalle,        setGestionDetalle]        = useState<GestionDetalle | null>(null)
  const [gestionDetalleLoading, setGestionDetalleLoading] = useState(false)
  const [gestionDetalleError,   setGestionDetalleError]   = useState<string | null>(null)

  const toggleLine = (key: string) =>
    setVisibleLines(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const toggleAdj = (k: 'cumplimiento' | 'desviacion' | 'criticos' | 'riesgo' | 'a_tiempo_activo') =>
    setActiveAdj(prev => prev === k ? null : k)
  const toggleGestion = (k: 'oferentes' | 'desvio' | 'fuera_cc') =>
    setActiveGestion(prev => prev === k ? null : k)

  // Carga inicial: datos EP (filtrado client-side, no necesita re-fetch)
  useEffect(() => {
    getSolpeTiempos()
      .then(ep => {
        // El backend usa fillna("") → los nulos numéricos llegan como "". Sanear antes de usar.
        const tabla = (ep.tabla as Record<string, unknown>[]).map(r => ({
          ...r,
          dias_etapa1: toDays(r.dias_etapa1),
          dias_etapa2: toDays(r.dias_etapa2),
          dias_total:  toDays(r.dias_total),
        }))
        setData({ ...ep, tabla })
      })
      .catch(e => setError(e?.response?.data?.detail ?? e.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [])

  // Re-fetch adj cuando cambia fecha o filtros de adj
  useEffect(() => {
    setAdj(null)
    getLicitAdjudicacionKpis({
      fecha_desde:   fechaDesde || undefined,
      fecha_hasta:   fechaHasta || undefined,
      criticos_only: adjCriticsOnly ? 1 : 0,
      tipo_proceso:  adjTipoProceso || undefined,
    }).then(setAdj).catch(() => {})
  }, [fechaDesde, fechaHasta, adjCriticsOnly, adjTipoProceso])

  // Re-fetch gestion cuando cambia fecha o filtros de gestion
  useEffect(() => {
    setGestion(null)
    getLicitGestionProveedores({
      fecha_desde:   fechaDesde || undefined,
      fecha_hasta:   fechaHasta || undefined,
      criticos_only: criticsOnly ? 1 : 0,
      tipo_contrato: tipoContrato || undefined,
    }).then(setGestion).catch(() => {})
  }, [fechaDesde, fechaHasta, criticsOnly, tipoContrato])

  // Detalle adjudicación: carga lazy al abrir un panel
  useEffect(() => {
    if (!activeAdj) return
    setAdjDetalleLoading(true)
    setAdjDetalle(null)
    setAdjDetalleError(null)
    getLicitAdjudicacionDetalle({
      fecha_desde:   fechaDesde || undefined,
      fecha_hasta:   fechaHasta || undefined,
      criticos_only: adjCriticsOnly ? 1 : 0,
      tipo_proceso:  adjTipoProceso || undefined,
    })
      .then(setAdjDetalle)
      .catch(e => setAdjDetalleError(e?.response?.data?.detail ?? e.message ?? 'Error al cargar'))
      .finally(() => setAdjDetalleLoading(false))
  }, [activeAdj, fechaDesde, fechaHasta, adjCriticsOnly, adjTipoProceso])

  // Detalle gestión: carga lazy al abrir un panel
  useEffect(() => {
    if (!activeGestion) return
    setGestionDetalleLoading(true)
    setGestionDetalle(null)
    setGestionDetalleError(null)
    getLicitGestionDetalle({
      fecha_desde:   fechaDesde || undefined,
      fecha_hasta:   fechaHasta || undefined,
      criticos_only: criticsOnly ? 1 : 0,
      tipo_contrato: tipoContrato || undefined,
    })
      .then(setGestionDetalle)
      .catch(e => setGestionDetalleError(e?.response?.data?.detail ?? e.message ?? 'Error al cargar'))
      .finally(() => setGestionDetalleLoading(false))
  }, [activeGestion, fechaDesde, fechaHasta, criticsOnly, tipoContrato])

  // ── Rango de fechas ──────────────────────────────────────────────────────────
  const tablaRango = useMemo(() => {
    if (!data) return []
    const desde = toYM(fechaDesde)
    const hasta = toYM(fechaHasta)
    if (!desde && !hasta) return data.tabla
    return data.tabla.filter(r => {
      if (!r.fecha_hes) return false
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

  const tablaOrdenada = useMemo(() => {
    if (!sortCol) return tablaFiltrada
    return [...tablaFiltrada].sort((a, b) => {
      const va = a[sortCol]
      const vb = b[sortCol]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [tablaFiltrada, sortCol, sortDir])

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
  // ── Gráfico de líneas: cada línea agrupa por la fecha de evento relevante ──────
  const lineChartData = useMemo(() => {
    if (!data) return []
    const mapE1  = new Map<string, number[]>()  // dias_etapa1 por mes de fecha_factura
    const mapE2  = new Map<string, number[]>()  // dias_etapa2 por mes de fecha_pago
    const mapTot = new Map<string, number[]>()  // dias_total  por mes de fecha_pago

    for (const r of data.tabla) {
      const mesFac  = r.fecha_factura?.substring(0, 7)
      const mesPago = r.fecha_pago?.substring(0, 7)
      if (mesFac && r.dias_etapa1 != null) {
        if (!mapE1.has(mesFac)) mapE1.set(mesFac, [])
        mapE1.get(mesFac)!.push(r.dias_etapa1)
      }
      if (mesPago) {
        if (r.dias_etapa2 != null) {
          if (!mapE2.has(mesPago)) mapE2.set(mesPago, [])
          mapE2.get(mesPago)!.push(r.dias_etapa2)
        }
        if (r.dias_total != null) {
          if (!mapTot.has(mesPago)) mapTot.set(mesPago, [])
          mapTot.get(mesPago)!.push(r.dias_total)
        }
      }
    }

    const mean = (a: number[] | undefined) =>
      a?.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null

    const allMonths = new Set([...mapE1.keys(), ...mapE2.keys(), ...mapTot.keys()])
    const desde = toYM(fechaDesde)
    const hasta = toYM(fechaHasta)

    return Array.from(allMonths)
      .sort()
      .filter(mes => {
        const ym = toYM(mes)
        if (desde && ym < desde) return false
        if (hasta && ym > hasta) return false
        return true
      })
      .map(mes => ({
        mes:              fmtMonth(mes),
        'HES → Factura':  mean(mapE1.get(mes)),
        'Factura → Pago': mean(mapE2.get(mes)),
        'Total':          mean(mapTot.get(mes)),
      }))
  }, [data, fechaDesde, fechaHasta])

  if (loading) return <><PageHeader title="Dashboard DAB" /><div className="page"><p>Cargando...</p></div></>
  if (error)   return <><PageHeader title="Dashboard DAB" /><div className="page"><p style={{ color: 'red' }}>{error}</p></div></>
  if (!data)   return null

  const filtroActivo = !!(fechaDesde || fechaHasta)
  const subtitleFiltro = filtroActivo
    ? `${fechaDesde ? fmtMonth(fechaDesde) : '…'} → ${fechaHasta ? fmtMonth(fechaHasta) : '…'} · ${tablaRango.length} EPs`
    : `${data.tabla.length} EPs en total`

  const hasCodigo   = data.tabla.some(r => r.Código && r.Código !== 'Sí' && r.Código !== 'Si' && r.Código !== 'No')
  const hasContrato = data.tabla.some(r => r.Contrato)
  const hasProyecto = data.tabla.some(r => r.Proyecto)
  const colSpan     = 4 + (hasCodigo ? 1 : 0) + (hasContrato ? 1 : 0) + (hasProyecto ? 1 : 0) + 3

  // ── Helper encabezado ordenable ───────────────────────────────────────────────
  function SortTh({ col, label, style }: { col: keyof TablaRow; label: string; style?: React.CSSProperties }) {
    const active = sortCol === col
    return (
      <th
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
        onClick={() => {
          if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
          else { setSortCol(col); setSortDir('asc') }
        }}
      >
        {label}{' '}
        <span style={{ opacity: active ? 1 : 0.25, fontSize: 10 }}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </th>
    )
  }

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
          <>
            {/* Fila superior: barra de cumplimiento + desviación */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <ComplianceCard adj={adj} onClick={() => toggleAdj('cumplimiento')} active={activeAdj === 'cumplimiento'} />
              <NumCard
                title="Desviación promedio"
                value={adj.desviacion_promedio}
                unit="d"
                sub="días reales sobre el plan para procesos finalizados"
                color={adj.desviacion_promedio != null && adj.desviacion_promedio > 0 ? '#dc2626' : '#16a34a'}
                info="Promedio de días de desviación respecto a la fecha de término planificada en procesos licitatorios finalizados. Positivo = atraso. Fuente: board Monday PROCESOS LICITACIÓN."
                onClick={() => toggleAdj('desviacion')}
                active={activeAdj === 'desviacion'}
              />
            </div>

            {/* Filtros para licitaciones activas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Licitaciones activas
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ label: 'Críticos', sel: true }, { label: 'Todos', sel: false }].map(({ label, sel }) => {
                  const isActive = adjCriticsOnly === sel
                  return (
                    <button
                      key={label}
                      onClick={() => setAdjCriticsOnly(sel)}
                      style={{
                        padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', border: '2px solid #111827',
                        background: isActive ? NAVY : 'white',
                        color:      isActive ? GOLD : '#111827',
                        transition: 'background .15s, color .15s',
                      }}
                    >{label}</button>
                  )
                })}
              </div>
              {adj.tipos_disponibles && adj.tipos_disponibles.length > 0 && (
                <select
                  value={adjTipoProceso}
                  onChange={e => setAdjTipoProceso(e.target.value)}
                  style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }}
                >
                  <option value="">Todos los tipos</option>
                  {adj.tipos_disponibles.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Tarjetas activos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 4 }}>
              <NumCard
                title="Atrasado"
                value={adj.criticos_pendientes}
                sub="licitaciones activas"
                color={adj.criticos_pendientes > 0 ? '#dc2626' : '#16a34a'}
                info="Procesos activos cuya brecha estimada es mayor a +3 días (fin estimado supera en más de 3 días al fin planificado). Brecha = fin estimado − fin planificado, calculado como: hoy + (ciclo promedio del tipo − días transcurridos desde inicio real)."
                onClick={() => toggleAdj('criticos')}
                active={activeAdj === 'criticos'}
              />
              <NumCard
                title="Riesgo de atraso"
                value={adj.riesgo_pendientes}
                sub="licitaciones activas"
                color={adj.riesgo_pendientes > 0 ? '#d97706' : '#16a34a'}
                info="Procesos activos cuya brecha estimada está entre −3 y +3 días respecto al fin planificado. Representa el margen de tolerancia alrededor de la fecha programada."
                onClick={() => toggleAdj('riesgo')}
                active={activeAdj === 'riesgo'}
              />
              <NumCard
                title="A tiempo"
                value={adj.activos_a_tiempo}
                sub="licitaciones activas"
                color="#16a34a"
                info="Procesos activos cuya brecha estimada es menor a −3 días (fin estimado es al menos 3 días antes del planificado), o sin fecha planificada registrada."
                onClick={() => toggleAdj('a_tiempo_activo')}
                active={activeAdj === 'a_tiempo_activo'}
              />
            </div>
            {activeAdj && (
              <AdjDetallePanel
                which={activeAdj}
                data={adjDetalle}
                loading={adjDetalleLoading}
                error={adjDetalleError}
                onClose={() => setActiveAdj(null)}
              />
            )}
          </>
        )}

        {/* ── 2. Gestión de Proveedores y control de costos ─────────────────── */}
        {gestion && (() => {
          const sec  = SECCION_LABEL[gestion.estado_seccion]
          const sign = gestion.desvio_costos_pct > 0 ? '+' : ''
          return (
            <>
              <div className="panel" style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Gestión de Proveedores y control de costos operativos
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: sec.bg, color: sec.color, border: `1px solid ${sec.border}`, whiteSpace: 'nowrap' }}>
                    {sec.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <GestionCard
                    title="Base oferentes"
                    value={gestion.base_oferentes}
                    meta={`≥ ${gestion.meta_oferentes}`}
                    met={gestion.base_oferentes >= gestion.meta_oferentes}
                    info={`Empresas distintas adjudicadas en contratos vigentes. Contratos críticos: marcados como "Contrato Crítico = Sí" en SIC_Contratos (incluye sondaje, perforación, movimiento de tierra, campamento, primeros auxilios y servicios geológicos). Fuente: dbo.SIC_Contratos.`}
                    onClick={() => toggleGestion('oferentes')}
                    active={activeGestion === 'oferentes'}
                    extra={
                      <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: gestion.tipos_disponibles?.length ? 8 : 0 }}>
                          {[{ label: 'Críticos', sel: true }, { label: 'Todos', sel: false }].map(({ label, sel }) => {
                            const active = criticsOnly === sel
                            return (
                              <button
                                key={label}
                                onClick={() => setCriticsOnly(sel)}
                                style={{
                                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                  cursor: 'pointer', border: '2px solid #111827',
                                  background: active ? NAVY : 'white',
                                  color:      active ? GOLD : '#111827',
                                  transition: 'background .15s, color .15s',
                                }}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                        {gestion.tipos_disponibles && gestion.tipos_disponibles.length > 0 && (
                          <select
                            value={tipoContrato}
                            onChange={e => setTipoContrato(e.target.value)}
                            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 4, background: 'white', width: '100%' }}
                          >
                            <option value="">Todos los tipos</option>
                            {gestion.tipos_disponibles.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    }
                  />
                  <GestionCard
                    title="Desvío costos contratos"
                    value={`${sign}${gestion.desvio_costos_pct.toFixed(2)}%`}
                    meta={`≤ ${gestion.meta_desvio_pct}%`}
                    met={gestion.desvio_costos_pct <= gestion.meta_desvio_pct}
                    info="Porcentaje de variación de monto en modificaciones de contratos del período (monto adicional / monto original). Meta: ≤5%. Fuente: board Monday Modificaciones."
                    onClick={() => toggleGestion('desvio')}
                    active={activeGestion === 'desvio'}
                  />
                  <GestionCard
                    title="Modificaciones fuera de CC"
                    value={gestion.modificaciones_fuera_cc}
                    meta={`= ${gestion.meta_fuera_cc}`}
                    met={gestion.modificaciones_fuera_cc <= gestion.meta_fuera_cc}
                    info="Modificaciones de contrato cuya razón no corresponde a Control de Cambios (no son coyuntura, perforación ni PAI). Meta: 0. Fuente: board Monday Modificaciones."
                    onClick={() => toggleGestion('fuera_cc')}
                    active={activeGestion === 'fuera_cc'}
                  />
                </div>

                <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  CC: Control de Cambios &nbsp;·&nbsp; Datos a cierre del periodo de medición.
                </div>
              </div>
              {activeGestion && (
                <GestionDetallePanel
                  which={activeGestion}
                  data={gestionDetalle}
                  loading={gestionDetalleLoading}
                  error={gestionDetalleError}
                  onClose={() => setActiveGestion(null)}
                />
              )}
            </>
          )
        })()}

        {/* ── 3. KPIs ciclo EP ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard
            label="Total EPs"
            value={kpisFiltrados.total}
            info="Total de EPs (Estados de Pago) en el período seleccionado. Fuente: tabla dbo.SIC_EPs en SQL Server."
          />
          <KpiCard
            label="Con fecha de pago"
            value={kpisFiltrados.completadas}
            sub="ciclo completo"
            info="EPs que tienen registrada la Factura Fecha de Pago, es decir, con ciclo completo HES → Factura → Pago. Fuente: campo 'Factura Fecha de Pago' en dbo.SIC_EPs."
          />
          <KpiCard
            label="Tiempo promedio"
            value={kpisFiltrados.prom_total != null ? `${kpisFiltrados.prom_total} d` : null}
            sub="HES → pago"
            info="Promedio de días transcurridos desde la HES Fecha hasta la Factura Fecha de Pago. Solo considera EPs con ciclo completo."
          />
          <KpiCard
            label="Mediana"
            value={kpisFiltrados.mediana_total != null ? `${kpisFiltrados.mediana_total} d` : null}
            sub="tiempo total"
            info="Mediana de días del ciclo completo (HES → Pago). Menos sensible a valores extremos que el promedio; mejor reflejo del caso típico."
          />
          <KpiCard
            label="Prom. HES → Factura"
            value={kpisFiltrados.prom_etapa1 != null ? `${kpisFiltrados.prom_etapa1} d` : null}
            sub="días en etapa 1"
            info="Promedio de días entre HES Fecha y Factura Fecha. Mide la demora en la etapa de facturación. Fuente: dbo.SIC_EPs campos 'HES Fecha' y 'Factura Fecha'."
          />
          <KpiCard
            label="Prom. Factura → Pago"
            value={kpisFiltrados.prom_etapa2 != null ? `${kpisFiltrados.prom_etapa2} d` : null}
            sub="días en etapa 2"
            info="Promedio de días entre Factura Fecha y Factura Fecha de Pago. Mide la demora en el procesamiento y pago efectivo. Fuente: dbo.SIC_EPs."
          />
        </div>

        {/* ── 4. Evolución temporal del ciclo de pago ───────────────────────── */}
        {lineChartData.length > 0 && (() => {
          const LINES: { key: string; color: string }[] = [
            { key: 'HES → Factura',  color: '#1e40af' },
            { key: 'Factura → Pago', color: '#f97316' },
            { key: 'Total',          color: '#111827' },
          ]
          return (
            <div className="panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="panel-title" style={{ margin: 0 }}>Días promedio por mes</span>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  {LINES.map(({ key, color }) => {
                    const active = visibleLines.has(key)
                    return (
                      <button
                        key={key}
                        onClick={() => toggleLine(key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', border: `1.5px solid ${color}`,
                          background: active ? color : 'white',
                          color: active ? 'white' : color,
                          transition: 'all .15s',
                        }}
                      >
                        <span style={{ width: 14, height: 2, background: active ? 'white' : color, display: 'inline-block', borderRadius: 1 }} />
                        {key}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                HES→Factura por mes de factura · Factura→Pago y Total por mes de pago
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} tickFormatter={(v: number) => Number.isFinite(v) ? Math.round(v).toString() : ''} />
                  <Tooltip formatter={(v: number | null) => v != null ? `${v} días` : '—'} />
                  {LINES.map(({ key, color }) =>
                    visibleLines.has(key) ? (
                      <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} connectNulls={false} />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        })()}

        {/* ── 6. Tabla detalle EP ───────────────────────────────────────────── */}
        <div className="panel">
          <div
            className="panel-title"
            onClick={() => setEpOpen(v => !v)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
          >
            <span>Detalle por EP</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400 }}>{epOpen ? '▲ Ocultar' : '▼ Ver detalle'}</span>
          </div>
          {epOpen && <>
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
                    {hasContrato && <SortTh col="Contrato" label="Contrato" />}
                    {hasCodigo   && <SortTh col="Código"   label="EP Nº" />}
                    <SortTh col="Nombre"      label="Proveedor" />
                    {hasProyecto && <SortTh col="Proyecto" label="Proyecto" />}
                    <SortTh col="Grupo_Estado"  label="Estado" />
                    <SortTh col="fecha_hes"     label="HES Fecha" />
                    <SortTh col="fecha_factura" label="Factura Fecha" />
                    <SortTh col="fecha_pago"    label="F. de Pago" />
                    <SortTh col="dias_etapa1"   label="HES→Fac (d)"  style={{ textAlign: 'right' }} />
                    <SortTh col="dias_etapa2"   label="Fac→Pago (d)" style={{ textAlign: 'right' }} />
                    <SortTh col="dias_total"    label="Total (d)"    style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {tablaOrdenada.map((r, i) => (
                    <tr key={i}>
                      {hasContrato && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.Contrato ?? '—'}</td>}
                      {hasCodigo   && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.Código   ?? '—'}</td>}
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.Nombre}>{r.Nombre ?? '—'}</td>
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
                  {tablaOrdenada.length === 0 && (
                    <tr><td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Sin resultados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
              {tablaOrdenada.length} de {data.tabla.length} registros
            </div>
          </>}
        </div>

      </div>
    </>
  )
}
