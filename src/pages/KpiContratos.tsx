import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import MultiSelectSearch from '../components/MultiSelectSearch'
import { getKpiDisponibilidad, getKpiMaquinas, getKpiProyectos, getKpiHoleIds } from '../api/client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

const TIPOS = [
  'Perforación',
  'Movimiento de Tierra',
  'Campamento',
  'Primeros Auxilios',
  'Apoyo Geológico',
] as const

type TipoContrato = typeof TIPOS[number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}
function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(v)
}
const hoy  = () => new Date().toISOString().slice(0, 10)
const mes0 = () => hoy().slice(0, 8) + '01'
const toOpts = (arr: string[]) => arr.map(v => ({ value: v, label: v }))

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, loading }: {
  label: string; value: string; unit?: string; loading?: boolean
}) {
  return (
    <div className="kpi-card">
      <span>{label}</span>
      <strong style={{ opacity: loading ? 0.35 : 1 }}>{loading ? '…' : value}</strong>
      {unit && <small>{unit}</small>}
    </div>
  )
}

// ── MultiSelect con botón "Todas / Ninguna" ───────────────────────────────────

function MSWithToggle({
  label, options, selected, onChange, placeholder, width = 260,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  width?: number
}) {
  const all = selected.length === options.length && options.length > 0
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
      {label}
      <MultiSelectSearch
        options={toOpts(options)}
        selected={selected}
        onChange={onChange}
        placeholder={placeholder ?? `Todos (${options.length})`}
        width={width}
      />
      <button
        onClick={() => onChange(all ? [] : [...options])}
        style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--gray-300)',
          background: all ? 'var(--navy-500)' : '#fff',
          color: all ? '#fff' : 'var(--color-text-muted)',
          cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600,
        }}
      >
        {all ? 'Ninguna' : 'Todas'}
      </button>
    </label>
  )
}

// ── Interfaz respuesta backend ────────────────────────────────────────────────

interface DispData {
  pct_maquina?:               number | null
  horas_total?:               number
  horas_disponibles_maquina?: number
  pct_personal?:              number | null
  horas_espera_personal?:     number
  pct_cumplimiento?:          number | null
  metros_avance?:             number
  metros_pai?:                number
  error?:                     string
}

// ── Hook disponibilidad ───────────────────────────────────────────────────────

function useDisponibilidad(
  desde: string, hasta: string,
  maquinas: string[], proyectos: string[], holeids: string[],
) {
  const [data, setData]       = useState<DispData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getKpiDisponibilidad(
      desde || undefined, hasta || undefined,
      maquinas, proyectos, holeids,
    )
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, maquinas.join(','), proyectos.join(','), holeids.join(',')])

  return { data, loading }
}

// ── Hook HOLEIDs dependiente de proyectos ─────────────────────────────────────

