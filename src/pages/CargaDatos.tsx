import { useCallback, useRef, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import {
  uploadProyeccionesPyC, uploadDimensiones, uploadIncidencias, uploadCostoMetro,
  getDpoConfig, saveDpoConfig, getDpoMesesCargados, deleteDpoCostoMetroMes,
  getRegistroCargas, getFuentesExternas,
} from '../api/client'

type Area        = 'dab' | 'dpo' | 'registro'
type UploadState = { status: 'idle' | 'loading' | 'ok' | 'error'; message?: string; detail?: any }

const AREAS: Record<Area, { label: string; icon: string; description: string }> = {
  dab:      { label: 'DAB',      icon: '🏗️', description: 'Dirección de Abastecimiento' },
  dpo:      { label: 'DPO',      icon: '📐', description: 'Dirección de Proyectos y Operaciones' },
  registro: { label: 'Registro', icon: '📋', description: 'Historial de cargas y fuentes de datos' },
}

// Mapeo tabla SQL → módulos de la plataforma
const TABLA_MODULOS: Record<string, string> = {
  'dbo.proyecciones':          'Proyecciones P&C',
  'dbo.CostoMetro':            'Dashboard DPO',
  'dbo.registro_incidencias':  'Estado Proyectos',
  'dbo.Tabla_Articulos':       'Análisis · Saldo',
  'dbo.Tabla_Proyectos':       'Análisis · Saldo · Proyecciones',
  'dbo.Tabla_Programas':       'Análisis · Saldo · Proyecciones',
  'dbo.ConfigDPO':             'Dashboard DPO',
}

// ── Campo responsable ──────────────────────────────────────────────────────────
function ResponsableBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px', marginBottom: 20,
      background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 10,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>
        Responsable
      </span>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Nombre de quien sube el archivo (opcional)"
        style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 10px', fontSize: 13, fontFamily: 'inherit' }}
      />
      <span style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
        Se registra con cada carga
      </span>
    </div>
  )
}

// ── Zona de drop ───────────────────────────────────────────────────────────────
function DropZone({ inputRef, accept, acceptLabel, loading, onFile, onDrop }: {
  inputRef: React.RefObject<HTMLInputElement>
  accept: string; acceptLabel: string; loading: boolean
  onFile: (f: File) => void; onDrop: (e: React.DragEvent) => void
}) {
  return (
    <div
      onDrop={onDrop} onDragOver={e => e.preventDefault()}
      onClick={() => !loading && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        loading
          ? 'border-blue-200 bg-blue-50/40 cursor-default'
          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      {loading ? (
        <div className="space-y-2">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-blue-600 font-medium">Procesando...</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xl">📂</p>
          <p className="text-sm font-medium text-gray-600">Arrastrá o hacé clic para seleccionar</p>
          <p className="text-xs text-gray-400">{acceptLabel}</p>
        </div>
      )}
    </div>
  )
}

// ── Resultado de carga ─────────────────────────────────────────────────────────
function ResultOk({ detail }: { detail: any }) {
  if (!detail) return null
  if (detail.tabla === 'registro_incidencias') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold text-green-800">Carga exitosa</p>
        <p className="text-sm text-green-700">{detail.filas_insertadas?.toLocaleString('es-CL')} incidencias cargadas</p>
        <p className="text-xs text-green-600">{detail.ultima_carga}</p>
      </div>
    )
  }
  if ('filas_insertadas' in detail && 'contratos' in detail) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold text-green-800">Carga exitosa</p>
        <p className="text-sm text-green-700">{detail.filas_insertadas?.toLocaleString('es-CL')} filas · {detail.contratos} contratos</p>
        {detail.periodos?.length > 0 && (
          <p className="text-xs text-green-600">Períodos: {detail.periodos[0]} → {detail.periodos.at(-1)}</p>
        )}
      </div>
    )
  }
  if ('costo_metro_programado' in detail) {
    const fmt = (v: number) => v.toFixed(2)
    const pct = (v: number) => `${(v * 100).toFixed(2)}%`
    return (
      <div className="panel" style={{ marginTop: 0, background: 'var(--success-50)', border: '1px solid #c3e6b8' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: '#2d7a1e', fontSize: 13 }}>Carga exitosa</span>
          <span className="chip ok">{detail.mes_nombre} {detail.anio}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'C.M. Programado', value: `${fmt(detail.costo_metro_programado)} US$/m`, color: 'var(--navy-500)' },
            { label: 'C.M. Real',       value: `${fmt(detail.costo_metro_real)} US$/m`,       color: 'var(--gold-500)' },
            { label: 'Brecha',          value: pct(detail.brecha), color: detail.brecha < 0 ? 'var(--success-500)' : 'var(--error-500)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 6, padding: '8px 10px', border: '1px solid #d1e7ca' }}>
              <span style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', display: 'block' }}>{label}</span>
              <strong style={{ fontSize: 15, color, display: 'block', marginTop: 3 }}>{value}</strong>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>Guardado en dbo.CostoMetro · {detail.ultima_carga}</p>
      </div>
    )
  }
  if ('tablas' in detail) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1.5">
        <p className="text-sm font-semibold text-green-800">Carga exitosa</p>
        {Object.entries(detail.tablas).map(([table, n]) => (
          <p key={table} className="text-sm text-green-700">
            <span className="font-mono">{table}</span>: {(n as number).toLocaleString('es-CL')} filas
          </p>
        ))}
      </div>
    )
  }
  return null
}

