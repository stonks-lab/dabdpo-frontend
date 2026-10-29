import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ClusterRequirementsPanel } from '../components/ClusterRequirementsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SondajesInputs {
  incertidumbre: '' | 'baja_media' | 'media' | 'alta'
  variabilidad:  '' | 'acotada' | 'media' | 'extendida' | 'dependiente'
  meta:          '' | 'metros_plazos' | 'disponibilidad_variables' | 'producto_especializado'
  tipo_contrato: '' | 'precio_fijo' | 'tiempo_materiales'
  comunidades:   '' | 'menor_esfuerzo' | 'mayor_esfuerzo' | 'depende'
}

const INIT: SondajesInputs = {
  incertidumbre: '', variabilidad: '', meta: '', tipo_contrato: '', comunidades: '',
}

// ─── Cluster definitions ──────────────────────────────────────────────────────
interface ClusterDef {
  id: string; label: string; color: string
  financia: string; gestiona: string; contrato: string; desc: string
  kpis: string[]; requisitos_mandante: string[]; docs_base: string[]; notas?: string
}

const CLUSTERS: ClusterDef[] = [
  {
    id: 'S-1', label: 'Divisional', color: '#0d3b82',
    financia: 'División', gestiona: 'DDI', contrato: 'Precio fijo con incentivo fijo',
    desc: 'Financiamiento divisional. EMSA actúa como contratista, gestionado por DDI. Incertidumbre baja-media, plan de perforación acotado. KPIs: metros/tiempo, velocidad de penetración, disponibilidad operacional.',
    kpis: [
      'Metros perforados vs plazo comprometido',
      'Velocidad de penetración (m/turno o m/hora)',
      'Disponibilidad operacional del equipo (>90%)',
      'Cumplimiento del programa mensual',
    ],
    requisitos_mandante: [
      'Objetivo de sondaje definido con profundidades y azimuts',
      'Plano de plataformas y accesos aprobado',
      'Coordinación con área DDI y aprobación divisional',
      'Protocolo de muestreo y registro de núcleos',
    ],
    docs_base: [
      'Especificación técnica de sondaje con parámetros de perforación',
      'Plan de perforación aprobado (ubicaciones, profundidades, diámetros)',
      'Procedimiento operacional estándar EMSA',
      'Plan de gestión de testigos de sondaje',
    ],
  },
  {
    id: 'S-2', label: 'Explor. Avanzado', color: '#2a9d8f',
    financia: 'GCEX', gestiona: 'DEX', contrato: 'Precio fijo con incentivo fijo',
    desc: 'Financiamiento GCEX. EMSA mandante, gestionado por DEX. Modelo geológico avanzado, incertidumbre media. KPIs: metros/tiempo, velocidad penetración, reportería SOP EMSA.',
    kpis: [
      'Metros perforados vs plazo comprometido',
      'Velocidad de penetración (m/turno)',
      'Calidad de recuperación de testigos (RQD, % recuperación)',
      'Cumplimiento de reportería SOP EMSA',
    ],
    requisitos_mandante: [
      'Modelo geológico 3D avanzado disponible',
      'Aprobación y presupuesto GCEX tramitados',
      'Coordinación con área DEX y designación de geólogo responsable',
      'Protocolo de muestreo, QA/QC y cadena de custodia',
    ],
    docs_base: [
      'Especificación técnica con estándares SOP EMSA completos',
      'Plan de sondajes integrado con modelo geológico 3D',
      'Protocolo de muestreo y aseguramiento de calidad (QA/QC)',
      'Manual de procedimientos de testigos de exploración',
    ],
  },
  {
    id: 'S-3', label: 'Explor. Básico', color: '#BB813A',
    financia: 'GCEX', gestiona: 'DEX', contrato: 'Tiempo y materiales',
    desc: 'Financiamiento GCEX. EMSA mandante, gestionado por DEX. Modelo geológico básico, alta incertidumbre. KPIs: disponibilidad operacional, velocidad penetración + metros efectivos.',
    kpis: [
      'Disponibilidad operacional del equipo',
      'Velocidad de penetración promedio (m/turno)',
      'Metros efectivos vs metros totales',
      'Horas perdidas por condiciones del terreno',
    ],
    requisitos_mandante: [
      'Objetivo exploratorio definido con tolerancias amplias',
      'Acceso al área aprobado y habilitado',
      'Protocolo de gestión de incertidumbre (decisiones en campo)',
      'Plan de contingencia para variaciones significativas del plan',
    ],
    docs_base: [
      'Especificación de sondaje con tolerancias para alta incertidumbre',
      'Protocolo de T&M: registro horario de equipos y personal',
      'Criterios de aceptación de metros efectivos',
      'Plan de comunicación y toma de decisiones en campo',
    ],
  },
  {
    id: 'S-4', label: 'Especial', color: '#6a4c93',
    financia: 'Variable', gestiona: 'DP', contrato: 'Según proyecto',
    desc: 'Producto especializado o condiciones atípicas. Aplica cuando financiamiento, mandante o producto no encajan en S-1 a S-3. KPIs y tipo de contrato definidos por proyecto.',
    kpis: [
      'Definir por proyecto según tipo de producto especializado',
      'KPIs de hitos y entregables específicos del proyecto',
      'Indicadores de calidad del producto técnico final',
    ],
    requisitos_mandante: [
      'Definición técnica clara del producto o resultado esperado',
      'Identificación del financiador y presupuesto disponible',
      'Alineación con Dirección de Proyectos (DP) y aprobación de excepción',
      'Definición del marco contractual (alcance, plazo, forma de pago)',
    ],
    docs_base: [
      'Brief técnico del producto especializado',
      'Justificación de excepcionalidad (por qué no aplica S-1 a S-3)',
      'Propuesta de estructura contractual específica',
      'Plan de proyecto con hitos y entregables definidos',
    ],
    notas: 'Cluster de excepción. Antes de activar S-4, confirmar que el proyecto no encaja en S-1, S-2 ni S-3.',
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

function calcScores(i: SondajesInputs): number[] {
  // s[0]=S-1, s[1]=S-2, s[2]=S-3, s[3]=S-4
  const s = [0, 0, 0, 0]

  if (i.variabilidad === 'dependiente')     s[3] += 800
  if (i.meta === 'producto_especializado')  s[3] += 800

  if      (i.incertidumbre === 'baja_media') { s[0] += 40; s[1] += 20 }
  else if (i.incertidumbre === 'media')      { s[1] += 40; s[0] += 10 }
  else if (i.incertidumbre === 'alta')       { s[2] += 40; s[3] += 10 }

  if      (i.variabilidad === 'acotada')   { s[0] += 35 }
  else if (i.variabilidad === 'media')     { s[0] += 15; s[1] += 25 }
  else if (i.variabilidad === 'extendida') { s[1] += 20; s[2] += 30 }

  if      (i.meta === 'metros_plazos')            { s[0] += 35 }
  else if (i.meta === 'disponibilidad_variables') { s[1] += 20; s[2] += 25 }

  if      (i.tipo_contrato === 'precio_fijo')       { s[0] += 25; s[1] += 25 }
  else if (i.tipo_contrato === 'tiempo_materiales') { s[2] += 30; s[3] += 15 }

  if      (i.comunidades === 'menor_esfuerzo') { s[0] += 20; s[1] += 20 }
  else if (i.comunidades === 'mayor_esfuerzo') { s[2] += 25 }
  else if (i.comunidades === 'depende')        { s[3] += 400 }

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
  const isSpecial = top.id === 'S-4'

  const abbrev = (c: string) =>
    c === 'Precio fijo con incentivo fijo' ? 'PF+I'
    : c === 'Tiempo y materiales'          ? 'T&M'
    : 'Var.'

  return (
    <div>
      {isSpecial && (
        <div style={{ background: '#f3eeff', border: '1px solid #c4a8f5', borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
          <div style={{ fontSize: 11, color: '#4a2880', lineHeight: 1.45 }}>
            <strong>Caso especial detectado.</strong> Las condiciones no encajan en los clusters estándar S-1 a S-3. Requiere definición particular de alcance, financiamiento y KPIs.
          </div>
        </div>
      )}

      <div style={{ background: 'var(--navy-50)', border: `2px solid ${top.color}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Recomendación principal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: top.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 800, textAlign: 'center', lineHeight: 1.25 }}>
            {top.id}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 3 }}>{top.label}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', lineHeight: 1.4, marginBottom: 6 }}>{top.desc}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, background: top.color, color: '#fff', borderRadius: 4, padding: '2px 6px' }}>Fin: {top.financia}</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: top.color, color: '#fff', borderRadius: 4, padding: '2px 6px' }}>Gest: {top.gestiona}</span>
              <span style={{ fontSize: 9, fontWeight: 600, background: 'var(--gray-100)', color: 'var(--gray-600)', borderRadius: 4, padding: '2px 6px' }}>{top.contrato}</span>
            </div>
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
            <div style={{ width: 30, height: 30, borderRadius: 6, background: r.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 800, textAlign: 'center', lineHeight: 1.25 }}>
              {r.id}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)' }}>{r.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--gray-400)' }}>{abbrev(r.contrato)}</span>
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
        Criterio de adjudicación: costo efectivo (común a todos los clusters). Selecciona un cluster para ver requisitos e implicancias.
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
export default function ModelosSondajes() {
  const [inp, setInp]               = useState<SondajesInputs>(INIT)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filled  = useMemo(() => Object.values(inp).every(v => v !== ''), [inp])
  const count   = useMemo(() => Object.values(inp).filter(v => v !== '').length, [inp])
  const scores  = useMemo(() => (filled ? calcScores(inp) : null), [inp, filled])
  const results: ClusterResult[] | null = scores ? CLUSTERS.map((c, i) => ({ ...c, pct: scores[i] })) : null

  const selectedCluster = results?.find(r => r.id === selectedId) ?? null

  const set = (k: keyof SondajesInputs, v: string) => {
    setInp(prev => ({ ...prev, [k]: v }))
    setSelectedId(null)
  }

  return (
    <>
      <PageHeader
        title="Modelos Productivos — Sondajes"
        subtitle="Clasificador de proyectos por cluster · 4 clusters según variables del proyecto"
        icon="🔩"
      />
      <div className="page">
        <div className="two-col" style={{ alignItems: 'start' }}>
          <div className="panel">
            <h2>Variables del Proyecto</h2>
            <RadioGroup label="1. Nivel de incertidumbre" value={inp.incertidumbre} onChange={v => set('incertidumbre', v)}
              options={[
                { value: 'baja_media', label: 'Baja a media' },
                { value: 'media',      label: 'Media' },
                { value: 'alta',       label: 'Alta' },
              ]}
            />
            <RadioGroup
              label="2. Variabilidad del plan de perforación"
              hint="'Depende del proyecto' activa clasificación S-4 Especial"
              value={inp.variabilidad}
              onChange={v => set('variabilidad', v)}
              options={[
                { value: 'acotada',     label: 'Acotada' },
                { value: 'media',       label: 'Media' },
                { value: 'extendida',   label: 'Extendida' },
                { value: 'dependiente', label: 'Depende del proyecto' },
              ]}
            />
            <RadioGroup
              label="3. Meta especificada"
              hint="'Producto especializado' activa clasificación S-4 Especial"
              value={inp.meta}
              onChange={v => set('meta', v)}
              options={[
                { value: 'metros_plazos',            label: 'Metros / plazos / disponibilidad' },
                { value: 'disponibilidad_variables', label: 'Disponibilidad y variables operacionales' },
                { value: 'producto_especializado',   label: 'Producto especializado' },
              ]}
            />
            <RadioGroup label="4. Tipo de contrato" value={inp.tipo_contrato} onChange={v => set('tipo_contrato', v)}
              options={[
                { value: 'precio_fijo',       label: 'Precio fijo con incentivo' },
                { value: 'tiempo_materiales', label: 'Tiempo y materiales' },
              ]}
            />
            <RadioGroup label="5. Relación con comunidades" value={inp.comunidades} onChange={v => set('comunidades', v)}
              options={[
                { value: 'menor_esfuerzo', label: 'Menor esfuerzo' },
                { value: 'mayor_esfuerzo', label: 'Mayor esfuerzo' },
                { value: 'depende',        label: 'Depende del proyecto' },
              ]}
            />
            {filled
              ? <button className="btn-ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => { setInp(INIT); setSelectedId(null) }}>Reiniciar</button>
              : <ProgressDots filled={count} total={5} />
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
                  Completa las 5 variables para ver<br />la recomendación de cluster.
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedCluster && (
          <ClusterRequirementsPanel
            cluster={selectedCluster}
            modulo="Sondajes"
            onDeselect={() => setSelectedId(null)}
          />
        )}
      </div>
    </>
  )
}
