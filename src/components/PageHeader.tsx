import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  icon?: string
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, icon, actions }: Props) {
  return (
    <div className="bg-gradient-to-r from-[#0f1e42] via-[#1a3476] to-[#1e40af] text-white px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <span className="text-2xl opacity-80 select-none">{icon}</span>}
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">{title}</h1>
            {subtitle && <p className="text-blue-200 text-[12px] mt-0.5 font-medium leading-none">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