// ── Upload card ────────────────────────────────────────────────────────────────
function UploadCard({ title, subtitle, accept, acceptLabel, icon, onUpload }: {
  title: string; subtitle: string; accept: string; acceptLabel: string
  icon: string; onUpload: (file: File) => Promise<any>
}) {
  const inputRef          = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const handle = async (file: File) => {
    setState({ status: 'loading' })
    try   { setState({ status: 'ok',    detail: await onUpload(file) }) }
    catch (e: any) { setState({ status: 'error', message: e?.response?.data?.detail ?? 'Error inesperado' }) }
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <DropZone inputRef={inputRef} accept={accept} acceptLabel={acceptLabel}
          loading={state.status === 'loading'} onFile={handle}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f) }} />
        {state.status === 'ok'    && <ResultOk detail={state.detail} />}
        {state.status === 'error' && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{state.message}</div>}
      </div>
    </div>
  )
}

// ── Costo Metro card ───────────────────────────────────────────────────────────
function CostoMetroCard({ onUpload }: { onUpload: (file: File) => Promise<any> }) {
  const inputRef                          = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState]     = useState<UploadState>({ status: 'idle' })
  const [meses, setMeses]                 = useState<{ anio: number; mes: number; mes_nombre: string; fecha_carga: string }[]>([])
  const [confirmDelete, setConfirmDelete] = useState<{ anio: number; mes: number } | null>(null)
  const [deleting, setDeleting]           = useState(false)

  const loadMeses = useCallback(() => { getDpoMesesCargados().then(setMeses).catch(() => {}) }, [])
  useEffect(() => { loadMeses() }, [loadMeses])

  const handle = async (file: File) => {
    setUploadState({ status: 'loading' })
    try   { setUploadState({ status: 'ok', detail: await onUpload(file) }); loadMeses() }
    catch (e: any) { setUploadState({ status: 'error', message: e?.response?.data?.detail ?? 'Error inesperado' }) }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try { await deleteDpoCostoMetroMes(confirmDelete.anio, confirmDelete.mes); setConfirmDelete(null); loadMeses() }
    finally { setDeleting(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden md:col-span-2">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <span className="text-xl">⛏️</span>
        <div>
          <p className="text-sm font-semibold text-gray-800">Costo Metro</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Archivo "Costo Metro - &lt;Mes&gt;.xlsx". El año se toma del año en curso; cada mes agrega o actualiza su fila.
          </p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <DropZone inputRef={inputRef} accept=".xlsx,.xls"
          acceptLabel="Solo archivos .xlsx / .xls — el mes se detecta del nombre del archivo"
          loading={uploadState.status === 'loading'} onFile={handle}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f) }} />
        {uploadState.status === 'ok'    && <ResultOk detail={uploadState.detail} />}
        {uploadState.status === 'error' && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{uploadState.message}</div>}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Meses cargados {new Date().getFullYear()}
          </p>
          {meses.length === 0
            ? <p className="text-xs text-gray-400 italic">No hay meses cargados aún.</p>
            : (
              <div className="flex flex-wrap gap-2">
                {meses.map(m => (
                  <div key={`${m.anio}-${m.mes}`}
                    className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1.5"
                    title={`Cargado: ${m.fecha_carga?.slice(0, 10)}`}>
                    <span className="text-xs font-semibold text-slate-700">{m.mes_nombre} {m.anio}</span>
                    {confirmDelete?.anio === m.anio && confirmDelete?.mes === m.mes ? (
                      <span className="flex items-center gap-1 ml-1">
                        <button onClick={doDelete} disabled={deleting}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                          {deleting ? '…' : '✓ Eliminar'}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete({ anio: m.anio, mes: m.mes })}
                        className="text-xs text-gray-400 hover:text-red-500 ml-0.5" title="Eliminar este mes">×</button>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ── Config DPO ─────────────────────────────────────────────────────────────────
function ConfigDPO({ responsable }: { responsable: string }) {
  const [meta,   setMeta]   = useState('')
  const [tol,    setTol]    = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'error'>('idle')
  const [msg,    setMsg]    = useState('')

  useEffect(() => {
    getDpoConfig().then((cfg: any) => {
      if (cfg.meta_costo_metro       != null) setMeta(String(cfg.meta_costo_metro))
      if (cfg.meta_tolerancia_brecha != null) setTol(String((cfg.meta_tolerancia_brecha * 100).toFixed(2)))
    }).catch(() => null)
  }, [])

  const save = async () => {
    const m = parseFloat(meta), t = parseFloat(tol)
    if (isNaN(m) || m <= 0)            { setMsg('Meta de costo metro debe ser un número positivo'); setStatus('error'); return }
    if (isNaN(t) || t < 0 || t > 100) { setMsg('Tolerancia debe estar entre 0 y 100%');           setStatus('error'); return }
    setStatus('loading')
    try {
      await saveDpoConfig({ meta_costo_metro: m, meta_tolerancia_brecha: t / 100 }, responsable)
      setStatus('ok'); setMsg('Configuración guardada correctamente')
    } catch { setStatus('error'); setMsg('Error al guardar la configuración') }
  }

  return (
    <div className="panel md:col-span-2">
      <h2 style={{ marginBottom: 16 }}>Parámetros Dashboard DPO</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            Meta Costo Metro (US$/m)
          </label>
          <input type="number" min="0" step="0.01" value={meta} onChange={e => setMeta(e.target.value)}
            placeholder="ej: 850.00"
            style={{ border: '1px solid var(--gray-200)', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 150, fontFamily: 'inherit' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            Tolerancia de Brecha (%)
          </label>
          <input type="number" min="0" max="100" step="0.1" value={tol} onChange={e => setTol(e.target.value)}
            placeholder="ej: 5.0"
            style={{ border: '1px solid var(--gray-200)', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 130, fontFamily: 'inherit' }} />
        </div>
        <button className="btn" onClick={save} disabled={status === 'loading'} style={{ opacity: status === 'loading' ? .6 : 1 }}>
          {status === 'loading' ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {status === 'ok'    && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--success-500)', fontWeight: 600 }}>{msg}</p>}
      {status === 'error' && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--error-500)',   fontWeight: 600 }}>{msg}</p>}
      <p style={{ marginTop: 8, fontSize: 11, color: 'var(--gray-400)' }}>
        Estos valores se muestran como referencia en el Dashboard DPO junto a cada indicador de Costo Metro.
      </p>
    </div>
  )
}

// ── Vista Registro ─────────────────────────────────────────────────────────────
const FUENTE_STYLE: Record<string, { bg: string; color: string }> = {
  'Plataforma': { bg: 'var(--navy-500)', color: '#fff' },
  'API SIC':    { bg: '#0369a1',         color: '#fff' },
  'Monday API': { bg: 'var(--gold-500)', color: '#fff' },
}

function FuenteChip({ fuente }: { fuente: string }) {
  const s = FUENTE_STYLE[fuente] ?? { bg: 'var(--gray-400)', color: '#fff' }
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 100, background: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
    }}>
      {fuente}
    </span>
  )
}

function RegistroView() {
  const [cargas,  setCargas]  = useState<any[]>([])
  const [externas, setExternas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRegistroCargas(), getFuentesExternas()])
      .then(([c, e]) => { setCargas(c); setExternas(e) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando registro…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Fuentes externas ── */}
      <section className="panel">
        <h2>Fuentes Externas</h2>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
          Tablas alimentadas por sistemas externos, independientes de la plataforma.
        </p>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Tabla / Archivo</th>
                <th>Tabla SQL</th>
                <th>Módulos que la usan</th>
                <th>Última modificación</th>
              </tr>
            </thead>
            <tbody>
              {externas.map((r, i) => (
                <tr key={i}>
                  <td><FuenteChip fuente={r.fuente} /></td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--navy-500)', display: 'block' }}>{r.tabla}</span>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.nombre_archivo}</span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--gray-500)', fontStyle: 'italic' }}>{r.tabla_sql}</td>
                  <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{r.modulos}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.fecha_carga
                      ? <span style={{ color: 'var(--gray-700)' }}>{r.fecha_carga}</span>
                      : r.fuente === 'Monday API'
                        ? <span className="chip ok" style={{ fontSize: 10 }}>En vivo (API)</span>
                        : <span style={{ color: 'var(--error-400)', fontSize: 11 }}>Archivo no encontrado</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Cargas desde plataforma ── */}
      <section className="panel">
        <h2>Cargas desde Plataforma</h2>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
          Historial de archivos subidos manualmente por el equipo, incluyendo configuraciones.
        </p>
        {cargas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--gray-400)', fontStyle: 'italic', padding: '16px 0' }}>
            Aún no hay cargas registradas desde la plataforma.
          </p>
        ) : (
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fuente</th>
                  <th>Tabla SQL</th>
                  <th>Módulos que la usan</th>
                  <th>Archivo subido</th>
                  <th>Responsable</th>
                  <th>Fecha y hora</th>
                </tr>
              </thead>
              <tbody>
                {cargas.map(r => (
                  <tr key={r.id}>
                    <td><FuenteChip fuente={r.fuente} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--navy-500)', fontWeight: 600 }}>
                      {r.tabla}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      {TABLA_MODULOS[r.tabla] ?? <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.nombre_archivo ?? ''}>
                      {r.nombre_archivo ?? <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td>
                      {r.usuario
                        ? <span style={{ fontWeight: 600, color: 'var(--navy-400)' }}>{r.usuario}</span>
                        : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                      {r.fecha_carga?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CargaDatos() {
  const location      = useLocation()
  const [area, setArea] = useState<Area | null>(null)
  const [responsable, setResponsable] = useState(() => localStorage.getItem('carga_responsable') ?? '')

  useEffect(() => { setArea(null) }, [location.key])

  const saveResponsable = (val: string) => {
    setResponsable(val)
    localStorage.setItem('carga_responsable', val)
  }

  return (
    <>
      <PageHeader title="Carga de Datos" subtitle="Actualización de fuentes desde archivos del equipo" icon="⬆️" />

      <div className="page">
      <div style={{ maxWidth: 880 }}>

        {/* ── Menú ── */}
        {area === null && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {(['dab', 'dpo', 'registro'] as Area[]).map(id => {
              const { label, icon, description } = AREAS[id]
              const isRegistro = id === 'registro'
              return (
                <button key={id} onClick={() => setArea(id)}
                  style={{
                    flex: 1, background: '#fff',
                    border: '2px solid var(--gray-200)',
                    borderRadius: 16, padding: '28px 22px',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'border-color .15s, box-shadow .15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = isRegistro ? 'var(--gold-400)' : 'var(--navy-400)'
                    e.currentTarget.style.boxShadow   = '0 4px 16px rgba(13,36,92,.12)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--gray-200)'
                    e.currentTarget.style.boxShadow   = '0 1px 4px rgba(0,0,0,.06)'
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 4,
                    color: isRegistro ? 'var(--gold-500)' : 'var(--navy-500)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.4 }}>{description}</div>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Vista área ── */}
        {area !== null && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <button className="btn-ghost" onClick={() => setArea(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                ← Volver
              </button>
              <span style={{ fontSize: 18 }}>{AREAS[area].icon}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-500)' }}>{AREAS[area].label}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>— {AREAS[area].description}</span>
            </div>

            {area === 'dab' && (
              <>
                <ResponsableBar value={responsable} onChange={saveResponsable} />
                <div className="grid grid-cols-1 gap-4">
                  <UploadCard
                    title="Registro de Incidencias"
                    subtitle='Archivo Excel de Reportabilidad Contratos. Carga la hoja "Registro incidencias".'
                    accept=".xlsx,.xls" acceptLabel="Solo archivos .xlsx / .xls" icon="⚠️"
                    onUpload={file => uploadIncidencias(file, responsable)}
                  />
                </div>
              </>
            )}

            {area === 'dpo' && (
              <>
                <ConfigDPO responsable={responsable} />
                <div style={{ height: 20 }} />
                <ResponsableBar value={responsable} onChange={saveResponsable} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UploadCard
                    title="Proyecciones P&C"
                    subtitle="Archivo .parquet exportado por el equipo de P&C. Reemplaza la tabla dbo.proyecciones."
                    accept=".parquet" acceptLabel="Solo archivos .parquet" icon="📈"
                    onUpload={file => uploadProyeccionesPyC(file, responsable)}
                  />
                  <UploadCard
                    title="Tablas de Dimensiones"
                    subtitle="Archivo Excel con hojas Tabla_Articulos, Tabla_Proyectos y Tabla_Programas."
                    accept=".xlsx,.xls" acceptLabel="Solo archivos .xlsx / .xls" icon="📋"
                    onUpload={file => uploadDimensiones(file, responsable)}
                  />
                  <CostoMetroCard onUpload={file => uploadCostoMetro(file, responsable)} />
                </div>
              </>
            )}

            {area === 'registro' && <RegistroView />}
          </>
        )}

      </div>
      </div>
    </>
  )
}
