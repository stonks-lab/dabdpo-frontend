import { useRef, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { uploadProyeccionesPyC, uploadDimensiones, uploadIncidencias } from '../api/client'

type UploadState = { status: 'idle' | 'loading' | 'ok' | 'error'; message?: string; detail?: any }

function UploadCard({
  title,
  subtitle,
  accept,
  acceptLabel,
  icon,
  onUpload,
}: {
  title: string
  subtitle: string
  accept: string
  acceptLabel: string
  icon: string
  onUpload: (file: File) => Promise<any>
}) {
  const inputRef             = useRef<HTMLInputElement>(null)
  const [state, setState]    = useState<UploadState>({ status: 'idle' })

  const handle = async (file: File) => {
    setState({ status: 'loading' })
    try {
      const res = await onUpload(file)
      setState({ status: 'ok', detail: res })
    } catch (e: any) {
      setState({ status: 'error', message: e?.response?.data?.detail ?? 'Error inesperado' })
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => state.status !== 'loading' && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            state.status === 'loading'
              ? 'border-blue-200 bg-blue-50/40 cursor-default'
              : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
          }`}
        >
          <input
            ref={inputRef} type="file" accept={accept} className="hidden"
            onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
          />
          {state.status === 'loading' ? (
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

        {state.status === 'ok' && <ResultOk detail={state.detail} />}
        {state.status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {state.message}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultOk({ detail }: { detail: any }) {
  if (!detail) return null

  // Proyecciones result
  if ('filas_insertadas' in detail) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold text-green-800">Carga exitosa</p>
        <p className="text-sm text-green-700">
          {detail.filas_insertadas?.toLocaleString('es-CL')} filas · {detail.contratos} contratos
        </p>
        {detail.periodos?.length > 0 && (
          <p className="text-xs text-green-600">
            Períodos: {detail.periodos[0]} → {detail.periodos.at(-1)}
          </p>
        )}
      </div>
    )
  }

  // Dimensiones result
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

export default function CargaDatos() {
  return (
    <div>
      <PageHeader
        title="Carga de Datos"
        subtitle="Actualización de fuentes desde archivos del equipo"
        icon="⬆️"
      />

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <UploadCard
          title="Proyecciones P&C"
          subtitle="Archivo .parquet exportado por el equipo de P&C. Reemplaza la tabla dbo.proyecciones."
          accept=".parquet"
          acceptLabel="Solo archivos .parquet"
          icon="📈"
          onUpload={uploadProyeccionesPyC}
        />

        <UploadCard
          title="Tablas de Dimensiones"
          subtitle="Archivo Excel con hojas Tabla_Articulos, Tabla_Proyectos y Tabla_Programas."
          accept=".xlsx,.xls"
          acceptLabel="Solo archivos .xlsx / .xls"
          icon="📐"
          onUpload={uploadDimensiones}
        />

        <UploadCard
          title="Registro de Incidencias"
          subtitle='Archivo Excel de Reportabilidad Contratos. Carga la hoja "Registro incidencias".'
          accept=".xlsx,.xls"
          acceptLabel="Solo archivos .xlsx / .xls"
          icon="⚠️"
          onUpload={uploadIncidencias}
        />
      </div>
    </div>
  )
}
