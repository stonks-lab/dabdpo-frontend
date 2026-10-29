import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ClusterRequirementsPanel } from '../components/ClusterRequirementsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
interface MTInputs {
  terreno:     '' | 'blando' | 'semiduro' | 'roca'
  complejidad: '' | 'simple' | 'medio' | 'complejo'
  escala:      '' | 'pequena' | 'media' | 'grande'
  altura:      '' | 'baja' | 'alta'
  actividades: '' | 'mantencion' | 'apertura' | 'masiva'
  presupuesto: '' | 'bajo' | 'medio' | 'alto'
  stack:       '' | 'basico' | 'estandar' | 'completo'
}

const INIT: MTInputs = { terreno: '', complejidad: '', escala: '', altura: '', actividades: '', presupuesto: '', stack: '' }

// ─── Cluster definitions ──────────────────────────────────────────────────────
interface ClusterDef {
  id: string; label: string; color: string; tarifa: string; desc: string
  contrato: string; kpis: string[]; requisitos_mandante: string[]; docs_base: string[]; notas?: string
}

const CLUSTERS: ClusterDef[] = [
  {
    id: 'C1', label: 'Mantención', color: '#4763A0', tarifa: '0.7×',
    desc: 'Solo mantención de caminos existentes. Pago $/metro mantenido, sin movilización fija.',
    contrato: 'Pago por metro mantenido por periodo. Sin movilización fija. Precio unitario por tipo de intervención.',
    kpis: [
      'Metros mantenidos por periodo',
      'IRI (Índice de Rugosidad Internacional) post-mantención',
      'Disponibilidad de caminos (% tiempo operativo)',
      'Tiempo de respuesta ante daños por lluvia o eventos',
    ],
    requisitos_mandante: [
      'Inventario actualizado de caminos a mantener (km y tipo)',
      'Definición del estándar de mantención (IRI objetivo)',
      'Plan de inspección y reporte de estado de la red',
      'Protocolo de respuesta ante eventos climáticos',
    ],
    docs_base: [
      'Especificación técnica de mantención de caminos',
      'Protocolo de inspección y criterios de intervención',
      'Estándares de calidad de rodado (IRI, pendiente, drenaje)',
      'Registro actualizado de la red de caminos',
    ],
  },
  {
    id: 'C2', label: 'Hab. Estándar', color: '#2a9d8f', tarifa: '1.0×',
    desc: 'Terreno blando/semiduro, complejidad simple. Pago $/metro lineal + $/m² plataforma.',
    contrato: 'Precio por metro lineal habilitado + precio por m² de plataforma. Pago por avance verificado en terreno.',
    kpis: [
      'Metros habilitados por semana vs programa',
      'Calidad de compactación (Proctor modificado)',
      'Pendientes logradas vs diseño aprobado',
      'Cumplimiento de trazado y alineación',
    ],
    requisitos_mandante: [
      'Levantamiento topográfico previo aprobado',
      'Diseño de caminos con planos aprobados (planta, perfil, secciones)',
      'Estudios básicos de mecánica de suelos',
      'Permisos ambientales de intervención aprobados',
    ],
    docs_base: [
      'Especificación técnica de habilitación de caminos',
      'Planos de diseño aprobados (planta, perfil, secciones)',
      'Protocolo de compactación y control de calidad',
      'Programa de obras con hitos definidos',
    ],
  },
  {
    id: 'C3', label: 'T. Complejo', color: '#e76f51', tarifa: '1.3×',
    desc: 'Terreno duro o roca, alta complejidad. Tarifa diferenciada + plan de manejo de roca.',
    contrato: 'Tarifa diferenciada 1.3× con plan de manejo de roca. Precio separado por volumen de tronadura si aplica.',
    kpis: [
      'Metros habilitados en roca por semana',
      'Volumen de roca tronada vs proyectado',
      'Índice de incidentes en operaciones de tronadura',
      'Avance real vs programa de obras',
    ],
    requisitos_mandante: [
      'Estudio geomecánico del sector aprobado',
      'Plan de tronadura aprobado por autoridad competente',
      'Permisos de uso y almacenamiento de explosivos (DGAC/SEREMITT)',
      'Plan de seguridad específico para voladuras (vibraciones, radios de exclusión)',
    ],
    docs_base: [
      'Plan de manejo de roca y tronadura',
      'Especificación de tronadura con parámetros de diseño',
      'Plan de seguridad en voladuras',
      'Permisos regulatorios (DGAC, SEREMITT, SERNAGEOMIN según aplique)',
    ],
  },
  {
    id: 'C4', label: 'Alta Montaña ↑', color: '#BB813A', tarifa: '+0.3×',
    desc: 'OVERLAY >3.500 msnm — se suma al cluster base. Suplemento fijo/mes, rendimientos ajustados.',
    contrato: 'Suplemento fijo mensual +0.3× sobre la tarifa base del cluster principal. Rendimientos ajustados por curva de eficiencia de altura.',
    kpis: [
      'Rendimientos reales vs curva de eficiencia de altura',
      'Disponibilidad de equipos en condiciones de frío y altura',
      'Indicadores de salud del personal (saturación O₂)',
      'Días perdidos por condiciones climáticas extremas',
    ],
    requisitos_mandante: [
      'Exámenes médicos de altura para operadores (100%)',
      'Programa de mantenimiento preventivo adicional de equipos',
      'Protocolo de trabajo con viento y temperatura extrema',
      'Plan de aclimatación progresiva del personal',
    ],
    docs_base: [
      'Protocolo de trabajo en altura para equipos de movimiento de tierra',
      'Plan de aclimatación y control médico del personal',
      'Especificación de equipos aptos para altura (calefacción, partida en frío)',
      'Registro de rendimientos por rango altitudinal',
    ],
    notas: 'Overlay: este cluster se suma al cluster base (C1, C2, C3 o C5). El contrato incorpora ambas estructuras de precio.',
  },
  {
    id: 'C5', label: 'Gran Escala', color: '#6a4c93', tarifa: '1.6×',
    desc: 'Habilitación masiva, escala grande. Precio objetivo NEC Opción C con bonus por hitos.',
    contrato: 'Precio objetivo NEC Opción C con bonus por cumplimiento de hitos. Penalidades por retraso en hitos críticos.',
    kpis: [
      'Avance semanal vs programa (% hitos cumplidos)',
      'Calidad de obras (CBR, IRI, pendientes logradas)',
      'Índice de accidentes por millón de HH',
      'Eficiencia de uso de maquinaria (% disponibilidad)',
    ],
    requisitos_mandante: [
      'Ingeniería de detalle aprobada al 100% antes del inicio',
      'Permisos ambientales y sectoriales tramitados',
      'Programa de obras aprobado con hitos contractuales',
      'Plan de gestión de interferencias con operaciones mineras',
    ],
    docs_base: [
      'Especificación técnica completa de habilitación gran escala',
      'Programa detallado de obras con EDT e hitos',
      'Plan de calidad y control de obras',
      'Plan de seguridad y salud ocupacional (PASO)',
      'Plan de gestión ambiental durante construcción',
    ],
  },
]

