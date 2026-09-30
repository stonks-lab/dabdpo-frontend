interface Props {
  label: string
  value: string | number
  sub?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple'
  icon?: string
}

const C = {
  blue:   { top: 'border-t-blue-500',    ib: 'bg-blue-50',    it: 'text-blue-500' },
  green:  { top: 'border-t-emerald-500', ib: 'bg-emerald-50', it: 'text-emerald-600' },
  red:    { top: 'border-t-red-500',     ib: 'bg-red-50',     it: 'text-red-500' },
  yellow: { top: 'border-t-amber-400',   ib: 'bg-amber-50',   it: 'text-amber-600' },
  orange: { top: 'border-t-orange-500',  ib: 'bg-orange-50',  it: 'text-orange-500' },
  purple: { top: 'border-t-violet-500',  ib: 'bg-violet-50',  it: 'text-violet-600' },
}

export default function KpiCard({ label, value, sub, color = 'blue', icon }: Props) {
  const s = C[color]
  return (
    <div className={`bg-white rounded-xl shadow-sm border-t-4 ${s.top} p-4 hover:shadow-md transition-shadow duration-150`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none">{label}</p>
          <p className="text-[1.55rem] font-bold text-gray-800 mt-1.5 leading-none tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">{sub}</p>}
        </div>
        {icon && (
          <div className={`shrink-0 w-9 h-9 rounded-lg ${s.ib} flex items-center justify-center text-base ${s.it}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
