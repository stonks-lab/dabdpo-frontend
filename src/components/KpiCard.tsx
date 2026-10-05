const COLOR_MAP: Record<string, string> = {
  blue:   'var(--navy-400)',
  green:  'var(--success-500)',
  red:    'var(--error-500)',
  yellow: '#d97706',
  orange: '#ea580c',
  purple: '#7c3aed',
  gold:   'var(--gold-500)',
}

interface Props {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple' | 'gold'
  icon?: string
  onClick?: () => void
}

export default function KpiCard({ label, value, sub, color = 'blue', icon, onClick }: Props) {
  const borderColor = COLOR_MAP[color] ?? COLOR_MAP.blue

  // Si el valor sigue el patrón "$número unidad" (ej. "$1.2 Miles M CLP"),
  // muestra el número en grande y la unidad en pequeño debajo.
  const valStr = value != null ? String(value) : '—'
  const split  = valStr.match(/^(\$[\d.,]+)\s(.+)$/)

  return (
    <div
      className="kpi-card"
      style={{ borderLeftColor: borderColor, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <span>{label}</span>
      {split ? (
        <strong style={{ color: borderColor }}>
          {split[1]}
          <em style={{ display: 'block', fontSize: 11, fontWeight: 600, fontStyle: 'normal',
                        color: 'var(--gray-400)', letterSpacing: '.2px', marginTop: 2, lineHeight: 1 }}>
            {split[2]}
          </em>
        </strong>
      ) : (
        <strong style={{ color: borderColor }}>{valStr}</strong>
      )}
      {sub  && <small>{sub}</small>}
      {icon && <small style={{ fontSize: 18, marginTop: 4, display: 'block', lineHeight: 1 }}>{icon}</small>}
    </div>
  )
}
