export interface ModuloDef {
  id: string
  label: string
  rutas: string[]
}

export const MODULOS: ModuloDef[] = [
  {
    id: 'home',
    label: 'Home',
    rutas: ['/'],
  },
  {
    id: 'estrategia',
    label: 'Estrategia',
    rutas: ['/saldo', '/proyecciones', '/analisis', '/sourcing', '/simulacion'],
  },
  {
    id: 'operatividad',
    label: 'Operatividad',
    rutas: ['/estado-proyectos', '/metros', '/alertas'],
  },
  {
    id: 'dab',
    label: 'DAB',
    rutas: ['/licitaciones', '/dashboard-dab', '/modificaciones'],
  },
  {
    id: 'dpo',
    label: 'DPO',
    rutas: ['/dashboard-dpo'],
  },
  {
    id: 'administracion',
    label: 'Administración',
    rutas: ['/carga'],
  },
]

export function moduloPorRuta(ruta: string): ModuloDef | undefined {
  return MODULOS.find(m => m.rutas.includes(ruta))
}
