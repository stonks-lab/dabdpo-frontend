import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'

type TabId = 'sondajes' | 'campamento' | 'mt'

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
interface MTInputs {
  terreno:     '' | 'blando' | 'semiduro' | 'roca'
  complejidad: '' | 'simple' | 'medio' | 'complejo'
  escala:      '' | 'pequena' | 'media' | 'grande'
  altura:      '' | 'baja' | 'alta'
  actividades: '' | 'mantencion' | 'apertura' | 'masiva'
  presupuesto: '' | 'bajo' | 'medio' | 'alto'
  stack:       '' | 'basico' | 'estandar' | 'completo'
}

const CAMP_INIT: CampInputs = { duracion: '', lejania: '', altitud: '', dotacion: '', acceso: '', clima: '', presupuesto: '' }
const MT_INIT: MTInputs     = { terreno: '', complejidad: '', escala: '', altura: '', actividades: '', presupuesto: '', stack: '' }

// ─── Cluster definitions ──────────────────────────────────────────────────────
interface ClusterDef { id: string; label: string; color: string; tarifa: string; desc: string }

const CAMP_CLUSTERS: ClusterDef[] = [
  { id: 'C1', label: 'Express',          color: '#4763A0', tarifa: '1.0×', desc: 'Corta duración, dotación pequeña, cercano. Sin costo fijo — pago por día-cama efectivo.' },
  { id: 'C2', label: 'Estándar',         color: '#2a9d8f', tarifa: '1.3×', desc: 'Duración media, condiciones variables, altitud baja. Costo fijo/mes + variable por ración.' },
  { id: 'C3', label: 'Alta Montaña',     color: '#BB813A', tarifa: '1.8×', desc: 'Variable DOMINANTE: >3.500 msnm. Requiere examen médico, aclimatación y plan de evacuación.' },
  { id: 'C4', label: 'Base Establecida', color: '#e76f51', tarifa: '1.5×', desc: 'Larga duración, dotación pequeña, lejano. Módulos permanentes con incentivo por extensión.' },
  { id: 'C5', label: 'Gran Escala',      color: '#6a4c93', tarifa: '2.0×', desc: 'Larga duración, dotación grande, lejano. Tarifa premium con SLA automático y penalidades.' },
]

