import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  paramsSerializer: { indexes: null },  // arrays como clave repetida: arr=a&arr=b (formato FastAPI)
})

export const getHomeKpis    = (p?: object) => api.get('/home/kpis',        { params: p }).then(r => r.data)
export const getHomeFiltros = ()           => api.get('/home/filtros').then(r => r.data)
export const getEpPorMes    = (p?: object) => api.get('/home/ep-por-mes',  { params: p }).then(r => r.data)
export const getEpPorTipo   = (p?: object) => api.get('/home/ep-por-tipo', { params: p }).then(r => r.data)

export const getSaldoKpis      = ()           => api.get('/saldo/kpis').then(r => r.data)
export const getSaldoFiltros   = ()           => api.get('/saldo/filtros').then(r => r.data)
export const getContratos      = (p: object)  => api.get('/saldo/contratos', { params: p }).then(r => r.data)
export const getSaldoEvolucion = ()           => api.get('/saldo/evolucion').then(r => r.data)
export const getSaldoTimeline  = (p?: object) => api.get('/saldo/timeline',  { params: p }).then(r => r.data)

export const getLicitKpis        = ()      => api.get('/licitaciones/kpis').then(r => r.data)
export const getLicitPorEstado   = ()      => api.get('/licitaciones/por-estado').then(r => r.data)
export const getLicitPorAnio     = ()      => api.get('/licitaciones/por-anio').then(r => r.data)
export const getLicitTabla       = (p: object) => api.get('/licitaciones/tabla', { params: p }).then(r => r.data)
export const getLicitProcesosKpis = ()    => api.get('/licitaciones/procesos/kpis').then(r => r.data)
export const getLicitProcesos    = (p?: object) => api.get('/licitaciones/procesos', { params: p }).then(r => r.data)
export const getLicitProcesoDetalle  = (proceso: string) => api.get('/licitaciones/procesos/detalle', { params: { proceso } }).then(r => r.data)
export const getLicitAllSubelementos = ()                => api.get('/licitaciones/procesos/subelementos').then(r => r.data)

export const getAlertasKpis      = ()           => api.get('/alertas/kpis').then(r => r.data)
export const getAlertasFiltros   = ()           => api.get('/alertas/filtros').then(r => r.data)
export const getAlertasContratos = (p?: object) => api.get('/alertas/contratos', { params: p }).then(r => r.data)
export const getAlertasBoletas   = (p?: object) => api.get('/alertas/boletas',   { params: p }).then(r => r.data)

export const getAnalisisKpis          = ()            => api.get('/analisis/kpis').then(r => r.data)
export const getAnalisisPorProyecto   = ()            => api.get('/analisis/por-proyecto').then(r => r.data)
export const getAnalisisTabla         = (p: object)   => api.get('/analisis/tabla', { params: p }).then(r => r.data)

export const getPycTimeline            = (p?: object) => api.get('/proyecciones/timeline',    { params: p }).then(r => r.data)
export const getPycComparacion         = (p?: object) => api.get('/proyecciones/comparacion', { params: p }).then(r => r.data)

export const getSourcingKpis             = ()  => api.get('/sourcing/kpis').then(r => r.data)
export const getSourcingTabla            = ()  => api.get('/sourcing/tabla').then(r => r.data)
export const getSourcingCoberturaMetros  = ()  => api.get('/sourcing/cobertura-metros').then(r => r.data)
export const getSourcingCoberturaDetalle = (mes: string, cubierto: boolean) =>
  api.get('/sourcing/cobertura-detalle', { params: { mes, cubierto: cubierto ? 1 : 0 } }).then(r => r.data)

export const uploadProyeccionesPyC = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/proyecciones-pyc', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}

export const uploadDimensiones = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/dimensiones', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}

export const getIncidencias               = () => api.get('/estado-proyectos/incidencias').then(r => r.data)
export const getEstadoProyectosResumen    = (p?: object) => api.get('/estado-proyectos/resumen',        { params: p }).then(r => r.data)
export const getEstadoProyectosTimeline   = (p?: object) => api.get('/estado-proyectos/saldo-timeline', { params: p }).then(r => r.data)

export const getMetrosPai               = (ano?: number, version?: string) => api.get('/metros/pai', { params: { ano, version } }).then(r => r.data)
export const getMetrosPaiVersiones      = () => api.get('/metros/pai/versiones').then(r => r.data)
export const getMetrosAvance            = () => api.get('/metros/avance').then(r => r.data)
export const getPresupuestoAnos         = () => api.get('/metros/presupuesto-anos').then(r => r.data)
export const getPresupuestoPerforacion  = (ano?: number) => api.get('/metros/presupuesto-perforacion', { params: { ano } }).then(r => r.data)
export const getCurvaS                  = (tipo = 'all', ano?: number) => api.get('/metros/curva-s', { params: { tipo, ano } }).then(r => r.data)

export const getDpoProyectosInicio  = (fechaDesde?: string, fechaHasta?: string) =>
  api.get('/dpo/proyectos-inicio', {
    params: { fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined },
  }).then(r => r.data)

