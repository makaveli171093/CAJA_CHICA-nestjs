export type RolUsuario = 'ADMINISTRADOR' | 'ENCARGADO';

export type EstadoCajaApertura = 'BORRADOR' | 'ABIERTA' | 'CERRADA';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  nombreCompleto: string;
  rol: RolUsuario;
  activo: boolean;
  unidades?: Unit[];
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
  unidadId: string;
  nombres: string;
  apellidos: string;
  carnetIdentidad: string;
  cargo: string;
  documentoDesignacion: string;
  fechaDesignacion: string;
  activo: boolean;
  unidad?: Unit;
}

export interface Partida {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
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
