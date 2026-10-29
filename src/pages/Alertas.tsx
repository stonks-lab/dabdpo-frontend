import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  getAlertasKpis, getAlertasFiltros, getAlertasContratos, getAlertasBoletas,
} from '../api/client'
import PageHeader from '../components/PageHeader'

// ── helpers ──────────────────────────────────────────────────────────────────

const ALERTA_COLOR: Record<string, string> = {
  NEGATIVO:    '#f13a5c',
  CRÍTICO:     '#dc2626',
  ADVERTENCIA: '#f5a02b',
  ATENCIÓN:    '#fbbf24',
  VENCIDA:     '#7c3aed',
}

const ALERTA_CHIP: Record<string, string> = {
  NEGATIVO:    'danger',
  CRÍTICO:     'danger',
  ADVERTENCIA: 'warn',
  ATENCIÓN:    'warn',
  VENCIDA:     'navy',
  OK:          'ok',
}

const NIVEL_ORDER = ['NEGATIVO', 'CRÍTICO', 'ADVERTENCIA', 'ATENCIÓN', 'VENCIDA']

function mmclp(v: number) {
  const s = v < 0 ? '−' : ''
  const a = Math.abs(v)
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}MM`
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(0)}M`
  return `${s}$${a.toFixed(0)}`
}

type SortDir = 'asc' | 'desc'

function applySort<T>(rows: T[], col: string, dir: SortDir): T[] {
  if (!col) return rows
  return [...rows].sort((a, b) => {
    const av = (a as any)[col], bv = (b as any)[col]
    if (typeof av === 'number' && typeof bv === 'number')
      return dir === 'asc' ? av - bv : bv - av
    return dir === 'asc'
      ? String(av ?? '').localeCompare(String(bv ?? ''), 'es')
      : String(bv ?? '').localeCompare(String(av ?? ''), 'es')
  })
}

function boletaDiaColor(dias: number): string {
  if (dias <= 0)  return ALERTA_COLOR['VENCIDA']
  if (dias <= 15) return ALERTA_COLOR['CRÍTICO']
  if (dias <= 30) return ALERTA_COLOR['ADVERTENCIA']
  return ALERTA_COLOR['ATENCIÓN']
}

// ── component ────────────────────────────────────────────────────────────────

