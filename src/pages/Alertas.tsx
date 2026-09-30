import { useEffect, useState } from 'react'
import { getAlertasKpis, getAlertasContratos, getAlertasBoletas } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const ALERTA_STYLE: Record<string, string> = {
  NEGATIVO:    'bg-red-100 text-red-800',
  CRÍTICO:     'bg-red-50 text-red-700',
  ADVERTENCIA: 'bg-amber-50 text-amber-700',
  ATENCIÓN:    'bg-yellow-50 text-yellow-700',
  VENCIDA:     'bg-purple-100 text-purple-800',
  OK:          'bg-emerald-50 text-emerald-700',
}

const mmclp = (v: number) => `$${(v / 1e9).toFixed(2)} MM`

export default function Alertas() {
  const [kpis,     setKpis]     = useState<any>(null)
  const [contratos,setContratos]= useState<any[]>([])
  const [boletas,  setBoletas]  = useState<any[]>([])

  useEffect(() => {
    getAlertasKpis().then(setKpis)
    getAlertasContratos().then(setContratos)
    getAlertasBoletas().then(setBoletas)
  }, [])

  if (!kpis) return <div className="p-6 text-gray-400 text-sm">Cargando...</div>

  const total = kpis.contratos_negativos + kpis.contratos_criticos + kpis.contratos_advertencia

  return (
    <div>
      <PageHeader
        title="Alertas"
        subtitle="Contratos críticos y boletas de garantía por vencer"
        icon="🚨"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        <KpiCard label="Total alertas"       value={total}                      color={total > 0 ? 'red' : 'green'}    icon="⚡" />
        <KpiCard label="Sin saldo / negativo" value={kpis.contratos_negativos}  color="red"                            icon="🔴" />
        <KpiCard label="Críticos (<10%)"     value={kpis.contratos_criticos}    color="red"                            icon="🔺" />
        <KpiCard label="En advertencia"      value={kpis.contratos_advertencia} color="yellow"                         icon="⚠️" />
        <KpiCard label="Boletas críticas"    value={kpis.boletas_criticas}      color={kpis.boletas_criticas > 0 ? 'orange' : 'green'} icon="🏷️" sub="≤30 días para vencer" />
      </div>

      {/* Contratos en alerta */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <h2 className="text-sm font-semibold text-gray-700">
              Contratos en Alerta
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">
                {contratos.length}
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left">Contrato</th>
                  <th className="px-3 py-2.5 text-left">Descripción</th>
                  <th className="px-3 py-2.5 text-left">Área</th>
                  <th className="px-3 py-2.5 text-left">Tipo</th>
                  <th className="px-3 py-2.5 text-center">Estado Cto</th>
                  <th className="px-3 py-2.5 text-right">Presupuesto</th>
                  <th className="px-3 py-2.5 text-right">EP Consumido</th>
                  <th className="px-3 py-2.5 text-right">Saldo</th>
                  <th className="px-3 py-2.5 text-right">% Saldo</th>
                  <th className="px-3 py-2.5 text-center">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c: any, i: number) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-50 hover:bg-red-50/20 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-gray-700">{c.codigo_ctt}</td>
                    <td className="px-3 py-2 max-w-[170px] truncate text-gray-600" title={c.Descripcion_ctt}>
                      {c.Descripcion_ctt}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{c.Area_contrato}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[90px] truncate" title={c.Tipo_contrato}>
                      {c.Tipo_contrato}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        c.Estado_ctt === 'Vigente' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {c.Estado_ctt}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{mmclp(c.Presupuesto_CLP)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{mmclp(c.EP_Consumido_CLP)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${c.Saldo_CLP < 0 ? 'text-red-600' : ''}`}>
                      {mmclp(c.Saldo_CLP)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{(c.Pct_Saldo * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ALERTA_STYLE[c.Estado_Saldo] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.Estado_Saldo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contratos.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Sin contratos en alerta</p>
            )}
          </div>
        </div>
      </div>

      {/* Boletas en alerta */}
      {boletas.length > 0 && (
        <div className="px-4 pb-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-700">
                Boletas de Garantía en Alerta
                <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
                  {boletas.length}
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-gray-500 uppercase text-[10px] tracking-wide">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Contrato</th>
                    <th className="px-3 py-2.5 text-left">Nro Boleta</th>
                    <th className="px-3 py-2.5 text-left">Servicio</th>
                    <th className="px-3 py-2.5 text-left">Proveedor</th>
                    <th className="px-3 py-2.5 text-right">Monto</th>
                    <th className="px-3 py-2.5 text-left">Moneda</th>
                    <th className="px-3 py-2.5 text-left">Vencimiento</th>
                    <th className="px-3 py-2.5 text-right">Días</th>
                    <th className="px-3 py-2.5 text-center">Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {boletas.map((b: any, i: number) => (
                    <tr
                      key={i}
                      className={`border-t border-slate-50 hover:bg-orange-50/20 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-gray-700">{b.Contrato}</td>
                      <td className="px-3 py-2 text-gray-600">{b['Nro Boleta']}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate text-gray-600" title={b.Servicio}>{b.Servicio}</td>
                      <td className="px-3 py-2 max-w-[130px] truncate text-gray-600" title={b.Proveedor}>{b.Proveedor}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.Monto?.toLocaleString('es-CL')}</td>
                      <td className="px-3 py-2 text-gray-500">{b.Moneda}</td>
                      <td className="px-3 py-2">{b.Fecha_Vencimiento}</td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${(b.Dias_Para_Vencer ?? 999) < 31 ? 'text-red-600' : ''}`}>
                        {b.Dias_Para_Vencer}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ALERTA_STYLE[b.Alerta_Vencimiento] ?? 'bg-gray-100 text-gray-500'}`}>
                          {b.Alerta_Vencimiento}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
