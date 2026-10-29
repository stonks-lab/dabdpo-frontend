import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ClusterRequirementsPanel } from '../components/ClusterRequirementsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CampInputs {
  duracion:    '' | 'corta' | 'media' | 'larga'
  lejania:     '' | 'cercano' | 'lejano'
  altitud:     '' | 'baja' | 'alta'
  dotacion:    '' | 'pequena' | 'grande'
  acceso:      '' | 'simple' | 'complicado'
  clima:       '' | 'seco' | 'lluvioso'
  presupuesto: '' | 'bajo' | 'medio' | 'alto'
}

const INIT: CampInputs = { duracion: '', lejania: '', altitud: '', dotacion: '', acceso: '', clima: '', presupuesto: '' }

// ─── Cluster definitions ──────────────────────────────────────────────────────
interface ClusterDef {
  id: string; label: string; color: string; tarifa: string; desc: string
  contrato: string; kpis: string[]; requisitos_mandante: string[]; docs_base: string[]; notas?: string
}

const CLUSTERS: ClusterDef[] = [
  {
    id: 'C1', label: 'Express', color: '#4763A0', tarifa: '1.0×',
    desc: 'Corta duración, dotación pequeña, cercano. Sin costo fijo — pago por día-cama efectivo.',
    contrato: 'Pago por día-cama efectivo. Sin costo fijo mensual ni movilización fija.',
    kpis: [
      'Días-cama efectivos consumidos vs proyectados',
      'Tasa de ocupación real',
      'Tiempo de respuesta ante solicitudes',
      'Satisfacción de usuario (encuesta)',
    ],
    requisitos_mandante: [
      'Calendario de ocupación definido con ±1 semana de anticipación',
      'Definición del estándar mínimo de servicio (alimentación, lavandería)',
      'Coordinación con servicios médicos locales',
      'Validación de acceso y logística de transporte',
    ],
    docs_base: [
      'Especificación técnica de servicios de campamento',
      'Protocolo de salud y emergencias básico',
      'Matriz de precios unitarios por día-cama',
    ],
  },
  {
    id: 'C2', label: 'Estándar', color: '#2a9d8f', tarifa: '1.3×',
    desc: 'Duración media, condiciones variables, altitud baja. Costo fijo/mes + variable por ración.',
    contrato: 'Costo fijo mensual + variable por ración y servicio. Facturación mensual consolidada.',
    kpis: [
      'Ocupación efectiva vs proyectada',
      'Calidad de servicio (CESS o equivalente)',
      'Consumo de raciones diarias',
      'Disponibilidad de habitaciones (>98%)',
      'Índice de incidentes HSES',
    ],
    requisitos_mandante: [
      'Proyección mensual de dotación con 2 semanas de anticipación',
      'Definición de estándares de alimentación y alojamiento',
      'Plan de escalamiento ante variaciones de dotación',
      'Designación de administrador de contrato',
    ],
    docs_base: [
      'Especificación técnica de campamento estándar',
      'SLA de servicios con tolerancias definidas',
      'Planilla de proyección mensual de dotación',
      'Protocolo de control de calidad de alimentación',
    ],
  },
  {
    id: 'C3', label: 'Alta Montaña', color: '#BB813A', tarifa: '1.8×',
    desc: 'Variable DOMINANTE: >3.500 msnm. Requiere examen médico, aclimatación y plan de evacuación.',
    contrato: 'Tarifa diferenciada 1.8×. Incluye suplemento por equipamiento especializado de altura y exigencias médicas.',
    kpis: [
      'Disponibilidad operacional del campamento (>95%)',
      'Indicadores médicos: casos de mal de altura y derivaciones',
      'Tiempo de evacuación médica de emergencia',
      'Disponibilidad de equipos de oxigenoterapia y DEA',
    ],
    requisitos_mandante: [
      'Exámenes médicos de altura aprobados (100% del personal)',
      'Protocolo de aclimatación progresiva (mínimo 48 h)',
      'Plan de evacuación certificado con DZ o helipuerto definido',
      'Médico o paramédico residente en campamento',
      'Equipamiento médico de altura: oxígeno, DEA, botiquín avanzado',
    ],
    docs_base: [
      'Protocolo médico de trabajo en altura',
      'Plan de emergencias y evacuación con rutas definidas',
      'Especificación técnica de campamento de alta montaña',
      'Certificaciones de personal médico residente',
    ],
    notas: 'Variable dominante: cualquier proyecto >3.500 msnm aplica este cluster independientemente de otras variables.',
  },
  {
    id: 'C4', label: 'Base Establecida', color: '#e76f51', tarifa: '1.5×',
    desc: 'Larga duración, dotación pequeña, lejano. Módulos permanentes con incentivo por extensión.',
    contrato: 'Módulos permanentes con incentivo por extensión de contrato. Costo fijo mensual con ajuste anual.',
    kpis: [
      'Disponibilidad de infraestructura (>99%)',
      'Consumo energético vs línea base',
      'Tiempo medio de reparación ante fallas',
      'Satisfacción de usuario (encuesta semestral)',
    ],
    requisitos_mandante: [
      'Definición de ubicación definitiva y permiso de instalación',
      'Coordinación con autoridades locales o comunidades del sector',
      'Plan de gestión de residuos aprobado',
      'Infraestructura de servicios básicos: agua, energía, comunicaciones',
    ],
    docs_base: [
      'Especificación técnica de módulos habitacionales y de servicios',
      'Plano de instalación y distribución aprobado',
      'Plan de gestión de residuos y aguas grises',
      'Protocolo de mantención preventiva de infraestructura',
    ],
  },
  {
    id: 'C5', label: 'Gran Escala', color: '#6a4c93', tarifa: '2.0×',
    desc: 'Larga duración, dotación grande, lejano. Tarifa premium con SLA automático y penalidades.',
    contrato: 'Tarifa premium 2.0× con SLA automático. Penalidades por incumplimiento de disponibilidad. Bonus por eficiencia.',
    kpis: [
      'Disponibilidad global (>99%)',
      'Tiempo de respuesta ante fallas (<4 h)',
      'Satisfacción de usuarios (encuesta trimestral)',
      'Eficiencia energética vs línea base',
      'Accidentes por millón de horas-hombre',
    ],
    requisitos_mandante: [
      'Aprobación corporativa del proyecto y presupuesto',
      'Estudio de impacto ambiental y social aprobado',
      'Plan de relaciones comunitarias activo',
      'Infraestructura habilitada: camino de acceso, agua, energía, comunicaciones',
    ],
    docs_base: [
      'Especificación técnica completa de campamento gran escala',
      'Contrato SLA con métricas y penalidades definidas',
      'Plan de contingencia y continuidad operacional',
      'Plan de gestión comunitaria y comunicaciones',
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

function calcScores(i: CampInputs): number[] {
  const s = [0, 0, 0, 0, 0]
  if (i.altitud === 'alta') s[2] += 1000
  else                      { s[0] += 5; s[1] += 5; s[3] += 5; s[4] += 5 }
  if      (i.duracion === 'corta') { s[0] += 30; s[1] += 5 }
  else if (i.duracion === 'media') { s[0] += 5; s[1] += 30; s[3] += 10; s[4] += 5 }
  else if (i.duracion === 'larga') { s[1] += 10; s[3] += 30; s[4] += 30 }
  if      (i.dotacion === 'pequena') { s[0] += 20; s[1] += 15; s[3] += 20 }
  else if (i.dotacion === 'grande')  { s[1] += 5; s[4] += 30 }
  if      (i.lejania === 'cercano') { s[0] += 20; s[1] += 10 }
  else if (i.lejania === 'lejano')  { s[1] += 10; s[3] += 20; s[4] += 20 }
  if      (i.acceso === 'simple')     { s[0] += 10; s[1] += 8 }
  else if (i.acceso === 'complicado') { s[1] += 5; s[3] += 10; s[4] += 10 }
  if      (i.clima === 'seco')     { s[0] += 10; s[1] += 7 }
  else if (i.clima === 'lluvioso') { s[1] += 7; s[3] += 10; s[4] += 10 }
  if      (i.presupuesto === 'bajo')  { s[0] += 15; s[1] += 5 }
  else if (i.presupuesto === 'medio') { s[0] += 5; s[1] += 15; s[3] += 5 }
  else if (i.presupuesto === 'alto')  { s[1] += 5; s[3] += 15; s[4] += 20 }
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

function ResultPanel({ results, selectedId, onSelect }: {
  results: ClusterResult[]
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
export default function ModelosCampamento() {
  const [inp, setInp]           = useState<CampInputs>(INIT)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filled  = useMemo(() => Object.values(inp).every(v => v !== ''), [inp])
  const count   = useMemo(() => Object.values(inp).filter(v => v !== '').length, [inp])
  const scores  = useMemo(() => (filled ? calcScores(inp) : null), [inp, filled])
  const results: ClusterResult[] | null = scores ? CLUSTERS.map((c, i) => ({ ...c, pct: scores[i] })) : null

  const selectedCluster = results?.find(r => r.id === selectedId) ?? null

  const set = (k: keyof CampInputs, v: string) => {
    setInp(prev => ({ ...prev, [k]: v }))
    setSelectedId(null)
  }

  return (
    <>
      <PageHeader
        title="Modelos Productivos — Campamento"
        subtitle="Clasificador de proyectos por cluster · 5 clusters según variables del proyecto"
        icon="🏕️"
      />
      <div className="page">
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div className="panel">
            <h2>Variables del Proyecto</h2>
            <RadioGroup label="1. Duración del proyecto" value={inp.duracion} onChange={v => set('duracion', v)}
              options={[
                { value: 'corta', label: 'Corta (<6 meses)' },
                { value: 'media', label: 'Media (6–12 meses)' },
                { value: 'larga', label: 'Larga (>12 meses)' },
              ]}
            />
            <RadioGroup label="2. Lejanía a ciudad / servicios" value={inp.lejania} onChange={v => set('lejania', v)}
              options={[
                { value: 'cercano', label: 'Cercano (<2 h)' },
                { value: 'lejano',  label: 'Lejano (>2 h)' },
              ]}
            />
            <RadioGroup
              label="3. Altitud"
              hint="Variable dominante — alta montaña (>3.500 msnm) se superpone a cualquier otro cluster"
              value={inp.altitud}
              onChange={v => set('altitud', v)}
              options={[
                { value: 'baja', label: 'Baja montaña (<3.500 msnm)' },
                { value: 'alta', label: 'Alta montaña (>3.500 msnm)' },
              ]}
            />
            <RadioGroup label="4. Tamaño de dotación" value={inp.dotacion} onChange={v => set('dotacion', v)}
              options={[
                { value: 'pequena', label: 'Pequeño (<50 personas)' },
                { value: 'grande',  label: 'Grande (>50 personas)' },
              ]}
            />
            <RadioGroup label="5. Condiciones de acceso" value={inp.acceso} onChange={v => set('acceso', v)}
              options={[
                { value: 'simple',     label: 'Acceso simple' },
                { value: 'complicado', label: 'Acceso complicado' },
              ]}
            />
            <RadioGroup label="6. Condiciones climáticas" value={inp.clima} onChange={v => set('clima', v)}
              options={[
                { value: 'seco',     label: 'Seco' },
                { value: 'lluvioso', label: 'Lluvioso o nevoso' },
              ]}
            />
            <RadioGroup label="7. Presupuesto" value={inp.presupuesto} onChange={v => set('presupuesto', v)}
              options={[
                { value: 'bajo',  label: 'Bajo' },
                { value: 'medio', label: 'Medio' },
                { value: 'alto',  label: 'Alto' },
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
              <ResultPanel results={results} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
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
            modulo="Campamento"
            onDeselect={() => setSelectedId(null)}
          />
        )}
      </div>
    </>
  )
}
