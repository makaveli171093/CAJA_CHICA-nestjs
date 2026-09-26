export type RolUsuario = 'ADMINISTRADOR' | 'ENCARGADO';

export type EstadoCajaApertura = 'BORRADOR' | 'ABIERTA' | 'CERRADA';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  nombreCompleto: string;
  nombres?: string | null;
  apellidos?: string | null;
  carnetIdentidad?: string | null;
  cargo?: string | null;
  rol: RolUsuario;
  activo: boolean;
  unidades?: Unit[];
  responsables?: Responsable[];
}

export interface Unit {
  id: string;
  codigo: string;
  nombre: string;
  dependencia?: string | null;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Responsable {
  id: string;
  userId?: string | null;
  unidadId: string;
  nombres: string;
  apellidos: string;
  carnetIdentidad: string;
  cargo: string;
  documentoDesignacion: string;
  fechaDesignacion: string;
  activo: boolean;
  unidad?: Unit;
  user?: User;
}

export interface DesignacionInput {
  unidadId: string;
  documentoDesignacion: string;
  fechaDesignacion: string;
  cargo?: string;
  responsableId?: string;
}


export interface Partida {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
}

export interface PartidaHabilitada {
  id?: string;
  partidaId: string;
  codigo: string;
  descripcion: string;
  habilitado: boolean;
}

export interface PendientePresupuesto {
  partidaId: string;
  codigo: string;
  descripcion: string;
  gestion: number;
  montoRegistrado: string;
}

export interface PresupuestoHistorial {
  id: string;
  presupuestoPartidaId: string;
  montoAnterior: string;
  montoNuevo: string;
  motivo: string;
  actorId: string;
  actorUsername?: string | null;
  fecha: string;
}

export interface PresupuestoPartida {
  id: string;
  unidadId: string;
  gestion: number;
  partidaId: string;
  montoAsignado: string;
  activo: boolean;
  partida?: Partida;
  unidad?: Unit;
  historial?: PresupuestoHistorial[];
}

export interface MovimientoEfectivo {
  id: string;
  cajaAperturaId: string;
  tipo: 'APERTURA' | 'REPOSICION' | 'DESCARGO';
  monto: string;
  fecha: string;
  descripcion: string;
  comprobanteReferencia?: string | null;
  actorId: string;
  createdAt?: string;
}

export interface CajaApertura {
  id: string;
  unidadId: string;
  gestion: number;
  responsableId: string;
  montoAutorizado: string;
  importeRecibido: string;
  fechaApertura: string;
  docAutorizacion: string;
  compIngreso: string;
  estado: EstadoCajaApertura;
  fechaConfirmacion?: string | null;
  confirmadoPorId?: string | null;
  unidad?: Unit;
  responsable?: Responsable;
  movimientos?: MovimientoEfectivo[];
  createdAt?: string;
}

export interface DashboardData {
  unidad: Unit;
  gestion: number;
  caja: CajaApertura | null;
  responsable: Responsable | null;
  montoAutorizado: string;
  efectivoDisponible: string;
  limitePorComprobante: string;
  presupuestoPorPartida: Array<{
    id: string;
    partidaId: string;
    partidaCodigo: string;
    partidaDescripcion: string;
    montoAsignado: string;
  }>;
  resumen: {
    totalPresupuestoAsignado: string;
    totalPartidasConfiguradas: number;
    estadoCaja: EstadoCajaApertura | 'NO_CONFIGURADA';
  };
}
