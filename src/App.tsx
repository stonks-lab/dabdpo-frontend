import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import SaldoContratos from './pages/SaldoContratos'
import Licitaciones from './pages/Licitaciones'
import Alertas from './pages/Alertas'
import Proyecciones from './pages/Proyecciones'
import Placeholder from './pages/Placeholder'
import AnalisisProyecto from './pages/AnalisisProyecto'
import SourcingPlan from './pages/SourcingPlan'
import CargaDatos from './pages/CargaDatos'
import EstadoProyectos from './pages/EstadoProyectos'
import MetrosPerforados from './pages/MetrosPerforados'
import Modificaciones from './pages/Modificaciones'
import DashboardDPO from './pages/DashboardDPO'
import SolpeTiempos from './pages/SolpeTiempos'
import Simulacion from './pages/Simulacion'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index                element={<Home />} />
          <Route path="saldo"         element={<SaldoContratos />} />
          <Route path="proyecciones"  element={<Proyecciones />} />
          <Route path="analisis"      element={<AnalisisProyecto />} />
          <Route path="sourcing"      element={<SourcingPlan />} />
          <Route path="licitaciones"  element={<Licitaciones />} />
          <Route path="alertas"       element={<Alertas />} />
          <Route path="simulacion"    element={<Simulacion />} />
          <Route path="carga"            element={<CargaDatos />} />
          <Route path="estado-proyectos"  element={<EstadoProyectos />} />
          <Route path="metros"            element={<MetrosPerforados />} />
          <Route path="modificaciones"    element={<Modificaciones />} />
          <Route path="dashboard-dpo"     element={<DashboardDPO />} />
          <Route path="dashboard-dab"    element={<SolpeTiempos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
