import { useEffect, useRef, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { uploadProyeccionesPyC, getPycTimeline } from '../api/client'

const api   = axios.create({ baseURL: '/api' })
const mmclp = (v: number) => `$${(v / 1e9).toFixed(2)} MM`
const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

// ── timeline helpers ──────────────────────────────────────────────────────────

const MESES_ABR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fmtMes = (m: string) => {
  const [y, mo] = m.split('-')
  return `${MESES_ABR[parseInt(mo) - 1]}-${y.slice(2)}`
}
const fmtMM = (v: number): string => {
  if (!v || !isFinite(v)) return '—'
  const abs = Math.abs(v), s = v < 0 ? '−' : ''
  if (abs >= 1e9) return `${s}$${(abs / 1e9).toFixed(1)}MM`
  if (abs >= 1e6) return `${s}$${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${s}$${(abs / 1e3).toFixed(0)}K`
  return `${s}$${abs.toFixed(0)}`
}

const TL_STICKY = [
  { label: 'Contrato',      left: 0,   minW: 185 },
  { label: 'Total futuro',  left: 185, minW: 90  },
]

// mi: column index, ultimoEpIdx: global last-EP column index
function cellBgPyC(mi: number, ultimoEpIdx: number): React.CSSProperties {
  if (mi === ultimoEpIdx) return { background: '#bfdbfe', color: '#1e40af', borderLeft: '2px solid #93c5fd' }
  if (mi < ultimoEpIdx)  return { background: '#fefce8', color: '#92400e' }  // amarillo — pasado con EP
  return { background: '#f3f4f6', color: '#6b7280' }                          // gris — proyectado
}

// ── upload zone ───────────────────────────────────────────────────────────────

type Status = { disponible: boolean; mensaje?: string; ultima_carga?: string; periodo_max?: string }

function UploadZone({ onSuccess }: { onSuccess: () => void }) {
  const inputRef                  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [result,    setResult]    = useState<any>(null)
  const [error,     setError]     = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.parquet')) { setError('El archivo debe ser .parquet'); return }
    setUploading(true); setError(null); setResult(null)
    try {
      const res = await uploadProyeccionesPyC(file)
      setResult(res); onSuccess()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al cargar el archivo')
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
      >
        <input ref={inputRef} type="file" accept=".parquet" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {uploading ? (
          <div className="space-y-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-blue-600 font-medium">Procesando y cargando en SQL Server...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl">📂</p>
            <p className="text-sm font-semibold text-gray-700">Arrastrá el archivo .parquet o hacé clic para seleccionarlo</p>
            <p className="text-xs text-gray-400">Solo archivos .parquet exportados desde P&C</p>
          </div>
        )}
      </div>
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
          <p className="font-semibold">Carga exitosa</p>
          <p>{result.filas_insertadas?.toLocaleString('es-CL')} filas insertadas · {result.contratos} contratos</p>
          {result.periodos?.length > 0 && (
            <p className="text-xs text-green-600">Períodos: {result.periodos[0]} → {result.periodos.at(-1)}</p>
          )}
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
    </div>
  )
}

// ── página ────────────────────────────────────────────────────────────────────

export default function Proyecciones() {
  const [status,        setStatus]        = useState<Status | null>(null)
  const [kpis,          setKpis]          = useState<any>(null)
  const [porMes,        setPorMes]        = useState<any[]>([])
  const [tabla,         setTabla]         = useState<any[]>([])
  const [timeline,      setTimeline]      = useState<any>(null)
  const [tlLoading,     setTlLoading]     = useState(true)
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroTipo,    setFiltroTipo]    = useState('')
  const [showUpload,    setShowUpload]    = useState(false)

  const reload = () => {
    api.get('/proyecciones/status').then(r => {
      setStatus(r.data)
      if (r.data.disponible) {
        api.get('/proyecciones/kpis').then(r2 => setKpis(r2.data))
        api.get('/proyecciones/por-mes').then(r2 => setPorMes(r2.data))
        setTlLoading(true)
        getPycTimeline({ limite: 20 })
          .then(setTimeline)
          .catch(() => setTimeline(null))
          .finally(() => setTlLoading(false))
      }
    })
  }

  useEffect(() => { reload() }, [])

  useEffect(() => {
    if (!status?.disponible) return
    const params: any = {}
    if (filtroPeriodo) params.periodo_desde = filtroPeriodo
    if (filtroTipo)    params.tipo = filtroTipo
    api.get('/proyecciones/tabla', { params }).then(r => setTabla(r.data))
  }, [status, filtroPeriodo, filtroTipo])

  if (!status) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  if (!status.disponible) {
    return (
      <div>
        <PageHeader title="Proyecciones P&C" subtitle="Cargá el archivo .parquet para ver los datos" icon="📈" />
        <div className="m-6 max-w-lg">
          <p className="text-sm text-gray-500 mb-4">Sin datos cargados aún. Subí el archivo .parquet exportado por el equipo de P&C.</p>
          <UploadZone onSuccess={() => { setTimeout(reload, 500) }} />
        </div>
      </div>
    )
  }

  const periodos  = [...new Set(porMes.map((r: any) => r.periodo))].sort()
  const chartData = periodos.map(p => {
    const pyc = porMes.find((r: any) => r.periodo === p && r.tipo_proyeccion === 'P&C')?.monto ?? 0
    const adc = porMes.find((r: any) => r.periodo === p && r.tipo_proyeccion === 'AdC')?.monto ?? 0
    return { periodo: p, 'P&C': pyc, AdC: adc, Total: pyc + adc }
  })

  // Índice del último EP para una fila (maneja cuando está fuera del rango visible)
  const getUltimoEpIdx = (ultimoEp: string | null, meses: string[]): number => {
    if (!ultimoEp) return -1
    const idx = meses.indexOf(ultimoEp)
    if (idx >= 0) return idx
    // Si está después del último mes visible → todo amarillo
    if (ultimoEp > meses[meses.length - 1]) return meses.length
    // Si está antes del primer mes visible → todo gris
    return -1
  }

  const tlUltimoEpIdxGlobal = timeline
    ? getUltimoEpIdx(timeline.ultimo_ep ?? null, timeline.meses)
    : -1

  return (
    <div>
      <PageHeader
        title="Proyecciones P&C"
        subtitle={`Última carga: ${kpis?.ultima_carga?.split('T')[0] ?? '—'} · hasta ${kpis?.periodo_max ?? '—'}`}
        icon="📈"
      />

      {showUpload && (
        <div className="mx-4 mb-2 max-w-lg">
          <UploadZone onSuccess={() => { setTimeout(() => { reload(); setShowUpload(false) }, 500) }} />
        </div>
      )}

      <div className="px-4 pb-2 flex justify-end">
        <button
          onClick={() => setShowUpload(v => !v)}
          className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg px-3 py-1.5 transition-colors"
        >
          {showUpload ? 'Cancelar' : 'Actualizar datos'}
        </button>
      </div>

      {/* ── Timeline de Proyecciones ─────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="panel" style={{ padding: 0 }}>

          {/* Cabecera */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--gray-200)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-500)' }}>
              Proyección mensual por contrato (Top 20)
            </span>
            {timeline && (
              <span style={{ fontSize: 11, color: '#9aa1b3' }}>
                {timeline.contratos.length} contratos · ordenados por monto futuro
              </span>
            )}

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
              {[
                { bg: '#fefce8', bd: '#fde68a', label: 'Con EP'      },
                { bg: '#bfdbfe', bd: '#93c5fd', label: 'Último EP'   },
                { bg: '#f3f4f6', bd: '#e5e7eb', label: 'Proyectado'  },
              ].map(({ bg, bd, label }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#9aa1b3' }}>
                  <span style={{ width: 11, height: 11, background: bg, border: `1px solid ${bd}`, borderRadius: 2, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Cuerpo */}
          {tlLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              Calculando proyección…
            </div>
          ) : timeline ? (
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 400 }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead>
                  <tr>
                    {/* Columnas fijas */}
                    {TL_STICKY.map((col, ci) => (
                      <th key={col.label} style={{
                        position: 'sticky', top: 0, left: col.left, zIndex: 5,
                        minWidth: col.minW, padding: '7px 8px',
                        background: '#f9fafb', whiteSpace: 'nowrap',
                        borderBottom: '2px solid var(--gray-200)',
                        textAlign: ci === 1 ? 'right' : 'left',
                        boxShadow: ci === TL_STICKY.length - 1 ? '3px 0 6px rgba(0,0,0,.07)' : undefined,
                      }}>
                        {col.label}
                      </th>
                    ))}

                    {/* Columnas de meses */}
                    {timeline.meses.map((m: string) => (
                      <th key={m} style={{
                        position: 'sticky', top: 0, zIndex: 3,
                        minWidth: 63, padding: '7px 4px',
                        textAlign: 'center',
                        background:  m === timeline.mes_actual ? '#bfdbfe' : '#f9fafb',
                        color:       m === timeline.mes_actual ? '#1e40af' : '#9aa1b3',
                        fontWeight:  m === timeline.mes_actual ? 700 : 400,
                        borderBottom: '2px solid var(--gray-200)',
                        borderLeft:  m === timeline.mes_actual ? '2px solid #93c5fd' : undefined,
                        whiteSpace: 'nowrap',
                      }}>
                        {fmtMes(m)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {timeline.contratos.map((ctt: any) => {
                    const bd = '1px solid #f0f0f0'
                    const saldos = ctt.saldos as number[]
                    const ultimoEpIdx = getUltimoEpIdx(ctt.ultimo_ep ?? null, timeline.meses)
                    return (
                      <tr key={ctt.contrato}>
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          background: '#fff', padding: '5px 8px',
                          maxWidth: 185, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', borderBottom: bd,
                          fontWeight: 600, fontSize: 10,
                        }} title={ctt.contrato}>
                          {ctt.contrato}
                        </td>
                        <td style={{
                          position: 'sticky', left: 185, zIndex: 2,
                          background: '#fff', padding: '5px 8px',
                          textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700, color: 'var(--navy-500)',
                          boxShadow: '3px 0 6px rgba(0,0,0,.07)',
                          borderBottom: bd,
                        }}>
                          {fmtMM(ctt.total_futuro)}
                        </td>
                        {timeline.meses.map((m: string, mi: number) => {
                          const v = saldos[mi]
                          const cs = cellBgPyC(mi, ultimoEpIdx)
                          return (
                            <td key={m} style={{
                              minWidth: 63, padding: '5px 5px',
                              textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                              fontSize: 10, borderBottom: bd,
                              ...cs,
                            }}
                              title={v > 0 ? `${ctt.contrato} · ${m}: ${clp(v)}` : undefined}
                            >
                              {v > 0 ? fmtMM(v) : ''}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}

                  {/* Fila de totales */}
                  {timeline.totales_mes && (() => {
                    const tots = timeline.totales_mes as number[]
                    const totalFuturo = tots.slice(timeline.mes_actual_idx).reduce((a: number, b: number) => a + b, 0)
                    return (
                      <tr style={{ borderTop: '2px solid var(--gray-200)', background: '#f9fafb' }}>
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          background: '#f9fafb', padding: '5px 8px',
                          fontWeight: 700, fontSize: 10, color: 'var(--navy-500)',
                          whiteSpace: 'nowrap',
                        }}>
                          Total general
                        </td>
                        <td style={{
                          position: 'sticky', left: 185, zIndex: 2,
                          background: '#f9fafb', padding: '5px 8px',
                          textAlign: 'right', fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums', color: 'var(--navy-500)',
                          boxShadow: '3px 0 6px rgba(0,0,0,.07)',
                        }}>
                          {fmtMM(totalFuturo)}
                        </td>
                        {timeline.meses.map((m: string, mi: number) => {
                          const v = tots[mi] ?? 0
                          const cs = cellBgPyC(mi, tlUltimoEpIdxGlobal)
                          return (
                            <td key={m} style={{
                              minWidth: 63, padding: '5px 5px',
                              textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                              fontSize: 10, fontWeight: 600,
                              ...cs,
                            }}>
                              {v > 0 ? fmtMM(v) : ''}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>
              No se pudo cargar la proyección.
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
          <KpiCard label="Total Proyectado"          value={mmclp(kpis.total_proyectado)}       color="blue"   icon="🔮" />
          <KpiCard label="Proyección P&C"            value={mmclp(kpis.total_pyc)}              color="blue"   icon="📊" />
          <KpiCard label="Proyección AdC"            value={mmclp(kpis.total_adc)}              color="orange" icon="📉" />
          <KpiCard label="Contratos con proyección"  value={kpis.contratos_con_proyeccion}      color="green"  icon="📄" />
        </div>
      )}

      {/* ── Gráfico mensual ───────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Proyección mensual P&C vs AdC (MM CLP)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="periodo" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v / 1e9).toFixed(0)}MM`} tick={{ fontSize: 10, fill: '#6b7280' }} width={62} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [clp(Number(v)), '']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="P&C" fill="#1e40af" stackId="a" />
              <Bar dataKey="AdC" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Total" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabla de detalle ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-gray-700">Detalle por contrato</span>
            <div className="flex gap-2 ml-auto">
              <input
                type="month" value={filtroPeriodo}
                onChange={e => setFiltroPeriodo(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
              />
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
              >
                <option value="">P&C + AdC</option>
                <option value="P&C">Solo P&C</option>
                <option value="AdC">Solo AdC</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">Contrato</th>
                  <th className="px-3 py-2.5 text-left">Proyecto</th>
                  <th className="px-3 py-2.5 text-left">Período</th>
                  <th className="px-3 py-2.5 text-right">Monto Proyectado</th>
                  <th className="px-3 py-2.5 text-left">Moneda</th>
                  <th className="px-3 py-2.5 text-center">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {tabla.slice(0, 200).map((r: any, i: number) => (
                  <tr key={i}
                    className={`border-t border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-gray-700">{r.contrato}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate text-gray-600" title={r.proyecto}>{r.proyecto || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.periodo}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {r.monto_proyectado != null ? clp(r.monto_proyectado) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.moneda}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.tipo_proyeccion === 'AdC' ? 'bg-blue-100 text-blue-700' : 'bg-slate-700 text-white'
                      }`}>
                        {r.tipo_proyeccion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tabla.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos para el filtro seleccionado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
