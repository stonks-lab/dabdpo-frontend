import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getHomeKpis      = ()      => api.get('/home/kpis').then(r => r.data)
export const getEpPorMes      = ()      => api.get('/home/ep-por-mes').then(r => r.data)
export const getEpPorTipo     = ()      => api.get('/home/ep-por-tipo').then(r => r.data)

export const getSaldoKpis     = ()      => api.get('/saldo/kpis').then(r => r.data)
export const getSaldoFiltros  = ()      => api.get('/saldo/filtros').then(r => r.data)
export const getContratos     = (p: object) => api.get('/saldo/contratos', { params: p }).then(r => r.data)

export const getLicitKpis     = ()      => api.get('/licitaciones/kpis').then(r => r.data)
export const getLicitPorEstado= ()      => api.get('/licitaciones/por-estado').then(r => r.data)
export const getLicitPorAnio  = ()      => api.get('/licitaciones/por-anio').then(r => r.data)
export const getLicitTabla    = (p: object) => api.get('/licitaciones/tabla', { params: p }).then(r => r.data)

export const getAlertasKpis   = ()      => api.get('/alertas/kpis').then(r => r.data)
export const getAlertasContratos = ()   => api.get('/alertas/contratos').then(r => r.data)
export const getAlertasBoletas   = ()   => api.get('/alertas/boletas').then(r => r.data)

export const getAnalisisKpis          = ()            => api.get('/analisis/kpis').then(r => r.data)
export const getAnalisisPorProyecto   = ()            => api.get('/analisis/por-proyecto').then(r => r.data)
export const getAnalisisTabla         = (p: object)   => api.get('/analisis/tabla', { params: p }).then(r => r.data)

export const getSourcingKpis          = ()            => api.get('/sourcing/kpis').then(r => r.data)
export const getSourcingPorMes        = ()            => api.get('/sourcing/por-mes').then(r => r.data)
export const getSourcingPorEstatus    = ()            => api.get('/sourcing/por-estatus').then(r => r.data)
export const getSourcingPorProyecto   = ()            => api.get('/sourcing/por-proyecto').then(r => r.data)
export const getSourcingTabla         = ()            => api.get('/sourcing/tabla').then(r => r.data)

export const uploadProyeccionesPyC = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/proyecciones-pyc', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const uploadDimensiones = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/dimensiones', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const getIncidencias = () => api.get('/estado-proyectos/incidencias').then(r => r.data)

export const getMetrosPai    = () => api.get('/metros/pai').then(r => r.data)
export const getMetrosAvance = () => api.get('/metros/avance').then(r => r.data)

export const uploadIncidencias = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/incidencias', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