function useHoleIds(proyectos: string[]) {
  const [holeids, setHoleids] = useState<string[]>([])

  useEffect(() => {
    getKpiHoleIds(proyectos.length ? proyectos : undefined)
      .then(setHoleids)
      .catch(() => setHoleids([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectos.join(',')])

  return holeids
}

// ── Panel de filtros Perforación ──────────────────────────────────────────────

function FiltrosPerforacion({
  desde, hasta, maquinas, proyectos, holeids,
  allMaquinas, allProyectos, allHoleids,
  onDesde, onHasta, onMaquinas, onProyectos, onHoleids,
}: {
  desde: string; hasta: string
  maquinas: string[]; proyectos: string[]; holeids: string[]
  allMaquinas: string[]; allProyectos: string[]; allHoleids: string[]
  onDesde: (v: string) => void; onHasta: (v: string) => void
  onMaquinas: (v: string[]) => void; onProyectos: (v: string[]) => void; onHoleids: (v: string[]) => void
}) {
  return (
    <div className="filters-bar" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        Desde
        <input type="date" value={desde} onChange={e => onDesde(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 6 }} />
      </label>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        Hasta
        <input type="date" value={hasta} onChange={e => onHasta(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 6 }} />
      </label>
      <MSWithToggle label="Proyecto"  options={allProyectos} selected={proyectos} onChange={v => { onProyectos(v); onHoleids([]) }} placeholder={`Todos (${allProyectos.length})`} width={240} />
      <MSWithToggle label="Hole ID"   options={allHoleids}   selected={holeids}   onChange={onHoleids}  placeholder={`Todos (${allHoleids.length})`}  width={220} />
      <MSWithToggle label="Máquina"   options={allMaquinas}  selected={maquinas}  onChange={onMaquinas} placeholder={`Todas (${allMaquinas.length})`}  width={240} />
    </div>
  )
}

// ── Tab Perforación ───────────────────────────────────────────────────────────

function TabPerforacion({ allMaquinas, allProyectos }: { allMaquinas: string[]; allProyectos: string[] }) {
  const [desde,    setDesde]    = useState(mes0)
  const [hasta,    setHasta]    = useState(hoy)
  const [maquinas, setMaquinas] = useState<string[]>([])
  const [proyectos, setProyectos] = useState<string[]>([])
  const [holeids,  setHoleids]  = useState<string[]>([])

  const allHoleids = useHoleIds(proyectos)
  const { data, loading } = useDisponibilidad(desde, hasta, maquinas, proyectos, holeids)

  return (
    <>
      <FiltrosPerforacion
        desde={desde} hasta={hasta}
        maquinas={maquinas} proyectos={proyectos} holeids={holeids}
        allMaquinas={allMaquinas} allProyectos={allProyectos} allHoleids={allHoleids}
        onDesde={setDesde} onHasta={setHasta}
        onMaquinas={setMaquinas} onProyectos={setProyectos} onHoleids={setHoleids}
      />
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KpiCard
          label="Disponibilidad de máquina"
          value={fmtPct(data?.pct_maquina)}
          unit={data?.horas_total ? `${fmtNum(data.horas_disponibles_maquina)} h disp. / ${fmtNum(data.horas_total)} h total` : undefined}
          loading={loading}
        />
        <KpiCard
          label="Disponibilidad de personal"
          value={fmtPct(data?.pct_personal)}
          unit={data?.horas_espera_personal ? `${fmtNum(data.horas_espera_personal)} h espera personal` : undefined}
          loading={loading}
        />
        <KpiCard
          label="Cumplimiento del plan de perforación"
          value={fmtPct(data?.pct_cumplimiento)}
          unit={data?.metros_pai ? `${fmtNum(data.metros_avance)} m avance / ${fmtNum(data.metros_pai)} m PAI` : undefined}
          loading={loading}
        />
        <KpiCard label="Desviación de sondajes"   value="—" unit="%" />
        <KpiCard label="Recuperación de muestras" value="—" unit="%" />
      </div>
    </>
  )
}

// ── Tabs sin datos aún ────────────────────────────────────────────────────────

function TabMovimientoTierra() {
  return (
    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
      <KpiCard label="Disponibilidad de máquina"  value="—" unit="%" />
      <KpiCard label="Disponibilidad de personal" value="—" unit="%" />
    </div>
  )
}

function TabCampamento() {
  return (
    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <KpiCard label="Acreditación"         value="—" unit="%" />
      <KpiCard label="Desayunos servidos"   value="—" unit="raciones" />
      <KpiCard label="Almuerzos servidos"   value="—" unit="raciones" />
      <KpiCard label="Meriendas servidas"   value="—" unit="raciones" />
      <KpiCard label="Calidad del servicio" value="—" unit="puntos" />
    </div>
  )
}

function TabPrimerosAuxilios() {
  return (
    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
      <KpiCard label="Acreditación"                 value="—" unit="%" />
      <KpiCard label="Rotación de personal"         value="—" unit="%" />
      <KpiCard label="Disponibilidad de personal"   value="—" unit="%" />
      <KpiCard label="Acreditación de subcontratos" value="—" unit="%" />
    </div>
  )
}

function TabApoyoGeologico() {
  return (
    <div className="kpi-grid" style={{ gridTemplateColumns: '1fr' }}>
      <KpiCard label="Metros de corte" value="—" unit="m" />
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function KpiContratos() {
  const [activeTab,    setActiveTab]    = useState<TipoContrato>('Perforación')
  const [allMaquinas,  setAllMaquinas]  = useState<string[]>([])
  const [allProyectos, setAllProyectos] = useState<string[]>([])

  useEffect(() => {
    getKpiMaquinas().then(setAllMaquinas).catch(() => {})
    getKpiProyectos().then(setAllProyectos).catch(() => {})
  }, [])

  return (
    <div className="page">
      <PageHeader title="KPI Contratos" subtitle="Indicadores clave por tipo de contrato" />

      <div className="tabs">
        {TIPOS.map(tipo => (
          <button
            key={tipo}
            className={`tab${activeTab === tipo ? ' active' : ''}`}
            onClick={() => setActiveTab(tipo)}
          >
            {tipo}
          </button>
        ))}
      </div>

      {activeTab === 'Perforación'          && <TabPerforacion      allMaquinas={allMaquinas} allProyectos={allProyectos} />}
      {activeTab === 'Movimiento de Tierra' && <TabMovimientoTierra />}
      {activeTab === 'Campamento'           && <TabCampamento />}
      {activeTab === 'Primeros Auxilios'    && <TabPrimerosAuxilios />}
      {activeTab === 'Apoyo Geológico'      && <TabApoyoGeologico />}
    </div>
  )
}
