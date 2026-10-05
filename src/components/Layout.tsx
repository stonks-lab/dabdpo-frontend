import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

import type { ReactElement } from 'react'

type Section = { section: string }
type Item    = { to: string; label: string; icon: ReactElement }
type Entry   = Section | Item

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const IconWallet = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
)
const IconTrend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
)
const IconMicroscope = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h.01"/><path d="M9 6l.5 6"/><path d="M13 6l-.5 6"/>
  </svg>
)
const IconMap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconDrill = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
)
const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const IconMonday = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
)
const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const NAV: Entry[] = [
  { section: 'Home' },
  { to: '/',             label: 'Resumen Ejecutivo',  icon: <IconGrid /> },
  { section: 'Estrategia' },
  { to: '/saldo',        label: 'Saldo Contratos',    icon: <IconWallet /> },
  { to: '/proyecciones', label: 'Proyecciones P&C',   icon: <IconTrend /> },
  { to: '/analisis',     label: 'Por Proyecto',       icon: <IconMicroscope /> },
  { to: '/sourcing',     label: 'Sourcing Plan',      icon: <IconMap /> },
  { to: '/simulacion',   label: 'Simulación',         icon: <IconSettings /> },
  { section: 'Operatividad' },
  { to: '/estado-proyectos', label: 'Estado Proyectos',  icon: <IconWarning /> },
  { to: '/metros',           label: 'Metros Perforados', icon: <IconDrill /> },
  { to: '/alertas',          label: 'Alertas',           icon: <IconBell /> },
  { section: 'DAB' },
  { to: '/licitaciones',   label: 'Licitaciones',    icon: <IconList /> },
  { to: '/dashboard-dab',  label: 'Dashboard DAB',   icon: <IconClock /> },
  { to: '/modificaciones', label: 'Modificaciones',  icon: <IconMonday /> },
  { section: 'DPO' },
  { to: '/dashboard-dpo',  label: 'Dashboard DPO',   icon: <IconDashboard /> },
  { section: 'Administración' },
  { to: '/carga',          label: 'Carga de Datos',  icon: <IconUpload /> },
]

// Agrupa el NAV en secciones: [{ section, items }]
function buildSections() {
  const sections: { section: string; items: Item[] }[] = []
  let current: { section: string; items: Item[] } | null = null
  for (const entry of NAV) {
    if ('section' in entry) {
      current = { section: entry.section, items: [] }
      sections.push(current)
    } else if (current) {
      current.items.push(entry as Item)
    }
  }
  return sections
}

const SECTIONS = buildSections()

function activeSection(pathname: string): string {
  for (const s of SECTIONS) {
    if (s.items.some(it => it.to === '/' ? pathname === '/' : pathname.startsWith(it.to))) {
      return s.section
    }
  }
  return ''
}

export default function Layout() {
  const location = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const active = activeSection(location.pathname)
    return Object.fromEntries(SECTIONS.map(s => [s.section, s.section === active]))
  })

  // Abre automáticamente la sección activa al navegar
  useEffect(() => {
    const active = activeSection(location.pathname)
    if (active) setOpen(prev => ({ ...prev, [active]: true }))
  }, [location.pathname])

  const toggle = (section: string) =>
    setOpen(prev => ({ ...prev, [section]: !prev[section] }))

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <img src="/logo-emsa-light.svg" className="topbar-logo" alt="EMSA" />
        <div className="topbar-divider" />
        <div>
          <div className="topbar-title">Tablero DAB-DPO</div>
          <div className="topbar-subtitle">Contratos &amp; Proyectos · EMSA</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="topbar-badge">DAB-DPO</span>
        <div className="topbar-status">
          <span className="topbar-dot" />
          En línea
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar */}
        <nav className="sidebar">
          {SECTIONS.map(({ section, items }) => (
            <div key={section}>
              {/* Sección colapsable */}
              <button
                onClick={() => toggle(section)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '6px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
                className="sidebar-label"
              >
                <span>{section}</span>
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  style={{
                    transition: 'transform 0.2s',
                    transform: open[section] ? 'rotate(180deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                  }}
                >
                  <polyline points="2 3 5 7 8 3" />
                </svg>
              </button>

              {/* Items */}
              {open[section] && items.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  {icon}
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
