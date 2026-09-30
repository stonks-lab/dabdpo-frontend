import { useEffect, useRef, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/KpiCard'
import { uploadProyeccionesPyC } from '../api/client'

const api   = axios.create({ baseURL: '/api' })
const mmclp = (v: number) => `$${(v / 1e9).toFixed(2)} MM`
const clp   = (v: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v)

type Status = { disponible: boolean; mensaje?: string; ultima_carga?: string; periodo_max?: string }

function UploadZone({ onSuccess }: { onSuccess: () => void }) {
  const inputRef                          = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]         = useState(false)
  const [result,    setResult]            = useState<any>(null)
  const [error,     setError]             = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.parquet')) {
      setError('El archivo debe ser .parquet')
      return
    }
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const res = await uploadProyeccionesPyC(file)
      setResult(res)
      onSuccess()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al cargar el archivo')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
      >
        <input
          ref={inputRef} type="file" accept=".parquet" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

export default function Proyecciones() {
  const [status, setStatus] = useState<Status | null>(null)
  const [kpis,   setKpis]   = useState<any>(null)
  const [porMes, setPorMes] = useState<any[]>([])
  const [tabla,  setTabla]  = useState<any[]>([])
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroTipo,    setFiltroTipo]    = useState('')
  const [showUpload,    setShowUpload]    = useState(false)

  const reload = () => {
    api.get('/proyecciones/status').then(r => {
      setStatus(r.data)
      if (r.data.disponible) {
        api.get('/proyecciones/kpis').then(r2 => setKpis(r2.data))
        api.get('/proyecciones/por-mes').then(r2 => setPorMes(r2.data))
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

  const periodos = [...new Set(porMes.map((r: any) => r.periodo))].sort()
  const chartData = periodos.map(p => {
    const pyc = porMes.find((r: any) => r.periodo === p && r.tipo_proyeccion === 'P&C')?.monto ?? 0
    const adc = porMes.find((r: any) => r.periodo === p && r.tipo_proyeccion === 'AdC')?.monto ?? 0
    return { periodo: p, 'P&C': pyc, AdC: adc, Total: pyc + adc }
  })

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

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <KpiCard label="Total Proyectado"          value={mmclp(kpis.total_proyectado)}       color="blue"   icon="🔮" />
          <KpiCard label="Proyección P&C"            value={mmclp(kpis.total_pyc)}              color="blue"   icon="📊" />
          <KpiCard label="Proyección AdC"            value={mmclp(kpis.total_adc)}              color="orange" icon="📉" />
          <KpiCard label="Contratos con proyección"  value={kpis.contratos_con_proyeccion}      color="green"  icon="📄" />
        </div>
      )}

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
              <Tooltip
                formatter={(v) => [clp(Number(v)), '']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="P&C" fill="#1e40af" stackId="a" />
              <Bar dataKey="AdC" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Total" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                  <tr
                    key={i}
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
