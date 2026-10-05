import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  icon?: string
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, icon, actions }: Props) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && <span className="page-header-icon">{icon}</span>}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>}
      </div>
    </div>
  )
}