export default function Alertas() {
  const [kpis,      setKpis]      = useState<any>(null)
  const [contratos, setContratos] = useState<any[]>([])
  const [boletas,   setBoletas]   = useState<any[]>([])
  const [filtros,   setFiltros]   = useState<{ areas: string[]; tipos: string[] }>({ areas: [], tipos: [] })

  const [cOpen, setCOpen] = useState(false)
  const [bOpen, setBOpen] = useState(false)

  // contratos filters & sort
  const [cfArea,   setCfArea]   = useState('')
  const [cfTipo,   setCfTipo]   = useState('')
  const [cfEstado, setCfEstado] = useState('')
  const [cSort, setCSort] = useState('Pct_Saldo')
  const [cDir,  setCDir]  = useState<SortDir>('asc')

  // boletas filter & sort
  const [bfContrato, setBfContrato] = useState('')
  const [bfNivel,    setBfNivel]    = useState('')
  const [bSort, setBSort] = useState('Dias_Para_Vencer')
  const [bDir,  setBDir]  = useState<SortDir>('asc')

  useEffect(() => {
    Promise.all([
      getAlertasKpis(),
      getAlertasContratos(),
      getAlertasFiltros(),
    ]).then(([k, c, f]) => {
      setKpis(k)
      setContratos(c)
      setFiltros(f)
    })
    getAlertasBoletas().then(setBoletas).catch(() => {})
  }, [])

  // ── derived data ─────────────────────────────────────────────────────────

  const filteredContratos = useMemo(() => {
    let rows = contratos
    if (cfArea)   rows = rows.filter(r => r.Area_contrato === cfArea)
    if (cfTipo)   rows = rows.filter(r => r.Tipo_contrato === cfTipo)
    if (cfEstado) rows = rows.filter(r => r.Estado_Saldo  === cfEstado)
    return applySort(rows, cSort, cDir)
  }, [contratos, cfArea, cfTipo, cfEstado, cSort, cDir])

  const filteredBoletas = useMemo(() => {
    let rows = boletas
    if (bfNivel)    rows = rows.filter(r => r.Alerta_Vencimiento === bfNivel)
    if (bfContrato) rows = rows.filter(r =>
      (r.Contrato ?? '').toLowerCase().includes(bfContrato.toLowerCase())
    )
    return applySort(rows, bSort, bDir)
  }, [boletas, bfNivel, bfContrato, bSort, bDir])

  const contratosNivelChart = useMemo(() => {
    const counts: Record<string, number> = {}
    contratos.forEach(r => { const e = r.Estado_Saldo || ''; counts[e] = (counts[e] || 0) + 1 })
    return Object.entries(counts)
      .filter(([k]) => k !== 'OK')
      .map(([nivel, cantidad]) => ({ nivel, cantidad }))
      .sort((a, b) => NIVEL_ORDER.indexOf(a.nivel) - NIVEL_ORDER.indexOf(b.nivel))
  }, [contratos])

  const contratosAreaChart = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    contratos.forEach(r => {
      const area = r.Area_contrato || '—'
      if (!map[area]) map[area] = {}
      const e = r.Estado_Saldo || ''
      map[area][e] = (map[area][e] || 0) + 1
    })
    return Object.entries(map)
      .map(([area, c]) => ({ area, ...c }))
      .sort((a, b) => {
        const ta = ((a as any)['NEGATIVO'] || 0) + ((a as any)['CRÍTICO'] || 0) + ((a as any)['ADVERTENCIA'] || 0)
        const tb = ((b as any)['NEGATIVO'] || 0) + ((b as any)['CRÍTICO'] || 0) + ((b as any)['ADVERTENCIA'] || 0)
        return tb - ta
      })
  }, [contratos])

  const BOLETA_NIVEL_ORDER = ['VENCIDA', 'CRÍTICO', 'ADVERTENCIA', 'ATENCIÓN']

  const boletasNivelChart = useMemo(() => {
    const counts: Record<string, number> = {}
    boletas.forEach(r => { const e = r.Alerta_Vencimiento || ''; counts[e] = (counts[e] || 0) + 1 })
    return Object.entries(counts)
      .map(([nivel, cantidad]) => ({ nivel, cantidad }))
      .sort((a, b) => BOLETA_NIVEL_ORDER.indexOf(a.nivel) - BOLETA_NIVEL_ORDER.indexOf(b.nivel))
  }, [boletas])

  const boletasVencerChart = useMemo(() =>
    [...boletas]
      .sort((a, b) => (a.Dias_Para_Vencer ?? 999) - (b.Dias_Para_Vencer ?? 999))
      .slice(0, 14)
      .map(b => ({ label: b.Contrato, dias: b.Dias_Para_Vencer ?? 0 }))
  , [boletas])

  // ── sort toggle helpers ───────────────────────────────────────────────────

  function toggleCSort(c: string) {
    if (c === cSort) setCDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setCSort(c); setCDir('asc') }
  }
  function toggleBSort(c: string) {
    if (c === bSort) setBDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setBSort(c); setBDir('asc') }
  }
  const cArr = (c: string) => cSort === c ? (cDir === 'asc' ? ' ↑' : ' ↓') : ''
  const bArr = (c: string) => bSort === c ? (bDir === 'asc' ? ' ↑' : ' ↓') : ''

  // ── chart click handlers ──────────────────────────────────────────────────

  function onCNivelClick(d: any) { setCfEstado(prev => prev === d.nivel ? '' : d.nivel) }
  function onCAreaClick(d: any)  { setCfArea(prev => prev === d.activeLabel ? '' : d.activeLabel) }
  function onBNivelClick(d: any) { setBfNivel(prev => prev === d.nivel ? '' : d.nivel) }
  function onBContratoClick(d: any) { setBfContrato(prev => prev === d.label ? '' : d.label) }

  if (!kpis) return <div className="loading">Cargando alertas…</div>

  const total = kpis.contratos_negativos + kpis.contratos_criticos + kpis.contratos_advertencia

  return (
    <div className="main-content">
      <PageHeader
        title="Alertas"
        subtitle="Contratos críticos y boletas de garantía por vencer"
        icon="🚨"
      />

      <div className="page">

        {/* KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
          <div className="kpi-card" style={{ borderLeftColor: total > 0 ? 'var(--error-500)' : 'var(--success-500)' }}>
            <span>Total Alertas</span>
            <strong style={{ color: total > 0 ? 'var(--error-500)' : undefined }}>{total}</strong>
          </div>
          <div className="kpi-card" style={{ borderLeftColor: 'var(--error-500)' }}>
            <span>Sin Saldo / Negativo</span>
            <strong style={{ color: kpis.contratos_negativos > 0 ? 'var(--error-500)' : undefined }}>
              {kpis.contratos_negativos}
            </strong>
          </div>
          <div className="kpi-card" style={{ borderLeftColor: '#dc2626' }}>
            <span>Críticos (&lt;10%)</span>
            <strong style={{ color: kpis.contratos_criticos > 0 ? '#dc2626' : undefined }}>
              {kpis.contratos_criticos}
            </strong>
          </div>
          <div className="kpi-card" style={{ borderLeftColor: 'var(--warning-500)' }}>
            <span>En Advertencia</span>
            <strong>{kpis.contratos_advertencia}</strong>
          </div>
          <div className="kpi-card" style={{ borderLeftColor: kpis.boletas_criticas > 0 ? 'var(--warning-500)' : 'var(--success-500)' }}>
            <span>Boletas Críticas</span>
            <strong style={{ color: kpis.boletas_criticas > 0 ? 'var(--warning-500)' : undefined }}>
              {kpis.boletas_criticas}
            </strong>
            <small>≤30 días para vencer</small>
          </div>
        </div>

        {/* ── PANEL: CONTRATOS ── */}
        <div className="panel" style={{ padding: 0 }}>

          {/* Header colapsable */}
          <button
            onClick={() => setCOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 20px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--error-500)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>
              Contratos en Alerta
            </span>
            <span style={{
              background: 'var(--error-50)', color: 'var(--error-500)',
              borderRadius: 99, padding: '1px 8px', fontSize: 10, fontWeight: 700,
            }}>
              {contratos.length}
            </span>
            <svg
              style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform .2s', transform: cOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round"
            >
              <polyline points="5 3 10 7 5 11" />
            </svg>
          </button>

          {cOpen && (
            <>
              {/* Charts */}
              <div className="two-col" style={{ padding: '14px 20px 0' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Por Nivel de Alerta
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={contratosNivelChart} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }} style={{ cursor: 'pointer' }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="nivel" tick={{ fontSize: 11 }} width={95} />
                      <Tooltip formatter={(v: any) => [v, 'Contratos']} />
                      <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} onClick={onCNivelClick}>
                        {contratosNivelChart.map((e, i) => (
                          <Cell key={i}
                            fill={ALERTA_COLOR[e.nivel] ?? '#9aa1b3'}
                            opacity={cfEstado && cfEstado !== e.nivel ? 0.25 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Por Área (acumulado)
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={contratosAreaChart} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }} style={{ cursor: 'pointer' }} onClick={onCAreaClick}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="area" tick={{ fontSize: 10 }} width={95} />
                      <Tooltip />
                      <Bar dataKey="NEGATIVO"    stackId="a" fill={ALERTA_COLOR['NEGATIVO']}    name="Negativo">
                        {contratosAreaChart.map((e, i) => <Cell key={i} fill={ALERTA_COLOR['NEGATIVO']}    opacity={cfArea && cfArea !== e.area ? 0.25 : 1} />)}
                      </Bar>
                      <Bar dataKey="CRÍTICO"     stackId="a" fill={ALERTA_COLOR['CRÍTICO']}     name="Crítico">
                        {contratosAreaChart.map((e, i) => <Cell key={i} fill={ALERTA_COLOR['CRÍTICO']}     opacity={cfArea && cfArea !== e.area ? 0.25 : 1} />)}
                      </Bar>
                      <Bar dataKey="ADVERTENCIA" stackId="a" fill={ALERTA_COLOR['ADVERTENCIA']} name="Advertencia" radius={[0, 4, 4, 0]}>
                        {contratosAreaChart.map((e, i) => <Cell key={i} fill={ALERTA_COLOR['ADVERTENCIA']} opacity={cfArea && cfArea !== e.area ? 0.25 : 1} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Filter bar */}
              <div className="filters-bar" style={{ borderTop: '1px solid var(--gray-100)', marginTop: 14 }}>
                <div>
                  <label>Área</label>
                  <select value={cfArea} onChange={e => setCfArea(e.target.value)}>
                    <option value="">Todas</option>
                    {filtros.areas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label>Tipo</label>
                  <select value={cfTipo} onChange={e => setCfTipo(e.target.value)}>
                    <option value="">Todos</option>
                    {filtros.tipos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label>Nivel de Alerta</label>
                  <select value={cfEstado} onChange={e => setCfEstado(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="NEGATIVO">Negativo</option>
                    <option value="CRÍTICO">Crítico</option>
                    <option value="ADVERTENCIA">Advertencia</option>
                  </select>
                </div>
                {(cfArea || cfTipo || cfEstado) && (
                  <button className="btn-ghost" style={{ alignSelf: 'flex-end' }}
                    onClick={() => { setCfArea(''); setCfTipo(''); setCfEstado('') }}>
                    Limpiar
                  </button>
                )}
                <span style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 11, color: 'var(--gray-400)' }}>
                  {filteredContratos.length} contratos
                </span>
              </div>

              {/* Table */}
              <div className="scroll-x">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleCSort('codigo_ctt')}>
                        Contrato{cArr('codigo_ctt')}
                      </th>
                      <th style={{ cursor: 'pointer', minWidth: 160 }} onClick={() => toggleCSort('Descripcion_ctt')}>
                        Descripción{cArr('Descripcion_ctt')}
                      </th>
                      <th style={{ cursor: 'pointer', minWidth: 120 }} onClick={() => toggleCSort('Proveedor')}>
                        Proveedor{cArr('Proveedor')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleCSort('Area_contrato')}>
                        Área{cArr('Area_contrato')}
                      </th>
                      <th style={{ cursor: 'pointer', minWidth: 90 }} onClick={() => toggleCSort('Tipo_contrato')}>
                        Tipo{cArr('Tipo_contrato')}
                      </th>
                      <th>Estado Cto</th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleCSort('Presupuesto_CLP')}>
                        Presupuesto{cArr('Presupuesto_CLP')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleCSort('EP_Consumido_CLP')}>
                        EP Consumido{cArr('EP_Consumido_CLP')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleCSort('Saldo_CLP')}>
                        Saldo{cArr('Saldo_CLP')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleCSort('Pct_Saldo')}>
                        % Saldo{cArr('Pct_Saldo')}
                      </th>
                      <th style={{ textAlign: 'center' }}>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContratos.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy-500)' }}>
                          {c.codigo_ctt}
                        </td>
                        <td style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={c.Descripcion_ctt}>
                          {c.Descripcion_ctt}
                        </td>
                        <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}
                            title={c.Proveedor}>
                          {c.Proveedor || '—'}
                        </td>
                        <td style={{ color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>{c.Area_contrato}</td>
                        <td style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-500)' }}
                            title={c.Tipo_contrato}>
                          {c.Tipo_contrato}
                        </td>
                        <td>
                          <span className={`chip ${c.Estado_ctt === 'Vigente' ? 'ok' : 'navy'}`}>
                            {c.Estado_ctt}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {mmclp(c.Presupuesto_CLP)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--gray-600)' }}>
                          {mmclp(c.EP_Consumido_CLP)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: c.Saldo_CLP < 0 ? 'var(--error-500)' : undefined }}>
                          {mmclp(c.Saldo_CLP)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {(c.Pct_Saldo * 100).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`chip ${ALERTA_CHIP[c.Estado_Saldo] ?? 'navy'}`}>
                            {c.Estado_Saldo}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredContratos.length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>
                          Sin contratos en alerta
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>

        {/* ── PANEL: BOLETAS ── */}
        <div className="panel" style={{ padding: 0 }}>

          {/* Header colapsable */}
          <button
            onClick={() => setBOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 20px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning-500)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>
              Boletas de Garantía en Alerta
            </span>
            {boletas.length > 0 && (
              <span style={{
                background: 'var(--warning-50)', color: '#92580a',
                borderRadius: 99, padding: '1px 8px', fontSize: 10, fontWeight: 700,
              }}>
                {boletas.length}
              </span>
            )}
            <svg
              style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform .2s', transform: bOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round"
            >
              <polyline points="5 3 10 7 5 11" />
            </svg>
          </button>

          {bOpen && (
            <>
              {/* Charts */}
              <div className="two-col" style={{ padding: '14px 20px 0' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Por Nivel de Alerta
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={boletasNivelChart} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }} style={{ cursor: 'pointer' }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="nivel" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: any) => [v, 'Boletas']} />
                      <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} onClick={onBNivelClick}>
                        {boletasNivelChart.map((e, i) => (
                          <Cell key={i}
                            fill={ALERTA_COLOR[e.nivel] ?? '#9aa1b3'}
                            opacity={bfNivel && bfNivel !== e.nivel ? 0.25 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Más Urgentes — Días para Vencer
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={boletasVencerChart} margin={{ left: 0, right: 8, top: 0, bottom: 28 }} style={{ cursor: 'pointer' }}>
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: any) => [v, 'Días para vencer']} />
                      <Bar dataKey="dias" radius={[3, 3, 0, 0]} onClick={onBContratoClick}>
                        {boletasVencerChart.map((e, i) => (
                          <Cell key={i}
                            fill={boletaDiaColor(e.dias)}
                            opacity={bfContrato && bfContrato !== e.label ? 0.25 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Filter bar */}
              <div className="filters-bar" style={{ borderTop: '1px solid var(--gray-100)', marginTop: 14 }}>
                <div>
                  <label>Contrato</label>
                  <input
                    value={bfContrato}
                    onChange={e => setBfContrato(e.target.value)}
                    placeholder="Buscar contrato…"
                  />
                </div>
                {(bfContrato || bfNivel) && (
                  <button className="btn-ghost" style={{ alignSelf: 'flex-end' }}
                    onClick={() => { setBfContrato(''); setBfNivel('') }}>
                    Limpiar
                  </button>
                )}
                {bfNivel && (
                  <span style={{ alignSelf: 'flex-end', fontSize: 11, fontWeight: 600,
                    background: 'var(--warning-50)', color: '#92580a',
                    borderRadius: 99, padding: '3px 10px' }}>
                    {bfNivel}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 11, color: 'var(--gray-400)' }}>
                  {filteredBoletas.length} boletas
                </span>
              </div>

              {/* Table */}
              <div className="scroll-x">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleBSort('Contrato')}>
                        Contrato{bArr('Contrato')}
                      </th>
                      <th>Nro Boleta</th>
                      <th style={{ cursor: 'pointer', minWidth: 130 }} onClick={() => toggleBSort('Servicio')}>
                        Servicio{bArr('Servicio')}
                      </th>
                      <th style={{ cursor: 'pointer', minWidth: 120 }} onClick={() => toggleBSort('Proveedor')}>
                        Proveedor{bArr('Proveedor')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleBSort('Monto')}>
                        Monto{bArr('Monto')}
                      </th>
                      <th>Moneda</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleBSort('Fecha_Vencimiento')}>
                        Vencimiento{bArr('Fecha_Vencimiento')}
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleBSort('Dias_Para_Vencer')}>
                        Días{bArr('Dias_Para_Vencer')}
                      </th>
                      <th style={{ textAlign: 'center' }}>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBoletas.map((b, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--navy-500)' }}>{b.Contrato}</td>
                        <td style={{ color: 'var(--gray-600)' }}>{b['Nro Boleta']}</td>
                        <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={b.Servicio}>
                          {b.Servicio}
                        </td>
                        <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-600)' }}
                            title={b.Proveedor}>
                          {b.Proveedor}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {b.Monto?.toLocaleString('es-CL')}
                        </td>
                        <td style={{ color: 'var(--gray-500)' }}>{b.Moneda}</td>
                        <td>{b.Fecha_Vencimiento}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: (b.Dias_Para_Vencer ?? 999) < 31 ? 'var(--error-500)' : undefined }}>
                          {b.Dias_Para_Vencer}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`chip ${ALERTA_CHIP[b.Alerta_Vencimiento] ?? 'navy'}`}>
                            {b.Alerta_Vencimiento}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredBoletas.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px 0' }}>
                          Sin boletas en alerta
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  )
}