export const getDpoCostoMetro       = ()              => api.get('/dpo/costo-metro').then(r => r.data)
export const getDpoCostoMetroUltimo = (p?: object)    => api.get('/dpo/costo-metro', { params: p }).then(r => r.data.ultimo)
export const getDpoMesesCargados    = ()              => api.get('/dpo/costo-metro/meses').then(r => r.data)
export const deleteDpoCostoMetroMes = (anio: number, mes: number) => api.delete(`/dpo/costo-metro/${anio}/${mes}`).then(r => r.data)
export const getDpoConfig           = ()                          => api.get('/dpo/config').then(r => r.data)
export const saveDpoConfig          = (body: object, usuario = '') => api.post('/dpo/config', body, { params: { usuario } }).then(r => r.data)

export const uploadCostoMetro = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/costo-metro', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}

export const getRegistroCargas    = () => api.get('/upload/registro').then(r => r.data)
export const getFuentesExternas   = () => api.get('/upload/fuentes-externas').then(r => r.data)

export const getHomeCampanaProyectos = (campana: string) => api.get('/home/campana-proyectos', { params: { campana } }).then(r => r.data)

export const getSolpeTiempos          = ()      => api.get('/licitaciones/tiempos').then(r => r.data)
export const getLicitAdjudicacionKpis    = (p?: object) => api.get('/licitaciones/adjudicacion-kpis',    { params: p }).then(r => r.data)
export const getLicitGestionProveedores  = (p?: object) => api.get('/licitaciones/gestion-proveedores', { params: p }).then(r => r.data)
export const getLicitAdjudicacionDetalle = (p?: object) => api.get('/licitaciones/adjudicacion-detalle', { params: p }).then(r => r.data)
export const getLicitGestionDetalle      = (p?: object) => api.get('/licitaciones/gestion-proveedores-detalle', { params: p }).then(r => r.data)

export const getMondayKpis      = ()           => api.get('/monday/kpis').then(r => r.data)
export const getMondayTabla     = (p: object)  => api.get('/monday/tabla', { params: p }).then(r => r.data)
export const getMondayFiltros   = ()           => api.get('/monday/filtros').then(r => r.data)
export const getMondayTendencia      = () => api.get('/monday/tendencia').then(r => r.data)
export const getMondayTendenciaRazones = (p?: object) => api.get('/monday/tendencia-razones', { params: p }).then(r => r.data)

export const getSimulacionLista       = ()              => api.get('/simulacion/lista').then(r => r.data)
export const getSimulacionProyectos   = ()              => api.get('/simulacion/datos/proyectos').then(r => r.data)
export const getSimulacionVendorCodes = (proyectos: string[]) => api.get('/simulacion/datos/vendor-codes', { params: { proyectos } }).then(r => r.data)
export const getSimulacionContratos   = ()              => api.get('/simulacion/datos/contratos').then(r => r.data)
export const getSimulacion            = (id: number)    => api.get(`/simulacion/${id}`).then(r => r.data)
export const guardarSimulacion        = (body: object)  => api.post('/simulacion/guardar', body).then(r => r.data)
export const eliminarSimulacion       = (id: number)    => api.delete(`/simulacion/${id}`).then(r => r.data)

export const uploadProyeccionesAdC = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/proyecciones-adc', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}

export const getEpKpis           = (p?: object) => api.get('/ep/kpis',      { params: p }).then(r => r.data)
export const getEpFiltros        = ()           => api.get('/ep/filtros').then(r => r.data)
export const getEpTabla          = (p?: object) => api.get('/ep/tabla',     { params: p }).then(r => r.data)
export const getEpTimeline       = (p?: object) => api.get('/ep/timeline',  { params: p }).then(r => r.data)
export const getEpPorMesDetalle  = (p?: object) => api.get('/ep/por-mes',   { params: p }).then(r => r.data)
export const getEpPorTipoDetalle = (p?: object) => api.get('/ep/por-tipo',  { params: p }).then(r => r.data)

export const uploadIncidencias = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/incidencias', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}

export const getKpiMaquinas   = ()                    => api.get('/kpi-contratos/maquinas').then(r => r.data)
export const getKpiProyectos  = ()                    => api.get('/kpi-contratos/proyectos').then(r => r.data)
export const getKpiHoleIds    = (proyectos?: string[]) =>
  api.get('/kpi-contratos/holeids', { params: { proyectos: proyectos?.length ? proyectos : undefined } }).then(r => r.data)

export const getKpiDisponibilidad = (
  fechaDesde?: string, fechaHasta?: string,
  maquinas?: string[], proyectos?: string[], holeids?: string[],
) =>
  api.get('/kpi-contratos/disponibilidad', {
    params: {
      fecha_desde: fechaDesde  || undefined,
      fecha_hasta: fechaHasta  || undefined,
      maquinas:    maquinas?.length  ? maquinas  : undefined,
      proyectos:   proyectos?.length ? proyectos : undefined,
      holeids:     holeids?.length   ? holeids   : undefined,
    },
  }).then(r => r.data)

export const uploadProyectosInicio = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/proyectos-inicio', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}
