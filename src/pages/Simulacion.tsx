import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import {
  getSimulacionLista, getSimulacionProyectos,
  getSimulacionVendorCodes, getSimulacionContratos,
  getSimulacion, guardarSimulacion, eliminarSimulacion,
} from '../api/client'

// ── tipos ─────────────────────────────────────────────────────────────────────

interface SimItem {
  id: number; nombre: string; usuario: string
  fecha_guardado: string; num_lineas: number
}
interface ProyectoOpt { codigo: string; nombre: string; id_blanco: string }

/** Una fila en la tabla = dupla (proyecto, alcance) */
interface DuplaRow {
  proyecto: string
  alcance: string
  contratos_pyc: string[]
  moneda: string
  total_proyectado: number
  periodo_inicio: string
  periodo_fin: string
  periodos: { periodo: string; monto: number }[]
}

interface SicContrato {
  codigo_ctt: string; Descripcion_ctt: string; Tipo_contrato: string
  Saldo_CLP: number; Estado_ctt: string
}
interface Solpe {
  Código: string; Nombre: string; Monto: number
  Moneda: string; Estado_SOLPE: string; Grupo_Estado: string
}
interface Asignacion {
  contrato_asignado: string
  tipo_asignacion: 'SIC' | 'SOLPE'
  saldo_inicial: number
  moneda: string
  display: string
}
interface LineaGuardada {
  proyecto: string
  alcance: string
  contrato_asignado: string
  tipo_asignacion: string
  saldo_inicial: number
  moneda: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

const COLORS = ['#1e3a5f', '#c4a84f', '#2a9d8f', '#e76f51', '#457b9d', '#6a4c93', '#2d6a4f']
const MESES  = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const fmtPeriodo = (p: string) => {
  const [y, m] = p.split('-')
  return `${MESES[parseInt(m)] ?? m} ${y?.slice(2)}`
}

const fmtMoney = (n: number, moneda = 'CLP') => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (moneda === 'CLP') {
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`
    return `${sign}$${Math.round(abs)}`
  }
  return `${sign}${abs.toFixed(0)} ${moneda}`
}

const encodeOpt = (tipo: string, codigo: string, saldo: number, moneda: string, display: string) =>
  `${tipo}||${codigo}||${saldo}||${moneda}||${display}`

const decodeOpt = (v: string): Asignacion | null => {
  const parts = v.split('||')
  if (parts.length < 5) return null
  return {
    tipo_asignacion:   parts[0] as 'SIC' | 'SOLPE',
    contrato_asignado: parts[1],
    saldo_inicial:     parseFloat(parts[2]) || 0,
    moneda:            parts[3],
    display:           parts.slice(4).join('||'),
  }
}

/** Clave única por dupla */
const duplaKey = (proyecto: string, alcance: string) => `${proyecto}::${alcance}`

// ── MultiSelectSearch ─────────────────────────────────────────────────────────

interface MSOption { value: string; label: string; sublabel?: string }
interface SearchMode { key: 'value' | 'label'; label: string; placeholder: string }

function MultiSelectSearch({ options, value, onChange, placeholder = 'Buscar…', searchModes }: {
  options: MSOption[]; value: string[]; onChange: (v: string[]) => void
  placeholder?: string; searchModes?: SearchMode[]
}) {
  const [open, setOpen]       = useState(false)
  const [q, setQ]             = useState('')
  const [modeIdx, setModeIdx] = useState(0)
  const ref                   = useRef<HTMLDivElement>(null)
  const inputRef              = useRef<HTMLInputElement>(null)
  const activeMode            = searchModes?.[modeIdx]

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = useMemo(() => {
    const ql = q.toLowerCase()
    if (!ql) return options
    if (activeMode?.key === 'value') return options.filter(o => o.value.toLowerCase().includes(ql))
    if (activeMode?.key === 'label') return options.filter(o => o.label.toLowerCase().includes(ql))
    return options.filter(o =>
      o.label.toLowerCase().includes(ql) ||
      o.sublabel?.toLowerCase().includes(ql) ||
      o.value.toLowerCase().includes(ql))
  }, [options, q, activeMode])

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {searchModes && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 5 }}>
          {searchModes.map((m, i) => (
            <button key={m.key} type="button"
              onMouseDown={e => { e.preventDefault(); setModeIdx(i); setQ('') }}
              style={{
                padding: '2px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                border: '1px solid var(--color-border)',
                background: modeIdx === i ? 'var(--navy-500)' : '#fff',
                color:      modeIdx === i ? '#fff' : 'var(--color-text-muted)',
                fontWeight: modeIdx === i ? 600 : 400,
              }}
            >{m.label}</button>
          ))}
        </div>
      )}
      <div
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
          border: '1px solid var(--color-border)', borderRadius: 4,
          background: '#fff', padding: '4px 8px', cursor: 'text', minHeight: 36,
        }}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        {value.map(v => {
          const opt = options.find(o => o.value === v)
          return (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 8px', background: 'var(--navy-500)', color: '#fff',
              borderRadius: 99, fontSize: 11, lineHeight: '18px', whiteSpace: 'nowrap',
            }}>
              {opt?.label || v}
              <span style={{ cursor: 'pointer', marginLeft: 2, opacity: 0.75, fontSize: 14, lineHeight: 1 }}
                onMouseDown={e => { e.stopPropagation(); toggle(v) }}>×</span>
            </span>
          )
        })}
        <input
          ref={inputRef}
          style={{ flex: '1 1 80px', border: 'none', outline: 'none', fontSize: 13, padding: '2px 0', minWidth: 60, background: 'transparent' }}
          placeholder={value.length === 0 ? (activeMode?.placeholder ?? placeholder) : ''}
          value={q} onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)}
        />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid var(--color-border)', borderRadius: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>Sin resultados</div>
            : filtered.map(o => (
                <label key={o.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  background: value.includes(o.value) ? '#f0f4ff' : 'transparent',
                }}
                  onMouseDown={e => { e.preventDefault(); toggle(o.value) }}
                >
                  <input type="checkbox" checked={value.includes(o.value)} onChange={() => {}} style={{ marginTop: 2 }} />
                  <div style={{ fontWeight: value.includes(o.value) ? 600 : 400 }}>
                    {activeMode?.key === 'value' ? o.value
                      : activeMode?.key === 'label' ? o.label
                      : <>{o.label}{o.sublabel && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 6 }}>{o.sublabel}</span>}</>
                    }
                  </div>
                </label>
              ))
          }
        </div>
      )}
    </div>
  )
}

// ── Excel export ──────────────────────────────────────────────────────────────

function exportarExcel(
  nombre: string,
  proyeccion: ReturnType<typeof calcProyeccion>,
  allPeriods: string[],
) {
  const wb = XLSX.utils.book_new()

  // Hoja 1: resumen por contrato
  const resumen = proyeccion.map(c => ({
    'Contrato':      c.codigo,
    'Descripción':   c.display,
    'Moneda':        c.moneda,
    'Saldo Inicial': c.saldo_inicial,
    'Gasto Total':   c.timeline.reduce((s, t) => s + t.gasto, 0),
    'Saldo Final':   c.timeline.at(-1)?.saldo ?? c.saldo_inicial,
    'Alerta':        c.timeline.find(t => t.saldo <= 0) ? 'AGOTAMIENTO' : '',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen')

  // Hoja 2: timeline mensual (pivot)
  const pivot = allPeriods.map(p => {
    const row: Record<string, any> = { Período: fmtPeriodo(p) }
    proyeccion.forEach(c => {
      const pt = c.timeline.find(t => t.periodo === p)
      row[`${c.codigo} Gasto`] = pt?.gasto ?? 0
      row[`${c.codigo} Saldo`] = pt?.saldo ?? ''
    })
    return row
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivot), 'Timeline')

  XLSX.writeFile(wb, `simulacion_${nombre || 'sin_nombre'}.xlsx`)
}

// ── cálculo de proyección ─────────────────────────────────────────────────────

function calcProyeccion(
  duplas: DuplaRow[],
  asignaciones: Record<string, Asignacion>,
) {
  const byC: Record<string, {
    saldo_inicial: number; moneda: string; display: string
    gasto: Record<string, number>
  }> = {}

  duplas.forEach(d => {
    const asig = asignaciones[duplaKey(d.proyecto, d.alcance)]
    if (!asig) return
    const key = asig.contrato_asignado
    if (!byC[key]) byC[key] = {
      saldo_inicial: asig.saldo_inicial, moneda: asig.moneda,
      display: asig.display, gasto: {},
    }
    d.periodos.forEach(p => {
      byC[key].gasto[p.periodo] = (byC[key].gasto[p.periodo] ?? 0) + p.monto
    })
  })

  return Object.entries(byC).map(([codigo, data]) => {
    const periodos = Object.keys(data.gasto).sort()
    let saldo = data.saldo_inicial
    return {
      codigo, display: data.display, moneda: data.moneda,
      saldo_inicial: data.saldo_inicial,
      timeline: periodos.map(p => {
        saldo -= data.gasto[p]
        return { periodo: p, gasto: data.gasto[p], saldo }
      }),
    }
  })
}

// ── componente principal ──────────────────────────────────────────────────────

export default function Simulacion() {
  const [view, setView]           = useState<'lista' | 'workspace'>('lista')

  // lista
  const [simsList,   setSimsList]   = useState<SimItem[]>([])
  const [delConfirm, setDelConfirm] = useState<number | null>(null)

  // workspace meta
  const [simId,    setSimId]    = useState<number | null>(null)
  const [nombre,   setNombre]   = useState('')
  const [usuario,  setUsuario]  = useState(() => localStorage.getItem('carga_responsable') ?? '')
  const [saving,   setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  // workspace datos
  const [proyectosList,     setProyectosList]     = useState<ProyectoOpt[]>([])
  const [hasNombres,        setHasNombres]         = useState(false)
  const [selectedProyectos, setSelectedProyectos] = useState<string[]>([])
  const [duplas,            setDuplas]             = useState<DuplaRow[]>([])
  const [contratos,         setContratos]         = useState<{ sic: SicContrato[]; solpes: Solpe[] }>({ sic: [], solpes: [] })
  const [asignaciones,      setAsignaciones]      = useState<Record<string, Asignacion>>({})
  const [loadingDuplas,     setLoadingDuplas]     = useState(false)
  const [pendingLineas,     setPendingLineas]      = useState<LineaGuardada[] | null>(null)

  // carga inicial
  useEffect(() => {
    getSimulacionLista().then(setSimsList).catch(() => {})
    getSimulacionProyectos().then(r => { setProyectosList(r.proyectos); setHasNombres(r.has_nombres) }).catch(() => {})
    getSimulacionContratos().then(setContratos).catch(() => {})
  }, [])

  // carga duplas al cambiar proyectos
  useEffect(() => {
    if (selectedProyectos.length === 0) { setDuplas([]); return }
    setLoadingDuplas(true)
    getSimulacionVendorCodes(selectedProyectos)
      .then(setDuplas)
      .catch(() => setDuplas([]))
      .finally(() => setLoadingDuplas(false))
  }, [selectedProyectos])

  // aplica lineas guardadas cuando se cargan duplas
  useEffect(() => {
    if (!pendingLineas || duplas.length === 0) return
    const asig: Record<string, Asignacion> = {}
    pendingLineas.forEach(l => {
      const sic  = contratos.sic.find(c => c.codigo_ctt === l.contrato_asignado)
      const solp = contratos.solpes.find(s => s['Código'] === l.contrato_asignado)
      const key  = duplaKey(l.proyecto, l.alcance)
      asig[key] = {
        contrato_asignado: l.contrato_asignado,
        tipo_asignacion:   l.tipo_asignacion as 'SIC' | 'SOLPE',
        saldo_inicial:     Number(l.saldo_inicial) || 0,
        moneda:            l.moneda || 'CLP',
        display:           sic?.Descripcion_ctt ?? solp?.Nombre ?? l.contrato_asignado,
      }
    })
    setAsignaciones(asig)
    setPendingLineas(null)
  }, [duplas, pendingLineas, contratos])

  // proyección calculada
  const proyeccion = useMemo(
    () => calcProyeccion(duplas, asignaciones),
    [duplas, asignaciones],
  )

  const allPeriods = useMemo(() =>
    [...new Set(proyeccion.flatMap(c => c.timeline.map(t => t.periodo)))].sort(),
  [proyeccion])

  const chartData = useMemo(() =>
    allPeriods.map(p => {
      const row: Record<string, any> = { periodo: p, label: fmtPeriodo(p) }
      proyeccion.forEach(c => {
        const pt = c.timeline.find(t => t.periodo === p)
        if (pt) row[c.codigo] = pt.saldo
      })
      return row
    }),
  [allPeriods, proyeccion])

  // opciones de proyectos para el selector
  const proyectosOpts = useMemo<MSOption[]>(() =>
    proyectosList.map(p => ({
      value:    p.codigo,
      label:    p.nombre || p.codigo,
      sublabel: p.nombre && p.nombre !== p.codigo ? p.codigo : undefined,
    })),
  [proyectosList])

  const multiProyecto = selectedProyectos.length > 1

  // ── handlers ─────────────────────────────────────────────────────────────────

  const handleNueva = () => {
    setSimId(null); setNombre(''); setSelectedProyectos([])
    setDuplas([]); setAsignaciones([]); setView('workspace')
  }

  const handleAbrir = async (sim: SimItem) => {
    const data = await getSimulacion(sim.id)
    setSimId(sim.id); setNombre(sim.nombre); setUsuario(sim.usuario ?? '')
    setAsignaciones({})
    if (data.lineas?.length > 0) {
      const uniqueProys = [...new Set<string>(data.lineas.map((l: LineaGuardada) => l.proyecto))]
      setSelectedProyectos(uniqueProys)
      setPendingLineas(data.lineas)
    }
    setView('workspace')
  }

  const handleEliminar = async (id: number) => {
    await eliminarSimulacion(id)
    setSimsList(prev => prev.filter(s => s.id !== id))
    setDelConfirm(null)
  }

  const handleAssign = (d: DuplaRow, val: string) => {
    const key = duplaKey(d.proyecto, d.alcance)
    if (!val) {
      setAsignaciones(prev => { const n = { ...prev }; delete n[key]; return n })
      return
    }
    const decoded = decodeOpt(val)
    if (decoded) setAsignaciones(prev => ({ ...prev, [key]: decoded }))
  }

  const handleGuardar = async () => {
    if (!nombre.trim()) { alert('Ingresa un nombre para la simulación'); return }
    const lineas = duplas
      .filter(d => asignaciones[duplaKey(d.proyecto, d.alcance)])
      .map(d => {
        const a = asignaciones[duplaKey(d.proyecto, d.alcance)]
        return {
          proyecto: d.proyecto, alcance: d.alcance,
          contrato_asignado: a.contrato_asignado,
          tipo_asignacion: a.tipo_asignacion,
          saldo_inicial: a.saldo_inicial, moneda: a.moneda,
        }
      })
    if (lineas.length === 0) { alert('Asigna al menos un contrato antes de guardar'); return }
    setSaving(true)
    try {
      const result = await guardarSimulacion({ nombre, usuario, lineas, sim_id: simId ?? undefined })
      setSimId(result.id)
      getSimulacionLista().then(setSimsList)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleVolver = () => {
    getSimulacionLista().then(setSimsList)
    setView('lista')
  }

  // ── render lista ─────────────────────────────────────────────────────────────
  if (view === 'lista') return (
    <>
      <PageHeader title="Simulación What-If" />
      <div className="page">
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Simulaciones guardadas</div>
            <button className="btn" onClick={handleNueva}>+ Nueva simulación</button>
          </div>
          {simsList.length === 0
            ? <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                No hay simulaciones guardadas. Crea una nueva.
              </p>
            : <table className="data-table">
                <thead><tr>
                  <th>Nombre</th><th>Usuario</th><th>Guardado</th>
                  <th style={{ textAlign: 'right' }}>Duplas</th><th></th>
                </tr></thead>
                <tbody>
                  {simsList.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.nombre}</td>
                      <td>{s.usuario || '—'}</td>
                      <td style={{ fontSize: 12 }}>{s.fecha_guardado}</td>
                      <td style={{ textAlign: 'right' }}>{s.num_lineas}</td>
                      <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => handleAbrir(s)}>Abrir</button>
                        {delConfirm === s.id
                          ? <>
                              <button className="btn" style={{ background: '#dc2626', color: '#fff', fontSize: 12 }}
                                onClick={() => handleEliminar(s.id)}>Confirmar</button>
                              <button className="btn btn-ghost" onClick={() => setDelConfirm(null)}>Cancelar</button>
                            </>
                          : <button className="btn btn-ghost" style={{ color: '#dc2626' }}
                              onClick={() => setDelConfirm(s.id)}>Eliminar</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>
    </>
  )

  // ── render workspace ──────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader title="Simulación What-If" />
      <div className="page">

        {/* Barra superior */}
        <div className="panel" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={handleVolver}>← Volver</button>
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ flex: '2 1 200px', fontSize: 13, padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
              placeholder="Nombre de la simulación…"
              value={nombre} onChange={e => setNombre(e.target.value)}
            />
            <input
              style={{ flex: '1 1 140px', fontSize: 13, padding: '5px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}
              placeholder="Usuario"
              value={usuario} onChange={e => setUsuario(e.target.value)}
            />
          </div>
          {proyeccion.length > 0 && (
            <button className="btn btn-ghost"
              onClick={() => exportarExcel(nombre, proyeccion, allPeriods)}>
              ↓ Excel
            </button>
          )}
          <button className="btn" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando…' : simId ? 'Guardar cambios' : 'Guardar simulación'}
          </button>
          {savedMsg && <span style={{ fontSize: 12, color: 'var(--color-navy)', fontWeight: 600 }}>✓ Guardado</span>}
        </div>

        {/* Selector de proyectos */}
        <div className="panel">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Proyectos
          </div>
          <MultiSelectSearch
            options={proyectosOpts}
            value={selectedProyectos}
            onChange={v => { setSelectedProyectos(v); setAsignaciones({}) }}
            searchModes={[
              { key: 'label',  label: 'Nombre',    placeholder: 'Buscar por nombre de proyecto…' },
              { key: 'value',  label: 'ID Blanco',  placeholder: 'Buscar por ID Blanco…' },
              ...(hasNombres ? [] : []),
            ]}
          />
          {selectedProyectos.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              {loadingDuplas ? 'Cargando proyecciones P&C…' : `${duplas.length} duplas proyecto·alcance encontradas`}
            </p>
          )}
        </div>

        {/* Tabla de asignaciones por dupla */}
        {selectedProyectos.length > 0 && !loadingDuplas && (
          <div className="panel">
            <div className="panel-title" style={{ marginBottom: 10 }}>
              Asignación de contratos por dupla Proyecto · Alcance
            </div>
            {duplas.length === 0
              ? <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin proyecciones P&C para los proyectos seleccionados.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr>
                      {multiProyecto && <th>Proyecto</th>}
                      <th>Alcance de servicio</th>
                      <th>Contratos P&C originales</th>
                      <th>Período</th>
                      <th style={{ textAlign: 'right' }}>Total proyectado</th>
                      <th style={{ minWidth: 300 }}>Contrato a asignar</th>
                      <th style={{ textAlign: 'right' }}>Saldo inicial</th>
                    </tr></thead>
                    <tbody>
                      {duplas.map(d => {
                        const key    = duplaKey(d.proyecto, d.alcance)
                        const asig   = asignaciones[key]
                        const optVal = asig
                          ? encodeOpt(asig.tipo_asignacion, asig.contrato_asignado, asig.saldo_inicial, asig.moneda, asig.display)
                          : ''
                        return (
                          <tr key={key}>
                            {multiProyecto && (
                              <td style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                {d.proyecto}
                              </td>
                            )}
                            <td style={{ fontWeight: d.alcance ? 600 : 400, color: d.alcance ? 'inherit' : 'var(--color-text-muted)' }}>
                              {d.alcance || '(sin alcance)'}
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                              {d.contratos_pyc.join(', ')}
                            </td>
                            <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {d.periodo_inicio && d.periodo_fin
                                ? `${fmtPeriodo(d.periodo_inicio)} → ${fmtPeriodo(d.periodo_fin)}`
                                : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                              {fmtMoney(d.total_proyectado, d.moneda)}
                            </td>
                            <td>
                              <select
                                style={{ width: '100%', fontSize: 12, padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: 4 }}
                                value={optVal}
                                onChange={e => handleAssign(d, e.target.value)}
                              >
                                <option value="">— Sin asignar —</option>
                                <optgroup label="Contratos SIC">
                                  {contratos.sic.map(c => (
                                    <option key={c.codigo_ctt}
                                      value={encodeOpt('SIC', c.codigo_ctt, c.Saldo_CLP ?? 0, 'CLP', c.Descripcion_ctt ?? c.codigo_ctt)}>
                                      {c.codigo_ctt} — {(c.Descripcion_ctt ?? '').slice(0, 40)} ({fmtMoney(c.Saldo_CLP ?? 0)})
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Licitaciones / SOLPEs">
                                  {contratos.solpes.map(s => (
                                    <option key={s['Código']}
                                      value={encodeOpt('SOLPE', s['Código'], s.Monto ?? 0, s.Moneda ?? 'CLP', s.Nombre ?? s['Código'])}>
                                      {s['Código']} — {(s.Nombre ?? '').slice(0, 40)} ({fmtMoney(s.Monto ?? 0, s.Moneda)})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </td>
                            <td style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                              {asig ? fmtMoney(asig.saldo_inicial, asig.moneda) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* Proyección */}
        {proyeccion.length > 0 && (
          <>
            {/* Gráfico */}
            <div className="panel">
              <div className="panel-title">Proyección de saldos por contrato</div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Evolución mensual del saldo — la línea roja marca el agotamiento
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtMoney(v, proyeccion[0]?.moneda)} width={72} />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      const c = proyeccion.find(p => p.codigo === name)
                      return [fmtMoney(v, c?.moneda), c?.display || name]
                    }}
                    labelFormatter={l => `Período: ${l}`}
                  />
                  <Legend formatter={value => proyeccion.find(p => p.codigo === value)?.display || value}
                    wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} />
                  {proyeccion.map((c, i) => (
                    <Line key={c.codigo} dataKey={c.codigo}
                      stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                      dot={{ r: 3 }} connectNulls activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabla de proyección detallada */}
            <div className="panel">
              <div className="panel-title">Detalle mensual por contrato</div>
              {proyeccion.map((c, i) => {
                const agota = c.timeline.find(t => t.saldo <= 0)
                const last  = c.timeline.at(-1)
                return (
                  <div key={c.codigo} style={{ marginBottom: i < proyeccion.length - 1 ? 24 : 0 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 8, paddingBottom: 6,
                      borderBottom: `2px solid ${COLORS[i % COLORS.length]}`,
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{c.display || c.codigo}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                          Saldo inicial: <strong>{fmtMoney(c.saldo_inicial, c.moneda)}</strong>
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13 }}>
                        Saldo final:{' '}
                        <strong style={{ color: (last?.saldo ?? 0) <= 0 ? '#dc2626' : '#059669' }}>
                          {last ? fmtMoney(last.saldo, c.moneda) : '—'}
                        </strong>
                        {agota && (
                          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginLeft: 12 }}>
                            ⚠ Agota en {fmtPeriodo(agota.periodo)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ minWidth: 400 }}>
                        <thead><tr>
                          <th>Período</th>
                          <th style={{ textAlign: 'right' }}>Gasto proyectado</th>
                          <th style={{ textAlign: 'right' }}>Saldo restante</th>
                        </tr></thead>
                        <tbody>
                          {c.timeline.map(t => (
                            <tr key={t.periodo} style={{
                              background: t.saldo <= 0 ? '#fef2f2' : undefined,
                            }}>
                              <td style={{ fontWeight: 500 }}>{fmtPeriodo(t.periodo)}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {fmtMoney(t.gasto, c.moneda)}
                              </td>
                              <td style={{
                                textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                                color: t.saldo <= 0 ? '#dc2626' : t.saldo < c.saldo_inicial * 0.1 ? '#d97706' : 'inherit',
                              }}>
                                {fmtMoney(t.saldo, c.moneda)}
                                {t.saldo <= 0 && <span style={{ marginLeft: 4, fontSize: 11 }}>⚠</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
    </>
  )
}
