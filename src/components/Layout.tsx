import { NavLink, Outlet } from 'react-router-dom'

type Section = { section: string }
type Item    = { to: string; label: string; icon: string }
type Entry   = Section | Item

const NAV: Entry[] = [
  { section: 'Financiero' },
  { to: '/',             label: 'Resumen Ejecutivo',  icon: '📊' },
  { to: '/saldo',        label: 'Saldo Contratos',    icon: '💰' },
  { to: '/proyecciones', label: 'Proyecciones P&C',   icon: '📈' },
  { section: 'Análisis' },
  { to: '/analisis',     label: 'Por Proyecto',       icon: '🔬' },
  { to: '/sourcing',     label: 'Sourcing Plan',      icon: '🗺️' },
  { section: 'Proyectos' },
  { to: '/estado-proyectos', label: 'Estado Proyectos',   icon: '⚠️' },
  { to: '/metros',           label: 'Metros Perforados',  icon: '⛏️' },
  { section: 'Gestión' },
  { to: '/licitaciones', label: 'Licitaciones',       icon: '📋' },
  { to: '/alertas',      label: 'Alertas',            icon: '🚨' },
  { to: '/simulacion',   label: 'Simulación',         icon: '⚙️' },
  { section: 'Administración' },
  { to: '/carga',        label: 'Carga de Datos',     icon: '⬆️' },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col" style={{ background: '#0a1628' }}>
        {/* Brand */}
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              E
            </div>
            <div className="leading-none">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-400">EMSA · DAB-DPO</p>
              <p className="text-[13px] font-bold text-white mt-0.5">Tablero Integrado</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-px">
          {NAV.map((entry, i) => {
            if ('section' in entry) {
              return (
                <p key={i} className="px-3 pt-4 pb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-blue-400/50 select-none first:pt-2">
                  {entry.section}
                </p>
              )
            }
            const { to, label, icon } = entry as Item
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-900/40'
                      : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                  }`
                }
              >
                <span className="text-[15px] w-5 text-center select-none">{icon}</span>
                <span className="leading-none">{label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-[11px] text-slate-400">En línea · {new Date().getFullYear()}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-100">
        <Outlet />
      </main>
    </div>
  )
}
