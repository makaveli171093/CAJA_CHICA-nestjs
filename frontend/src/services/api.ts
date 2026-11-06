import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Envía cookies HttpOnly de sesión automáticamente
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Encabezado estándar para mitigación CSRF
  },
});

// Interceptor para manejar errores 401 (sesión expirada o no autorizada)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Notificar o permitir que el AuthContext maneje la expiración
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const downloadValePdf = async (pedidoId: string, customFilename?: string) => {
  const response = await api.get(`/pedidos/${pedidoId}/vale-pdf`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', customFilename || `vale-001-${pedidoId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export const openValePdfInNewTab = async (pedidoId: string) => {
  const response = await api.get(`/pedidos/${pedidoId}/vale-pdf`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);
};

// ===================== RENDICIONES DE CUENTAS (FASE 2B) =====================

export const getRendiciones = async (unidadId: string, gestion: number) => {
  const res = await api.get('/rendiciones', { params: { unidadId, gestion } });
  return res.data;
};

export const getRendicion = async (id: string) => {
  const res = await api.get(`/rendiciones/${id}`);
  return res.data;
};

export const createRendicion = async (data: any) => {
  const res = await api.post('/rendiciones', data);
  return res.data;
};

export const enviarRendicion = async (id: string) => {
  const res = await api.patch(`/rendiciones/${id}/enviar`);
  return res.data;
};

export const aprobarRendicion = async (id: string, observaciones?: string) => {
  const res = await api.patch(`/rendiciones/${id}/aprobar`, { observaciones });
  return res.data;
};

export const rechazarRendicion = async (id: string, motivoRechazo: string) => {
  const res = await api.patch(`/rendiciones/${id}/rechazar`, { motivoRechazo });
  return res.data;
};

export const getDatosReporteImpresion = async (id: string) => {
  const res = await api.get(`/rendiciones/${id}/reporte-datos`);
  return res.data;
};

export const devolverRendicionBorrador = async (id: string, motivoDevolucion: string) => {
  const res = await api.patch(`/rendiciones/${id}/devolver-borrador`, { motivoDevolucion });
  return res.data;
};

export const eliminarRendicion = async (id: string) => {
  const res = await api.delete(`/rendiciones/${id}`);
  return res.data;
};

export const corregirRendicion = async (id: string, data: any) => {
  const res = await api.patch(`/rendiciones/${id}/corregir`, data);
  return res.data;
};

// ===================== CAJA APERTURA & CIERRE =====================

export const cerrarCaja = async (
  cajaAperturaId: string,
  data: { comprobanteDeposito?: string; observaciones?: string }
) => {
  const res = await api.post(`/apertura/${cajaAperturaId}/cerrar`, data);
  return res.data;
};

export const corregirApertura = async (
  cajaAperturaId: string,
  data: {
    justificacion: string;
    responsableId?: string;
    fechaApertura?: string;
    docAutorizacion?: string;
    compIngreso?: string;
  }
) => {
  const res = await api.patch(`/apertura/${cajaAperturaId}/corregir`, data);
  return res.data;
};

// ===================== PEDIDOS DE CAJA =====================

export const corregirPedido = async (
  pedidoId: string,
  data: {
    justificacion: string;
    monto?: string;
    fechaSolicitud?: string;
    fechaEntrega?: string;
    solicitanteNombres?: string;
    solicitanteApellidos?: string;
    solicitanteCi?: string;
    solicitanteArea?: string;
    lugar?: string;
    descripcion?: string;
    motivo?: string;
    receptorNombres?: string;
    receptorApellidos?: string;
    receptorCi?: string;
    referenciaRepMat?: string;
    observaciones?: string;
  }
) => {
  const res = await api.patch(`/pedidos/${pedidoId}/corregir-datos`, data);
  return res.data;
};

// ===================== REPOSICIONES DE FONDOS =====================

export const getReposiciones = async (unidadId?: string, gestion?: number) => {
  const params: Record<string, any> = {};
  if (unidadId) params.unidadId = unidadId;
  if (gestion) params.gestion = gestion;
  const res = await api.get('/reposiciones', { params });
  return res.data;
};

export const getReposicion = async (id: string) => {
  const res = await api.get(`/reposiciones/${id}`);
  return res.data;
};

export const getRendicionesPendientesReposicion = async (unidadId: string, gestion: number) => {
  const res = await api.get('/reposiciones/rendiciones-pendientes', {
    params: { unidadId, gestion },
  });
  return res.data;
};

export const createReposicion = async (data: {
  unidadId: string;
  rendicionIds: string[];
  observaciones?: string;
}) => {
  const res = await api.post('/reposiciones', data);
  return res.data;
};

export const aprobarReposicion = async (id: string, observaciones?: string) => {
  const res = await api.patch(`/reposiciones/${id}/aprobar`, { observaciones });
  return res.data;
};

export const rechazarReposicion = async (id: string, motivoRechazo: string) => {
  const res = await api.patch(`/reposiciones/${id}/rechazar`, { motivoRechazo });
  return res.data;
};

export const efectuarReposicion = async (
  id: string,
  data: {
    numeroChequeTransferencia: string;
    bancoOrigen?: string;
    cuentaBancaria?: string;
    observaciones?: string;
  }
) => {
  const res = await api.patch(`/reposiciones/${id}/efectuar`, data);
  return res.data;
};

// ===================== ARQUEOS DE CAJA =====================

export const getResumenPrevioArqueo = async (unidadId: string) => {
  const res = await api.get('/arqueos/resumen-previo', { params: { unidadId } });
  return res.data;
};

export const getArqueos = async (unidadId?: string, gestion?: number) => {
  const params: Record<string, any> = {};
  if (unidadId) params.unidadId = unidadId;
  if (gestion) params.gestion = gestion;
  const res = await api.get('/arqueos', { params });
  return res.data;
};

export const getArqueo = async (id: string) => {
  const res = await api.get(`/arqueos/${id}`);
  return res.data;
};

export const createArqueo = async (data: any) => {
  const res = await api.post('/arqueos', data);
  return res.data;
};

// ===================== REPORTES Y MÉTRICAS =====================

export const getReporteEjecucion = async (gestion: number, unidadId?: string) => {
  const params: Record<string, any> = { gestion };
  if (unidadId) params.unidadId = unidadId;
  const res = await api.get('/reportes/ejecucion-presupuestaria', { params });
  return res.data;
};

export const getKardexCaja = async (unidadId: string, gestion: number) => {
  const res = await api.get('/reportes/kardex-caja', {
    params: { unidadId, gestion },
  });
  return res.data;
};

export const getReporteCumplimiento = async (gestion: number, unidadId?: string) => {
  const params: Record<string, any> = { gestion };
  if (unidadId) params.unidadId = unidadId;
  const res = await api.get('/reportes/cumplimiento-plazos', { params });
  return res.data;
};



