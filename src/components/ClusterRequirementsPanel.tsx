import type { ReactNode } from 'react'

export interface ClusterReqs {
  id: string
  label: string
  color: string
  contrato: string
  kpis: string[]
  requisitos_mandante: string[]
  docs_base: string[]
  financia?: string
  gestiona?: string
  notas?: string
}

function Section({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.5px', color,
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5
      }}>
        <div style={{ width: 3, height: 12, background: color, borderRadius: 2, flexShrink: 0 }} />
        {title}
      </div>
      {children}
    </div>
  )
}

interface Props {
  cluster: ClusterReqs
  modulo: string
  onDeselect: () => void
}

export function ClusterRequirementsPanel({ cluster, modulo, onDeselect }: Props) {
  return (
    <div className="panel">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 10, background: cluster.color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 9, fontWeight: 800, textAlign: 'center', lineHeight: 1.2,
        }}>
          {cluster.id}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '.5px', marginBottom: 3 }}>
            MODELO SELECCIONADO · {modulo.toUpperCase()}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-900)' }}>{cluster.label}</div>
        </div>
        <button
          onClick={onDeselect}
          style={{
            fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', background: 'none',
            border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 12px',
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          Cambiar selección
        </button>
      </div>

      {/* Body grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 28px' }}>
        <div>
          <Section title="TIPO DE CONTRATO" color={cluster.color}>
            <p style={{ fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.55, margin: 0 }}>{cluster.contrato}</p>
            {cluster.financia && (
              <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 5, marginBottom: 0 }}>
                Financiamiento: <strong style={{ color: 'var(--gray-700)' }}>{cluster.financia}</strong>
                {' · '}Gestión: <strong style={{ color: 'var(--gray-700)' }}>{cluster.gestiona}</strong>
              </p>
            )}
          </Section>
          <Section title="KPIs DE SEGUIMIENTO" color={cluster.color}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {cluster.kpis.map((k, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 3, lineHeight: 1.45 }}>{k}</li>
              ))}
            </ul>
          </Section>
        </div>
        <div>
          <Section title="REQUISITOS DEL MANDANTE" color={cluster.color}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {cluster.requisitos_mandante.map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 3, lineHeight: 1.45 }}>{r}</li>
              ))}
            </ul>
          </Section>
          <Section title="DOCUMENTOS BASE REQUERIDOS" color={cluster.color}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {cluster.docs_base.map((d, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--gray-700)', marginBottom: 3, lineHeight: 1.45 }}>{d}</li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {cluster.notas && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'var(--navy-50)', border: '1px solid var(--navy-100)',
          borderRadius: 6, fontSize: 11, color: 'var(--navy-600)', lineHeight: 1.5,
        }}>
          <strong>Nota:</strong> {cluster.notas}
        </div>
      )}

      {/* CTA */}
      <div style={{
        marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
          Siguiente paso: redactar las bases técnicas de licitación para este modelo.
        </div>
        <button
          disabled
          title="Integración con plataforma de bases técnicas — próximamente"
          style={{
            padding: '8px 20px', borderRadius: 8,
            border: '1px solid var(--gray-300)', background: 'var(--gray-100)',
            color: 'var(--gray-400)', fontSize: 12, fontWeight: 600,
            cursor: 'not-allowed', fontFamily: 'inherit',
          }}
        >
          Preparar bases técnicas ↗
        </button>
      </div>
    </div>
  )
}