const MT_CLUSTERS: ClusterDef[] = [
  { id: 'C1', label: 'Mantención',      color: '#4763A0', tarifa: '0.7×',  desc: 'Solo mantención de caminos existentes. Pago $/metro mantenido, sin movilización fija.' },
  { id: 'C2', label: 'Hab. Estándar',   color: '#2a9d8f', tarifa: '1.0×',  desc: 'Terreno blando/semiduro, complejidad simple. Pago $/metro lineal + $/m² plataforma.' },
  { id: 'C3', label: 'T. Complejo',     color: '#e76f51', tarifa: '1.3×',  desc: 'Terreno duro o roca, alta complejidad. Tarifa diferenciada + plan de manejo de roca.' },
  { id: 'C4', label: 'Alta Montaña ↑',  color: '#BB813A', tarifa: '+0.3×', desc: 'OVERLAY >3.500 msnm — se suma al cluster base. Suplemento fijo/mes, rendimientos ajustados.' },
  { id: 'C5', label: 'Gran Escala',     color: '#6a4c93', tarifa: '1.6×',  desc: 'Habilitación masiva, escala grande. Precio objetivo NEC Opción C con bonus por hitos.' },
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

function calcCamp(i: CampInputs): number[] {
  const s = [0, 0, 0, 0, 0]
  // Altitud — dominante
  if (i.altitud === 'alta') s[2] += 1000
  else                      { s[0] += 5; s[1] += 5; s[3] += 5; s[4] += 5 }
  // Duración
  if      (i.duracion === 'corta') { s[0] += 30; s[1] += 5 }
  else if (i.duracion === 'media') { s[0] += 5; s[1] += 30; s[3] += 10; s[4] += 5 }
  else if (i.duracion === 'larga') { s[1] += 10; s[3] += 30; s[4] += 30 }
  // Dotación
  if      (i.dotacion === 'pequena') { s[0] += 20; s[1] += 15; s[3] += 20 }
  else if (i.dotacion === 'grande')  { s[1] += 5; s[4] += 30 }
  // Lejanía
  if      (i.lejania === 'cercano') { s[0] += 20; s[1] += 10 }
  else if (i.lejania === 'lejano')  { s[1] += 10; s[3] += 20; s[4] += 20 }
  // Acceso
  if      (i.acceso === 'simple')     { s[0] += 10; s[1] += 8 }
  else if (i.acceso === 'complicado') { s[1] += 5; s[3] += 10; s[4] += 10 }
  // Clima
  if      (i.clima === 'seco')     { s[0] += 10; s[1] += 7 }
  else if (i.clima === 'lluvioso') { s[1] += 7; s[3] += 10; s[4] += 10 }
  // Presupuesto
  if      (i.presupuesto === 'bajo')  { s[0] += 15; s[1] += 5 }
  else if (i.presupuesto === 'medio') { s[0] += 5; s[1] += 15; s[3] += 5 }
  else if (i.presupuesto === 'alto')  { s[1] += 5; s[3] += 15; s[4] += 20 }
  return normalize(s)
}

function calcMT(i: MTInputs): number[] {
  const s = [0, 0, 0, 0, 0]
  // Altura — overlay C4
  if      (i.altura === 'alta') s[3] += 100
  else                          { s[0] += 5; s[1] += 5; s[2] += 5; s[4] += 5 }
  // Terreno
  if      (i.terreno === 'blando')   { s[0] += 5; s[1] += 25; s[4] += 10 }
  else if (i.terreno === 'semiduro') { s[0] += 5; s[1] += 15; s[2] += 10; s[4] += 10 }
  else if (i.terreno === 'roca')     { s[2] += 30; s[4] += 10 }
  // Complejidad
  if      (i.complejidad === 'simple')   { s[0] += 25; s[1] += 20; s[4] += 10 }
  else if (i.complejidad === 'medio')    { s[0] += 10; s[1] += 15; s[2] += 10; s[4] += 10 }
  else if (i.complejidad === 'complejo') { s[2] += 25; s[4] += 15 }
  // Escala
  if      (i.escala === 'pequena') { s[0] += 20; s[1] += 15; s[2] += 15 }
  else if (i.escala === 'media')   { s[0] += 15; s[1] += 20; s[2] += 20; s[4] += 5 }
  else if (i.escala === 'grande')  { s[4] += 30 }
  // Actividades
  if      (i.actividades === 'mantencion') { s[0] += 30; s[1] += 5 }
  else if (i.actividades === 'apertura')   { s[0] += 5; s[1] += 25; s[2] += 20; s[4] += 5 }
  else if (i.actividades === 'masiva')     { s[2] += 10; s[4] += 30 }
  // Presupuesto
  if      (i.presupuesto === 'bajo')  { s[0] += 20; s[1] += 5 }
  else if (i.presupuesto === 'medio') { s[0] += 5; s[1] += 20; s[2] += 5; s[4] += 5 }
  else if (i.presupuesto === 'alto')  { s[2] += 20; s[4] += 20 }
  // Stack
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
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 13px', borderRadius: 99, border: '1px solid',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 100ms',
              ...(value === opt.value
                ? { background: 'var(--navy-500)', color: '#fff', borderColor: 'var(--navy-500)' }
                : { background: 'var(--gray-50)', color: 'var(--gray-500)', borderColor: 'var(--gray-200)' }),
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ClusterResult extends ClusterDef { pct: number }

function ResultPanel({ results, altaOverlay }: { results: ClusterResult[]; altaOverlay?: boolean }) {
  const sorted = [...results].sort((a, b) => b.pct - a.pct)
  const top = sorted[0]
  return (
    <div>
      {/* Recomendación principal */}
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
      </div>

      {/* Todos los clusters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: r.pct < 4 ? 0.3 : 1, transition: 'opacity 300ms' }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: r.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>
              {r.id}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-800)', minWidth: 38, textAlign: 'right' }}>{r.pct}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 4, transition: 'width 500ms ease' }} />
              </div>
            </div>
            <div style={{ width: 34, textAlign: 'right', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, flexShrink: 0 }}>
              {r.tarifa}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-100)', fontSize: 10, color: 'var(--gray-400)' }}>
        Tarifa base relativa (referencial). Los valores absolutos se definen en simulaciones de precio.
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

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-400)', lineHeight: 1.6 }}>{label}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ModelosProductivos() {
  const [tab,  setTab]  = useState<TabId>('campamento')
  const [camp, setCamp] = useState<CampInputs>(CAMP_INIT)
  const [mt,   setMT]   = useState<MTInputs>(MT_INIT)

  const campFilled = useMemo(() => Object.values(camp).every(v => v !== ''), [camp])
  const mtFilled   = useMemo(() => Object.values(mt).every(v => v !== ''),   [mt])
  const campCount  = useMemo(() => Object.values(camp).filter(v => v !== '').length, [camp])
  const mtCount    = useMemo(() => Object.values(mt).filter(v => v !== '').length,   [mt])

  const campScores = useMemo(() => (campFilled ? calcCamp(camp) : null), [camp, campFilled])
  const mtScores   = useMemo(() => (mtFilled   ? calcMT(mt)    : null), [mt,   mtFilled])

  const campResults: ClusterResult[] | null = campScores
    ? CAMP_CLUSTERS.map((c, i) => ({ ...c, pct: campScores[i] }))
    : null
  const mtResults: ClusterResult[] | null = mtScores
    ? MT_CLUSTERS.map((c, i) => ({ ...c, pct: mtScores[i] }))
    : null

  const setC = (k: keyof CampInputs, v: string) => setCamp(prev => ({ ...prev, [k]: v }))
  const setM = (k: keyof MTInputs,   v: string) => setMT(prev => ({ ...prev, [k]: v }))

  return (
    <>
      <PageHeader
        title="Modelos Productivos"
        subtitle="Clasificador de proyectos por cluster · Campamento y Movimiento de Tierra"
        icon="⚙️"
      />

      <div className="page">
        {/* Tab bar */}
        <div className="panel" style={{ padding: '8px 20px 0' }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab${tab === 'sondajes'   ? ' active' : ''}`} onClick={() => setTab('sondajes')}>Sondajes</button>
            <button className={`tab${tab === 'campamento' ? ' active' : ''}`} onClick={() => setTab('campamento')}>Campamento</button>
            <button className={`tab${tab === 'mt'         ? ' active' : ''}`} onClick={() => setTab('mt')}>Movimiento de Tierra</button>
          </div>
        </div>

        {/* Sondajes */}
        {tab === 'sondajes' && (
          <div className="panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>🔩</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-500)', marginBottom: 8 }}>
              Módulo Sondajes — En desarrollo
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', maxWidth: 360, margin: '0 auto' }}>
              El clasificador de clusters para proyectos de sondaje estará disponible próximamente.
            </div>
          </div>
        )}

        {/* Campamento */}
        {tab === 'campamento' && (
          <div className="two-col" style={{ alignItems: 'start' }}>
            <div className="panel">
              <h2>Variables del Proyecto</h2>
              <RadioGroup label="1. Duración del proyecto" value={camp.duracion} onChange={v => setC('duracion', v)}
                options={[
                  { value: 'corta', label: 'Corta (<6 meses)' },
                  { value: 'media', label: 'Media (6–12 meses)' },
                  { value: 'larga', label: 'Larga (>12 meses)' },
                ]}
              />
              <RadioGroup label="2. Lejanía a ciudad / servicios" value={camp.lejania} onChange={v => setC('lejania', v)}
                options={[
                  { value: 'cercano', label: 'Cercano (<2 h)' },
                  { value: 'lejano',  label: 'Lejano (>2 h)' },
                ]}
              />
              <RadioGroup
                label="3. Altitud"
                hint="Variable dominante — alta montaña (>3.500 msnm) se superpone a cualquier otro cluster"
                value={camp.altitud}
                onChange={v => setC('altitud', v)}
                options={[
                  { value: 'baja', label: 'Baja montaña (<3.500 msnm)' },
                  { value: 'alta', label: 'Alta montaña (>3.500 msnm) ▲' },
                ]}
              />
              <RadioGroup label="4. Tamaño de dotación" value={camp.dotacion} onChange={v => setC('dotacion', v)}
                options={[
                  { value: 'pequena', label: 'Pequeño (<50 personas)' },
                  { value: 'grande',  label: 'Grande (>50 personas)' },
                ]}
              />
              <RadioGroup label="5. Condiciones de acceso" value={camp.acceso} onChange={v => setC('acceso', v)}
                options={[
                  { value: 'simple',     label: 'Acceso simple' },
                  { value: 'complicado', label: 'Acceso complicado' },
                ]}
              />
              <RadioGroup label="6. Condiciones climáticas" value={camp.clima} onChange={v => setC('clima', v)}
                options={[
                  { value: 'seco',     label: 'Seco' },
                  { value: 'lluvioso', label: 'Lluvioso o nevoso' },
                ]}
              />
              <RadioGroup label="7. Presupuesto" value={camp.presupuesto} onChange={v => setC('presupuesto', v)}
                options={[
                  { value: 'bajo',  label: 'Bajo' },
                  { value: 'medio', label: 'Medio' },
                  { value: 'alto',  label: 'Alto' },
                ]}
              />
              {campFilled
                ? <button className="btn-ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => setCamp(CAMP_INIT)}>Reiniciar</button>
                : <ProgressDots filled={campCount} total={7} />
              }
            </div>

            <div className="panel">
              <h2>Clasificación por Cluster</h2>
              {campResults
                ? <ResultPanel results={campResults} />
                : <EmptyState icon="📋" label={`Completa las 7 variables para ver\nla recomendación de cluster.`} />
              }
            </div>
          </div>
        )}

        {/* Movimiento de Tierra */}
        {tab === 'mt' && (
          <div className="two-col" style={{ alignItems: 'start' }}>
            <div className="panel">
              <h2>Variables del Proyecto</h2>
              <RadioGroup label="1. Tipo de terreno" value={mt.terreno} onChange={v => setM('terreno', v)}
                options={[
                  { value: 'blando',   label: 'Blando (arcilla/arena)' },
                  { value: 'semiduro', label: 'Semiduro' },
                  { value: 'roca',     label: 'Roca meteorizada o dura' },
                ]}
              />
              <RadioGroup
                label="2. Complejidad del camino"
                hint="Simple: amplio y plano (Divisional) · Medio: algo de pendiente · Complejo: estrecho, alta pendiente, quebrada"
                value={mt.complejidad}
                onChange={v => setM('complejidad', v)}
                options={[
                  { value: 'simple',   label: 'Simple' },
                  { value: 'medio',    label: 'Medio' },
                  { value: 'complejo', label: 'Complejo' },
                ]}
              />
              <RadioGroup label="3. Escala de obras" value={mt.escala} onChange={v => setM('escala', v)}
                options={[
                  { value: 'pequena', label: 'Pequeña (<5 km / ≤3 plat.)' },
                  { value: 'media',   label: 'Media (5–20 km / 3–10 plat.)' },
                  { value: 'grande',  label: 'Grande (>20 km / >10 plat.)' },
                ]}
              />
              <RadioGroup
                label="4. Altura geográfica"
                hint="Alta montaña actúa como overlay sobre cualquier cluster base — aplica suplemento de tarifa adicional"
                value={mt.altura}
                onChange={v => setM('altura', v)}
                options={[
                  { value: 'baja', label: 'Baja montaña (<3.500 msnm)' },
                  { value: 'alta', label: 'Alta montaña (>3.500 msnm) ▲' },
                ]}
              />
              <RadioGroup label="5. Tipo de actividades" value={mt.actividades} onChange={v => setM('actividades', v)}
                options={[
                  { value: 'mantencion', label: 'Solo mantención' },
                  { value: 'apertura',   label: 'Apertura + mantención' },
                  { value: 'masiva',     label: 'Habilitación masiva' },
                ]}
              />
              <RadioGroup label="6. Presupuesto" value={mt.presupuesto} onChange={v => setM('presupuesto', v)}
                options={[
                  { value: 'bajo',  label: 'Bajo' },
                  { value: 'medio', label: 'Medio' },
                  { value: 'alto',  label: 'Alto' },
                ]}
              />
              <RadioGroup
                label="7. Stack tecnológico"
                hint="Básico: Motoniveladora+Aljibe · Estándar: +Machine Control 3D · Completo: +LIDAR+BIM"
                value={mt.stack}
                onChange={v => setM('stack', v)}
                options={[
                  { value: 'basico',   label: 'Básico' },
                  { value: 'estandar', label: 'Estándar (MC3D)' },
                  { value: 'completo', label: 'Completo (LIDAR+BIM+MC3D)' },
                ]}
              />
              {mtFilled
                ? <button className="btn-ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => setMT(MT_INIT)}>Reiniciar</button>
                : <ProgressDots filled={mtCount} total={7} />
              }
            </div>

            <div className="panel">
              <h2>Clasificación por Cluster</h2>
              {mtResults
                ? <ResultPanel results={mtResults} altaOverlay={mt.altura === 'alta'} />
                : <EmptyState icon="🏗️" label={`Completa las 7 variables para ver\nla recomendación de cluster.`} />
              }
            </div>
          </div>
        )}
      </div>
    </>
  )
}