// ─── Scoring ──────────────────────────────────────────────────────────────────
function normalize(raw: number[]): number[] {
  const total = raw.reduce((a, b) => a + b, 0)
  if (total === 0) return raw.map(() => 0)
  const pcts = raw.map(v => Math.round((v / total) * 100))
  const diff = 100 - pcts.reduce((a, b) => a + b, 0)
  if (diff !== 0) pcts[pcts.indexOf(Math.max(...pcts))] += diff
  return pcts
}

function calcScores(i: MTInputs): number[] {
  const s = [0, 0, 0, 0, 0]
  if      (i.altura === 'alta') s[3] += 100
  else                          { s[0] += 5; s[1] += 5; s[2] += 5; s[4] += 5 }
  if      (i.terreno === 'blando')   { s[0] += 5; s[1] += 25; s[4] += 10 }
  else if (i.terreno === 'semiduro') { s[0] += 5; s[1] += 15; s[2] += 10; s[4] += 10 }
  else if (i.terreno === 'roca')     { s[2] += 30; s[4] += 10 }
  if      (i.complejidad === 'simple')   { s[0] += 25; s[1] += 20; s[4] += 10 }
  else if (i.complejidad === 'medio')    { s[0] += 10; s[1] += 15; s[2] += 10; s[4] += 10 }
  else if (i.complejidad === 'complejo') { s[2] += 25; s[4] += 15 }
  if      (i.escala === 'pequena') { s[0] += 20; s[1] += 15; s[2] += 15 }
  else if (i.escala === 'media')   { s[0] += 15; s[1] += 20; s[2] += 20; s[4] += 5 }
  else if (i.escala === 'grande')  { s[4] += 30 }
  if      (i.actividades === 'mantencion') { s[0] += 30; s[1] += 5 }
  else if (i.actividades === 'apertura')   { s[0] += 5; s[1] += 25; s[2] += 20; s[4] += 5 }
  else if (i.actividades === 'masiva')     { s[2] += 10; s[4] += 30 }
  if      (i.presupuesto === 'bajo')  { s[0] += 20; s[1] += 5 }
  else if (i.presupuesto === 'medio') { s[0] += 5; s[1] += 20; s[2] += 5; s[4] += 5 }
  else if (i.presupuesto === 'alto')  { s[2] += 20; s[4] += 20 }
  if      (i.stack === 'basico')   { s[0] += 15; s[1] += 5 }
  else if (i.stack === 'estandar') { s[0] += 5; s[1] += 15; s[2] += 5 }
  else if (i.stack === 'completo') { s[2] += 15; s[3] += 10; s[4] += 15 }
  return normalize(s)
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function RadioGroup({ label, hint, value, options, onChange }: {
  label: string; hint?: string; value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
        {label}
      </div>
      {hint && <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 5, lineHeight: 1.4 }}>{hint}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            padding: '5px 13px', borderRadius: 99, border: '1px solid',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 100ms',
            ...(value === opt.value
              ? { background: 'var(--navy-500)', color: '#fff', borderColor: 'var(--navy-500)' }
              : { background: 'var(--gray-50)', color: 'var(--gray-500)', borderColor: 'var(--gray-200)' }),
          }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ClusterResult extends ClusterDef { pct: number }

function ResultPanel({ results, altaOverlay, selectedId, onSelect }: {
  results: ClusterResult[]
  altaOverlay: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const sorted = [...results].sort((a, b) => b.pct - a.pct)
  const top = sorted[0]
  return (
    <div>
      <div style={{ background: 'var(--navy-50)', border: `2px solid ${top.color}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Recomendación principal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: top.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>
            {top.id}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 3 }}>{top.label}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.4 }}>{top.desc}</div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: top.color, flexShrink: 0, minWidth: 50, textAlign: 'right', lineHeight: 1 }}>
            {top.pct}%
          </div>
        </div>
        {altaOverlay && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff8e6', border: '1px solid var(--gold-300)', borderRadius: 6, fontSize: 11, color: '#92580a' }}>
            <strong>C4 Alta Montaña actúa como overlay</strong> — se agrega suplemento de tarifa sobre este cluster base.
          </div>
        )}
        <button
          onClick={() => onSelect(top.id)}
          style={{
            marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: 'none', transition: 'all 150ms',
            ...(selectedId === top.id
              ? { background: 'transparent', color: top.color, border: `1px solid ${top.color}` }
              : { background: top.color, color: '#fff' }),
          }}
        >
          {selectedId === top.id ? '✓ Modelo seleccionado' : 'Implementar este modelo →'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: r.pct < 4 ? 0.3 : 1, transition: 'opacity 300ms' }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: r.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>
              {r.id}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)' }}>{r.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gray-400)' }}>{r.tarifa}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-800)', minWidth: 38, textAlign: 'right' }}>{r.pct}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 4, transition: 'width 500ms ease' }} />
              </div>
            </div>
            <button
              onClick={() => onSelect(r.id)}
              style={{
                padding: '4px 10px', borderRadius: 99, border: '1px solid',
                fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                transition: 'all 100ms', whiteSpace: 'nowrap',
                ...(selectedId === r.id
                  ? { background: r.color, color: '#fff', borderColor: r.color }
                  : { background: 'transparent', color: 'var(--gray-500)', borderColor: 'var(--gray-300)' }),
              }}
            >
              {selectedId === r.id ? '✓ Seleccionado' : 'Seleccionar'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-100)', fontSize: 10, color: 'var(--gray-400)' }}>
        Tarifa base relativa (referencial). Selecciona un cluster para ver requisitos e implicancias.
      </div>
    </div>
  )
}

function ProgressDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 14 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', transition: 'background 200ms', background: i < filled ? 'var(--navy-500)' : 'var(--gray-200)' }} />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ModelosMT() {
  const [inp, setInp]               = useState<MTInputs>(INIT)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filled  = useMemo(() => Object.values(inp).every(v => v !== ''), [inp])
  const count   = useMemo(() => Object.values(inp).filter(v => v !== '').length, [inp])
  const scores  = useMemo(() => (filled ? calcScores(inp) : null), [inp, filled])
  const results: ClusterResult[] | null = scores ? CLUSTERS.map((c, i) => ({ ...c, pct: scores[i] })) : null

  const selectedCluster = results?.find(r => r.id === selectedId) ?? null

  const set = (k: keyof MTInputs, v: string) => {
    setInp(prev => ({ ...prev, [k]: v }))
    setSelectedId(null)
  }

  return (
    <>
      <PageHeader
        title="Modelos Productivos — Movimiento de Tierra"
        subtitle="Clasificador de proyectos por cluster · 5 clusters según variables del proyecto"
        icon="🏗️"
      />
      <div className="page">
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div className="panel">
            <h2>Variables del Proyecto</h2>
            <RadioGroup label="1. Tipo de terreno" value={inp.terreno} onChange={v => set('terreno', v)}
              options={[
                { value: 'blando',   label: 'Blando (arcilla/arena)' },
                { value: 'semiduro', label: 'Semiduro' },
                { value: 'roca',     label: 'Roca meteorizada o dura' },
              ]}
            />
            <RadioGroup
              label="2. Complejidad del camino"
              hint="Simple: amplio y plano (Divisional) · Medio: algo de pendiente · Complejo: estrecho, alta pendiente, quebrada"
              value={inp.complejidad}
              onChange={v => set('complejidad', v)}
              options={[
                { value: 'simple',   label: 'Simple' },
                { value: 'medio',    label: 'Medio' },
                { value: 'complejo', label: 'Complejo' },
              ]}
            />
            <RadioGroup label="3. Escala de obras" value={inp.escala} onChange={v => set('escala', v)}
              options={[
                { value: 'pequena', label: 'Pequeña (<5 km / ≤3 plat.)' },
                { value: 'media',   label: 'Media (5–20 km / 3–10 plat.)' },
                { value: 'grande',  label: 'Grande (>20 km / >10 plat.)' },
              ]}
            />
            <RadioGroup
              label="4. Altura geográfica"
              hint="Alta montaña actúa como overlay sobre cualquier cluster base — aplica suplemento de tarifa adicional"
              value={inp.altura}
              onChange={v => set('altura', v)}
              options={[
                { value: 'baja', label: 'Baja montaña (<3.500 msnm)' },
                { value: 'alta', label: 'Alta montaña (>3.500 msnm)' },
              ]}
            />
            <RadioGroup label="5. Tipo de actividades" value={inp.actividades} onChange={v => set('actividades', v)}
              options={[
                { value: 'mantencion', label: 'Solo mantención' },
                { value: 'apertura',   label: 'Apertura + mantención' },
                { value: 'masiva',     label: 'Habilitación masiva' },
              ]}
            />
            <RadioGroup label="6. Presupuesto" value={inp.presupuesto} onChange={v => set('presupuesto', v)}
              options={[
                { value: 'bajo',  label: 'Bajo' },
                { value: 'medio', label: 'Medio' },
                { value: 'alto',  label: 'Alto' },
              ]}
            />
            <RadioGroup
              label="7. Stack tecnológico"
              hint="Básico: Motoniveladora+Aljibe · Estándar: +Machine Control 3D · Completo: +LIDAR+BIM"
              value={inp.stack}
              onChange={v => set('stack', v)}
              options={[
                { value: 'basico',   label: 'Básico' },
                { value: 'estandar', label: 'Estándar (MC3D)' },
                { value: 'completo', label: 'Completo (LIDAR+BIM+MC3D)' },
              ]}
            />
            {filled
              ? <button className="btn-ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => { setInp(INIT); setSelectedId(null) }}>Reiniciar</button>
              : <ProgressDots filled={count} total={7} />
            }
          </div>

          <div className="panel">
            <h2>Clasificación por Cluster</h2>
            {results ? (
              <ResultPanel results={results} altaOverlay={inp.altura === 'alta'} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🏗️</div>
                <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.6 }}>
                  Completa las 7 variables para ver<br />la recomendación de cluster.
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedCluster && (
          <ClusterRequirementsPanel
            cluster={selectedCluster}
            modulo="Movimiento de Tierra"
            onDeselect={() => setSelectedId(null)}
          />
        )}
      </div>
    </>
  )
}
