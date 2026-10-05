import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getHomeKpis    = (p?: object) => api.get('/home/kpis',        { params: p }).then(r => r.data)
export const getHomeFiltros = ()           => api.get('/home/filtros').then(r => r.data)
export const getEpPorMes    = (p?: object) => api.get('/home/ep-por-mes',  { params: p }).then(r => r.data)
export const getEpPorTipo   = (p?: object) => api.get('/home/ep-por-tipo', { params: p }).then(r => r.data)

export const getSaldoKpis      = ()           => api.get('/saldo/kpis').then(r => r.data)
export const getSaldoFiltros   = ()           => api.get('/saldo/filtros').then(r => r.data)
export const getContratos      = (p: object)  => api.get('/saldo/contratos', { params: p }).then(r => r.data)
export const getSaldoEvolucion = ()           => api.get('/saldo/evolucion').then(r => r.data)
export const getSaldoTimeline  = (p?: object) => api.get('/saldo/timeline',  { params: p }).then(r => r.data)

export const getLicitKpis     = ()      => api.get('/licitaciones/kpis').then(r => r.data)
export const getLicitPorEstado= ()      => api.get('/licitaciones/por-estado').then(r => r.data)
export const getLicitPorAnio  = ()      => api.get('/licitaciones/por-anio').then(r => r.data)
export const getLicitTabla    = (p: object) => api.get('/licitaciones/tabla', { params: p }).then(r => r.data)

export const getAlertasKpis   = ()      => api.get('/alertas/kpis').then(r => r.data)
export const getAlertasContratos = ()   => api.get('/alertas/contratos').then(r => r.data)
export const getAlertasBoletas   = (p?: object) => api.get('/alertas/boletas', { params: p }).then(r => r.data)

export const getAnalisisKpis          = ()            => api.get('/analisis/kpis').then(r => r.data)
export const getAnalisisPorProyecto   = ()            => api.get('/analisis/por-proyecto').then(r => r.data)
export const getAnalisisTabla         = (p: object)   => api.get('/analisis/tabla', { params: p }).then(r => r.data)

export const getSourcingKpis          = ()            => api.get('/sourcing/kpis').then(r => r.data)
export const getSourcingPorMes        = ()            => api.get('/sourcing/por-mes').then(r => r.data)
export const getSourcingPorEstatus    = ()            => api.get('/sourcing/por-estatus').then(r => r.data)
export const getSourcingPorProyecto   = ()            => api.get('/sourcing/por-proyecto').then(r => r.data)
export const getSourcingTabla         = ()            => api.get('/sourcing/tabla').then(r => r.data)

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

export const getIncidencias             = () => api.get('/estado-proyectos/incidencias').then(r => r.data)
export const getEstadoProyectosResumen  = (p?: object) => api.get('/estado-proyectos/resumen', { params: p }).then(r => r.data)

export const getMetrosPai    = () => api.get('/metros/pai').then(r => r.data)
export const getMetrosAvance = () => api.get('/metros/avance').then(r => r.data)

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

export const getSolpeTiempos    = ()           => api.get('/licitaciones/tiempos').then(r => r.data)

export const getMondayKpis      = ()           => api.get('/monday/kpis').then(r => r.data)
export const getMondayTabla     = (p: object)  => api.get('/monday/tabla', { params: p }).then(r => r.data)
export const getMondayFiltros   = ()           => api.get('/monday/filtros').then(r => r.data)
export const getMondayTendencia = ()           => api.get('/monday/tendencia').then(r => r.data)

export const getSimulacionLista       = ()              => api.get('/simulacion/lista').then(r => r.data)
export const getSimulacionProyectos   = ()              => api.get('/simulacion/datos/proyectos').then(r => r.data)
export const getSimulacionVendorCodes = (proyectos: string[]) => api.get('/simulacion/datos/vendor-codes', { params: { proyectos } }).then(r => r.data)
export const getSimulacionContratos   = ()              => api.get('/simulacion/datos/contratos').then(r => r.data)
export const getSimulacion            = (id: number)    => api.get(`/simulacion/${id}`).then(r => r.data)
export const guardarSimulacion        = (body: object)  => api.post('/simulacion/guardar', body).then(r => r.data)
export const eliminarSimulacion       = (id: number)    => api.delete(`/simulacion/${id}`).then(r => r.data)

export const uploadIncidencias = (file: File, usuario = '') => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/incidencias', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { usuario },
  }).then(r => r.data)
}
