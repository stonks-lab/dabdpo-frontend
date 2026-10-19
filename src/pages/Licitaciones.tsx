import React, { Fragment, useEffect, useMemo, useState } from 'react'
import { getLicitProcesosKpis, getLicitProcesos, getLicitProcesoDetalle } from '../api/client'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'

const AVANCE_COLOR: Record<string, string> = {
  'A TIEMPO':   '#16a34a',
  'RIESGO':     '#d97706',
  'ATRASADO':   '#dc2626',
  'PROGRAMADO': '#2563eb',
}
const AVANCE_BG: Record<string, string> = {
  'A TIEMPO':   '#dcfce7',
  'RIESGO':     '#fef3c7',
  'ATRASADO':   '#fee2e2',
  'PROGRAMADO': '#dbeafe',
}

function fmtFecha(s: string | null | undefined): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined)
    return <span style={{ color: '#9aa1b3', fontSize: 10 }}>—</span>
  const color = delta > 0 ? '#dc2626' : delta < 0 ? '#16a34a' : '#9aa1b3'
  const sign  = delta > 0 ? '+' : ''
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
      {sign}{delta}d
    </span>
  )
}

function DetalleRow({ proceso }: { proceso: string }) {
  const [items,   setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLicitProcesoDetalle(proceso)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [proceso])

  if (loading) return (
    <tr><td colSpan={12} style={{ padding: '8px 16px', background: '#f8fafc', color: '#9aa1b3', fontSize: 11 }}>Cargando detalle...</td></tr>
  )
  if (items.length === 0) return (
    <tr><td colSpan={12} style={{ padding: '8px 16px', background: '#f8fafc', color: '#9aa1b3', fontSize: 11 }}>Sin detalle disponible</td></tr>
  )

  return (
    <tr>
      <td colSpan={12} style={{ padding: 0, background: '#f8fafc' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e0e7ef' }}>
                {['Subelemento', 'Estado', 'Avance', 'Área', 'Ini Prog.', 'Fin Prog.', 'Ini Real', 'Fin Real', 'Ciclo Prog.', 'Ciclo Real'].map(h => (
                  <th key={h} style={{ padding: '4px 10px', textAlign: ['Ini Prog.','Fin Prog.','Ini Real','Fin Real','Ciclo Prog.','Ciclo Real'].includes(h) ? 'right' : 'left', whiteSpace: 'nowrap', color: '#4b5563' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '3px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d['Subelemento']}>{d['Subelemento'] || '—'}</td>
                  <td style={{ padding: '3px 10px' }}>
                    {d['Estado_Inicio-Fin'] ? (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: d['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#dcfce7' : '#fef9c3', color: d['Estado_Inicio-Fin'] === 'FINALIZADO' ? '#15803d' : '#854d0e' }}>{d['Estado_Inicio-Fin']}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '3px 10px', color: '#6b7280' }}>{d['Avance Etapas'] || '—'}</td>
                  <td style={{ padding: '3px 10px', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d['Área Responsable'] || '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fecha Inicio Acta inicio'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fecha Fin Acta Inicio'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Inicio real'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(d['Fin real'])}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{d['Ciclo programado'] ?? '—'}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{d['Ciclo real'] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

type SortDir   = 'asc' | 'desc'
type SortState = { field: string; dir: SortDir }

function SortTh({ label, field, sort, onSort, align = 'left', style }: {
  label: string; field: string; sort: SortState; onSort: (f: string) => void
  align?: 'left' | 'right' | 'center'; style?: React.CSSProperties
}) {
  const active = sort.field === field
  return (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer', userSelect: 'none', textAlign: align, padding: '7px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', background: '#f9fafb', color: active ? 'var(--navy-500)' : '#6b7280', ...style }}>
      {label}
      <span style={{ marginLeft: 3, opacity: active ? 1 : 0.35, fontSize: 9 }}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </th>
  )
}

function useSorted<T>(data: T[], sort: SortState): T[] {
  return useMemo(() => {
    if (!sort.field) return data
    return [...data].sort((a: any, b: any) => {
      const av = a[sort.field] ?? '', bv = b[sort.field] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sort.field, sort.dir])
}

export default function Licitaciones() {
  const [pKpis,        setPKpis]        = useState<any>(null)
  const [procesos,     setProcesos]     = useState<any[]>([])
  const [pFiltro,      setPFiltro]      = useState('')
  const [pBuscar,      setPBuscar]      = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showProcesos, setShowProcesos] = useState(false)
  const [procSort,     setProcSort]     = useState<SortState>({ field: '', dir: 'asc' })

  useEffect(() => {
    getLicitProcesosKpis().then(setPKpis).catch(() => {})
  }, [])

  useEffect(() => {
    getLicitProcesos(pFiltro ? { avance: pFiltro } : undefined).then(setProcesos).catch(() => {})
  }, [pFiltro])

  const handleSort = (f: string) =>
    setProcSort(s => ({ field: f, dir: s.field === f && s.dir === 'asc' ? 'desc' : 'asc' }))

  const procesosFiltrados = procesos.filter(p =>
    !pBuscar || (p['N°PROCESO'] + ' ' + p['Proceso']).toLowerCase().includes(pBuscar.toLowerCase())
  )
  const sortedProcesos = useSorted(procesosFiltrados, procSort)

  return (
    <div>
      <PageHeader title="Licitaciones" subtitle="Seguimiento de procesos de licitación" icon="📋" />

      {pKpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 pb-3 pt-1">
          <KpiCard label="Total Procesos" value={pKpis.total}      color="blue"   />
          <KpiCard label="A Tiempo"       value={pKpis.a_tiempo}   color="green"  />
          <KpiCard label="En Riesgo"      value={pKpis.riesgo}     color="yellow" />
          <KpiCard label="Atrasados"      value={pKpis.atrasado}   color="red"    />
          <KpiCard label="Programados"    value={pKpis.programado} color="blue"   />
        </div>
      )}

      <div className="px-4 pb-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowProcesos(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Detalle Procesos</span>
            <span style={{ fontSize: 11, color: '#9aa1b3', marginLeft: 'auto' }}>{procesosFiltrados.length} procesos</span>
            <span style={{ fontSize: 11, color: '#9aa1b3' }}>{showProcesos ? '▲' : '▼'}</span>
          </button>

          {showProcesos && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                <input type="text" placeholder="Buscar N° proceso o nombre…" value={pBuscar}
                  onChange={e => setPBuscar(e.target.value)}
                  style={{ flex: '1 1 220px', fontSize: 12, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                {(['', 'A TIEMPO', 'RIESGO', 'ATRASADO', 'PROGRAMADO'] as const).map(v => (
                  <button key={v || 'todos'} onClick={() => setPFiltro(v)} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', fontWeight: 600,
                    background: pFiltro === v ? (v ? AVANCE_COLOR[v] : 'var(--navy-500)') : '#e5e7eb',
                    color: pFiltro === v ? '#fff' : '#6b7280',
                  }}>{v || 'Todos'}</button>
                ))}
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <SortTh label="N° Proceso"  field="N°PROCESO"               sort={procSort} onSort={handleSort} />
                      <SortTh label="Nombre"       field="Proceso"                 sort={procSort} onSort={handleSort} />
                      <SortTh label="Avance"       field="Avance Gral Proceso"     sort={procSort} onSort={handleSort} align="center" />
                      <SortTh label="Etapa Actual" field="Etapa Actual"            sort={procSort} onSort={handleSort} />
                      <SortTh label="Ini. Prog."   field="Fecha inicio programado" sort={procSort} onSort={handleSort} align="right" />
                      <SortTh label="Ini. Real"    field="Fecha inicio real"       sort={procSort} onSort={handleSort} align="right" />
                      <SortTh label="Fin Prog."    field="Fecha fin programado"    sort={procSort} onSort={handleSort} align="right" />
                      <SortTh label="Fin Real"     field="Fecha fin real"          sort={procSort} onSort={handleSort} align="right" />
                      <SortTh label="Ciclo Est."   field="Ciclo estimado"          sort={procSort} onSort={handleSort} align="right" />
                      <SortTh label="Ciclo Real"   field="Ciclo real"              sort={procSort} onSort={handleSort} align="right" />
                      <SortTh label="Delta"        field="delta_dias"              sort={procSort} onSort={handleSort} align="right" />
                      <th style={{ padding: '7px 8px', fontSize: 10, color: '#6b7280', fontWeight: 700, background: '#f9fafb', textAlign: 'center' }}>Det.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProcesos.map((p: any, i: number) => {
                      const isOpen = expanded === p['N°PROCESO']
                      const av = p['Avance Gral Proceso']
                      return (
                        <Fragment key={p['N°PROCESO']}>
                          <tr style={{ borderTop: '1px solid #f0f0f0', background: isOpen ? '#f0f9ff' : i % 2 === 1 ? '#fafafa' : '#fff' }}>
                            <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', color: 'var(--navy-500)' }}>{p['N°PROCESO']}</td>
                            <td style={{ padding: '5px 8px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p['Proceso']}>
                              {p['Proceso']?.replace(/^CO-\S+\s+/, '') || '—'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: AVANCE_BG[av] ?? '#f3f4f6', color: AVANCE_COLOR[av] ?? '#6b7280' }}>{av || '—'}</span>
                            </td>
                            <td style={{ padding: '5px 8px', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{p['Etapa Actual'] || '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha inicio programado'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha inicio real'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin programado'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtFecha(p['Fecha fin real'])}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, color: '#9aa1b3', fontVariantNumeric: 'tabular-nums' }}>{p['Ciclo estimado'] ?? '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 10, fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{p['Ciclo real'] ?? '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right' }}><DeltaBadge delta={p['delta_dias']} /></td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              <button onClick={() => setExpanded(isOpen ? null : p['N°PROCESO'])} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid #e5e7eb', background: isOpen ? 'var(--navy-500)' : '#fff', color: isOpen ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                                {isOpen ? '▲' : '▼'}
                              </button>
                            </td>
                          </tr>
                          {isOpen && <DetalleRow proceso={p['N°PROCESO']} />}
                        </Fragment>
                      )
                    })}
                    {sortedProcesos.length === 0 && (
                      <tr><td colSpan={12} style={{ padding: '20px', textAlign: 'center', color: '#9aa1b3', fontSize: 12 }}>Sin procesos con el filtro seleccionado</td></tr>
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
