import { useCallback, useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts'
import { getDpoCostoMetro, deleteDpoCostoMetroMes } from '../api/client'
import PageHeader from '../components/PageHeader'

const usd = (v: number) => `${v.toFixed(2)} US$/m`
const pct = (v: number) => `${(v * 100).toFixed(2)}%`

const MES_ABREV: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
}

interface RowCM {
  anio: number; mes: number; mes_nombre: string
  costo_metro_programado: number
  costo_metro_real: number
  costo_metro_ajustado: number
  brecha: number
  fecha_carga: string
}
interface Config {
  meta_costo_metro: number | null
  meta_tolerancia_brecha: number | null
}

function MetricCard({ label, value, valueColor, meta, metaLabel, sub }: {
  label: string; value: string; valueColor: string
  meta?: string | null; metaLabel?: string; sub?: string
}) {
  return (
    <div className="panel" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: valueColor, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>{sub}</div>}
      {meta !== undefined && (
        <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
            {metaLabel ?? 'Meta'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-400)' }}>
            {meta ?? <span style={{ color: 'var(--gray-300)' }}>Sin configurar</span>}
          </span>
        </div>
      )}
    </div>
  )
}

export default function DashboardDPO() {
  const [dpo,           setDpo]           = useState<{ historico: RowCM[]; ultimo: RowCM | null; config: Config } | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ anio: number; mes: number } | null>(null)
  const [deleting,      setDeleting]      = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getDpoCostoMetro()
      .then(setDpo)
      .catch(() => setError('No se pudo cargar la data de Costo Metro.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const doDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deleteDpoCostoMetroMes(confirmDelete.anio, confirmDelete.mes)
      setConfirmDelete(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="loading">Cargando Dashboard DPO...</div>
  if (error)   return <><PageHeader title="Dashboard DPO" icon="📐" /><div className="page"><div className="alert-banner">{error}</div></div></>

  const historico = dpo?.historico ?? []
  const ultimo    = dpo?.ultimo    ?? null
  const config    = dpo?.config    ?? { meta_costo_metro: null, meta_tolerancia_brecha: null }

  const serieLine = historico.map(r => ({
    label:    `${MES_ABREV[r.mes]} ${r.anio}`,
    real:     r.costo_metro_real,
    ajustado: r.costo_metro_ajustado,
  }))

  const serieBars = historico.map(r => ({
    label:      MES_ABREV[r.mes],
    programado: r.costo_metro_programado,
    ajustado:   r.costo_metro_ajustado,
  }))

  const realColor = () => {
    if (!ultimo) return 'var(--gray-400)'
    if (!config.meta_costo_metro) return 'var(--navy-500)'
    return ultimo.costo_metro_ajustado <= config.meta_costo_metro
      ? 'var(--success-500)' : 'var(--error-500)'
  }

  const brechaColor = () => {
    if (!ultimo) return 'var(--gray-400)'
    const tol = config.meta_tolerancia_brecha ?? 0.05
    const b   = Math.abs(ultimo.brecha)
    return b <= tol ? 'var(--success-500)' : b <= tol * 1.5 ? 'var(--warning-500)' : 'var(--error-500)'
  }

  const confirmRow = confirmDelete
    ? historico.find(r => r.anio === confirmDelete.anio && r.mes === confirmDelete.mes)
    : null

  return (
    <>
      <PageHeader
        title="Dashboard DPO — Costo Metro"
        subtitle={`EMSA · ${historico.length} mes${historico.length !== 1 ? 'es' : ''} cargado${historico.length !== 1 ? 's' : ''}`}
        icon="📐"
      />

      {historico.length === 0 ? (
        <div className="page">
          <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📂</p>
            <p style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>Sin datos cargados</p>
            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>
              Ve a <strong>Carga de Datos → P&C → Costo Metro</strong> y sube el archivo del mes.
            </p>
          </div>
        </div>
      ) : (
        <div className="page">

          {/* ── KPI cards ── */}
          {ultimo && (
            <div style={{ display: 'flex', gap: 16 }}>
              <MetricCard
                label="Costo Metro Ajustado"
                value={usd(ultimo.costo_metro_ajustado)}
                valueColor={realColor()}
                sub={`Real/Proy: ${usd(ultimo.costo_metro_real)} · ${ultimo.mes_nombre} ${ultimo.anio}`}
                meta={config.meta_costo_metro != null ? `${config.meta_costo_metro.toFixed(2)} US$/m` : null}
                metaLabel="Meta"
              />
              <MetricCard
                label="Costo Metro Programado"
                value={usd(ultimo.costo_metro_programado)}
                valueColor="var(--navy-400)"
                sub={`${ultimo.mes_nombre} ${ultimo.anio}`}
              />
              <MetricCard
                label="Brecha"
                value={pct(ultimo.brecha)}
                valueColor={brechaColor()}
                sub={ultimo.brecha < 0 ? 'Por debajo del programa ✓' : 'Por encima del programa'}
                meta={config.meta_tolerancia_brecha != null ? `±${pct(config.meta_tolerancia_brecha)}` : null}
                metaLabel="Tolerancia"
              />
            </div>
          )}

          {/* ── Bar chart: Programado vs Ajustado ── */}
          <section className="panel">
            <h2>Programado vs Ajustado por Mes (US$/m)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={serieBars} margin={{ top: 8, right: 24, left: 8, bottom: 4 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--gray-400)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--gray-400)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v.toFixed(0)}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                  formatter={(v) => [`${Number(v).toFixed(2)} US$/m`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {config.meta_costo_metro != null && (
                  <ReferenceLine
                    y={config.meta_costo_metro}
                    stroke="var(--error-500)" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `Meta: ${config.meta_costo_metro.toFixed(0)}`, position: 'right',
                             style: { fontSize: 10, fill: 'var(--error-500)' } }}
                  />
                )}
                <Bar dataKey="programado" name="Programado" fill="var(--navy-300)" radius={[3,3,0,0]} maxBarSize={40} />
                <Bar dataKey="ajustado"   name="Ajustado"   fill="var(--gold-500)"  radius={[3,3,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* ── Line chart: evolución ── */}
          <section className="panel">
            <h2>Evolución Costo Metro (US$/m)</h2>
            <p className="subtitle">
              <span style={{ color: 'var(--navy-400)', fontWeight: 700 }}>— Real/Proy</span>
              {'  '}
              <span style={{ color: 'var(--gold-500)', fontWeight: 700 }}>— Ajustado</span>
              {config.meta_costo_metro != null && (
                <>{'  '}<span style={{ color: 'var(--error-500)', fontWeight: 700 }}>- - Meta</span></>
              )}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={serieLine} margin={{ top: 12, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--gray-400)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--gray-400)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v.toFixed(0)}
                  label={{ value: 'US$/m', angle: -90, position: 'insideLeft', offset: 14,
                           style: { fontSize: 10, fill: 'var(--gray-400)' } }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}
                  formatter={(v) => [`${Number(v).toFixed(2)} US$/m`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {config.meta_costo_metro != null && (
                  <ReferenceLine
                    y={config.meta_costo_metro}
                    stroke="var(--error-500)" strokeDasharray="5 3" strokeWidth={1.5}
                    label={{ value: `Meta: ${config.meta_costo_metro.toFixed(0)}`, position: 'right',
                             style: { fontSize: 10, fill: 'var(--error-500)' } }}
                  />
                )}
                <Line
                  type="monotone" dataKey="real" name="Real/Proy"
                  stroke="var(--navy-400)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--navy-400)', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone" dataKey="ajustado" name="Ajustado"
                  stroke="var(--gold-500)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--gold-500)', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          {/* ── Tabla histórica ── */}
          <section className="panel">
            <h2>Histórico Mensual</h2>
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Año</th>
                    <th style={{ textAlign: 'right' }}>Programado</th>
                    <th style={{ textAlign: 'right' }}>Real/Proy</th>
                    <th style={{ textAlign: 'right' }}>Ajustado</th>
                    <th style={{ textAlign: 'center' }}>Brecha</th>
                    {config.meta_costo_metro != null && <th style={{ textAlign: 'center' }}>vs Meta</th>}
                    <th>Carga</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {[...historico].reverse().map(r => {
                    const dentroMeta = config.meta_costo_metro != null && r.costo_metro_ajustado <= config.meta_costo_metro
                    const bOk        = config.meta_tolerancia_brecha == null || Math.abs(r.brecha) <= config.meta_tolerancia_brecha
                    return (
                      <tr key={`${r.anio}-${r.mes}`}>
                        <td style={{ fontWeight: 600, color: 'var(--navy-500)' }}>{r.mes_nombre}</td>
                        <td>{r.anio}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{usd(r.costo_metro_programado)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--navy-400)', fontWeight: 600 }}>{usd(r.costo_metro_real)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700,
                          color: r.costo_metro_ajustado > r.costo_metro_programado ? 'var(--error-500)' : 'var(--success-500)' }}>
                          {usd(r.costo_metro_ajustado)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`chip ${bOk ? 'ok' : Math.abs(r.brecha) <= (config.meta_tolerancia_brecha ?? 0.05) * 1.5 ? 'warn' : 'danger'}`}>
                            {pct(r.brecha)}
                          </span>
                        </td>
                        {config.meta_costo_metro != null && (
                          <td style={{ textAlign: 'center' }}>
                            <span className={`chip ${dentroMeta ? 'ok' : 'danger'}`}>
                              {dentroMeta ? 'Dentro' : 'Sobre meta'}
                            </span>
                          </td>
                        )}
                        <td style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.fecha_carga?.slice(0, 10) ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setConfirmDelete({ anio: r.anio, mes: r.mes })}
                            title={`Eliminar ${r.mes_nombre} ${r.anio}`}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, opacity: .4, padding: '2px 4px', lineHeight: 1,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '.4')}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

      {/* ── Modal confirmación eliminar ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div className="panel" style={{ width: 360, margin: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <h2 style={{ marginBottom: 12 }}>Eliminar mes</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 20 }}>
              ¿Eliminar{' '}
              <strong style={{ color: 'var(--navy-500)' }}>
                {confirmRow?.mes_nombre} {confirmDelete.anio}
              </strong>{' '}
              de la tabla? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={doDelete}
                disabled={deleting}
                style={{ background: 'var(--error-500)', borderColor: 'var(--error-500)', opacity: deleting ? .6 : 1 }}
              >
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
