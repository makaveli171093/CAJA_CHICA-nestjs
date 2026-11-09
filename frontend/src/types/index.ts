export type RolUsuario = 'ADMINISTRADOR' | 'ENCARGADO' | 'FINANCIERO' | 'GERENCIA';

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
  habilitado?: boolean;
  comprometido?: string;
  ejecutado?: string;
  disponible?: string;
  partida?: Partida;
  unidad?: Unit;
  historial?: PresupuestoHistorial[];
}

export type EstadoPedido = 'BORRADOR' | 'ENTREGADO' | 'CANCELADO';
export type EstadoAnticipo = 'PENDIENTE' | 'RENDIDO';

export interface Anticipo {
  id: string;
  pedidoId: string;
  cajaAperturaId: string;
  monto: string;
  fechaEntrega: string;
  entregadoPorId: string;
  estado: EstadoAnticipo;
  numeroVale: string;
  correlativoVale: number;
  datosValeJson: string;
  createdAt: string;
  entregadoPor?: { id: string; username: string; nombreCompleto: string };
}

export interface Pedido {
  id: string;
  unidadId: string;
  gestion: number;
  cajaAperturaId: string;
  partidaId: string;
  numeroPedido: string;
  fechaSolicitud: string;
  lugar: string;
  solicitanteNombres: string;
  solicitanteApellidos: string;
  solicitanteCi: string;
  solicitanteArea: string;
  descripcion: string;
  motivo: string;
  receptorNombres: string;
  receptorApellidos: string;
  receptorCi: string;
  monto: string;
  referenciaRepMat?: string | null;
  observaciones?: string | null;
  estado: EstadoPedido;
  motivoCancelacion?: string | null;
  registradoPorId: string;
  createdAt: string;
  updatedAt: string;
  unidad?: { id: string; codigo: string; nombre: string };
  partida?: { id: string; codigo: string; descripcion: string };
  registradoPor?: { id: string; username: string; nombreCompleto: string };
  anticipo?: Anticipo | null;
  tiempoRendicion?: {
    horasTranscurridas: number;
    minutosTranscurridos: number;
    plazoReferencialHoras: number;
  } | null;
}

export interface MovimientoEfectivo {
  id: string;
  cajaAperturaId: string;
  tipo: 'APERTURA' | 'ENTREGA_ANTICIPO' | 'REPOSICION' | 'DESCARGO';
  monto: string;
  fecha: string;
  descripcion: string;
  comprobanteReferencia?: string | null;
  actorId: string;
  anticipoId?: string | null;
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
  saldoActualEfectivo?: string;
  comprobanteDeposito?: string | null;
  observaciones?: string | null;
  fechaCierre?: string | null;
  cerradoPorId?: string | null;
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
  totalAnticiposPendientes?: string;
  cantidadAnticiposPendientes?: number;
  totalComprometido?: string;
  totalEjecutado?: string;
  totalDisponiblePresupuesto?: string;
  presupuestoPorPartida: Array<{
    id: string;
    partidaId: string;
    partidaCodigo: string;
    partidaDescripcion: string;
    montoAsignado: string;
    comprometido?: string;
    ejecutado?: string;
    disponible?: string;
  }>;
  resumen: {
    totalPresupuestoAsignado: string;
    totalComprometido?: string;
    totalEjecutado?: string;
    totalDisponiblePresupuesto?: string;
    totalAnticiposPendientes?: string;
    cantidadAnticiposPendientes?: number;
    totalPartidasConfiguradas: number;
    estadoCaja: EstadoCajaApertura | 'NO_CONFIGURADA';
  };
}

export interface PartidaPresupuestoConfigItem {
  partidaId: string;
  codigo: string;
  descripcion: string;
  habilitado: boolean;
  presupuestoId: string | null;
  montoAsignado: string | null;
  historial?: PresupuestoHistorial[];
}

export interface UnidadPartidasPresupuestosResponse {
  unidad: Unit;
  gestion: number;
  items: PartidaPresupuestoConfigItem[];
  totalPresupuestado: string;
  totalPresupuestoHabilitado?: string;
  totalPresupuestoDeshabilitado?: string;
  partidasHabilitadas: number;
  partidasConPresupuesto: number;
  partidasDeshabilitadasConPresupuesto?: number;
  totalPartidasCatalogo: number;
}

export type EstadoRendicion = 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA';
export type TipoDocumentoDescargo = 'FACTURA_COMPRA' | 'RECIBO_OFICIAL' | 'OTRO_AUTORIZADO';

export interface Plazo48HorasInfo {
  horasHabilesTranscurridas: number;
  horasHabilesRestantes: number;
  vencido: boolean;
  fechaLimite: string;
  porcentajeConsumido: number;
}

export interface DocumentoDescargo {
  id: string;
  rendicionId: string;
  tipoDocumento: TipoDocumentoDescargo;
  numeroDocumento: string;
  nitCiEmisor: string;
  razonSocial: string;
  fechaEmision: string;
  codigoAutorizacion?: string | null;
  codigoControl?: string | null;
  partidaId: string;
  importe: string;
  concepto: string;
  partida?: Partida;
}

export interface Rendicion {
  id: string;
  numeroRendicion: string;
  correlativoRendicion: number;
  anticipoId: string;
  cajaAperturaId: string;
  unidadId: string;
  gestion: number;
  fechaRendicion: string;
  montoAnticipo: string;
  totalDescargado: string;
  montoSobrante: string;
  montoDevuelto: string;
  estado: EstadoRendicion;
  observaciones?: string | null;
  motivoRechazo?: string | null;
  datosRendicionJson?: string | null;
  creadoPorUserId: string;
  aprobadoPorUserId?: string | null;
  fechaAprobacion?: string | null;
  createdAt: string;
  updatedAt: string;
  anticipo?: {
    id: string;
    numeroVale: string;
    monto: string;
    fechaEntrega: string;
    pedido?: {
      id: string;
      numeroPedido: string;
      solicitanteNombres: string;
      solicitanteApellidos: string;
      solicitanteCi: string;
      solicitanteArea: string;
      partida?: Partida;
    };
  };
  documentos: DocumentoDescargo[];
  creadoPor?: { id: string; nombreCompleto: string; username: string };
  aprobadoPor?: { id: string; nombreCompleto: string; username: string } | null;
  plazo48Horas?: Plazo48HorasInfo;
}

export interface CreateDocumentoDescargoInput {
  tipoDocumento: TipoDocumentoDescargo;
  numeroDocumento: string;
  nitCiEmisor: string;
  razonSocial: string;
  fechaEmision: string;
  codigoAutorizacion?: string;
  codigoControl?: string;
  partidaId: string;
  importe: string;
  concepto: string;
}

export interface CreateRendicionInput {
  anticipoId: string;
  fechaRendicion?: string;
  montoDevuelto?: string;
  observaciones?: string;
  documentos: CreateDocumentoDescargoInput[];
}

export interface DatosReporteImpresionDual {
  rendicion: {
    id: string;
    numeroRendicion: string;
    correlativo: number;
    fechaRendicion: string;
    fechaRendicionTexto: string;
    estado: string;
    unidad: {
      codigo: string;
      nombre: string;
    };
    gestion: number;
    solicitante: {
      nombreCompleto: string;
      ci: string;
      area: string;
    };
    anticipo: {
      numeroVale: string;
      monto: string;
      montoLiteral: string;
    };
    documentos: Array<{
      item: number;
      tipo: string;
      numeroDocumento: string;
      nitCiEmisor: string;
      razonSocial: string;
      fechaEmision: string;
      partidaCodigo: string;
      partidaDescripcion: string;
      concepto: string;
      importe: string;
    }>;
    totales: {
      montoAnticipo: string;
      totalDescargado: string;
      montoSobrante: string;
      montoDevuelto: string;
    };
    firmas: {
      encargadoNombre: string;
      solicitanteNombre: string;
      financieroNombre: string;
    };
  };
  coordenadasPreimpreso: any;
}

// Reposiciones de Fondos
export type EstadoReposicion = 'BORRADOR' | 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'EFECTUADA';

export interface Reposicion {
  id: string;
  numeroReposicion: string;
  correlativo: number;
  gestion: number;
  unidadId: string;
  cajaAperturaId: string;
  estado: EstadoReposicion;
  montoSolicitado: string;
  montoAprobado?: string | null;
  fechaSolicitud: string;
  solicitanteId: string;
  observacionesSolicitud?: string | null;
  fechaAprobacion?: string | null;
  aprobadorId?: string | null;
  observacionesAprobacion?: string | null;
  fechaEfectuada?: string | null;
  numeroChequeTransferencia?: string | null;
  bancoOrigen?: string | null;
  cuentaBancaria?: string | null;
  movimientoEfectivoId?: string | null;
  createdAt: string;
  updatedAt: string;
  unidad?: Unit;
  solicitante?: { id: string; nombreCompleto: string; username: string };
  aprobador?: { id: string; nombreCompleto: string; username: string } | null;
  rendiciones?: Rendicion[];
  cajaApertura?: {
    id: string;
    gestion: number;
    montoAsignado: string;
    saldoActualEfectivo: string;
    estado: string;
  };
}

export interface CreateReposicionInput {
  unidadId: string;
  rendicionIds: string[];
  observaciones?: string;
}

export interface AprobarReposicionInput {
  observaciones?: string;
}

export interface RechazarReposicionInput {
  motivoRechazo: string;
}

export interface EfectuarReposicionInput {
  numeroChequeTransferencia: string;
  bancoOrigen?: string;
  cuentaBancaria?: string;
  observaciones?: string;
}

// Arqueos Físicos de Caja Chica
export type TipoArqueo = 'PERIODICO' | 'SORPRESIVO' | 'CIERRE_GESTION';
export type EstadoArqueo = 'CONFORME' | 'FALTANTE' | 'SOBRANTE';

export interface BilleteoDto {
  b200: number;
  b100: number;
  b50: number;
  b20: number;
  b10: number;
  m5: number;
  m2: number;
  m1: number;
  m050: number;
  m020: number;
  m010: number;
}

export interface ResumenArqueoPrevio {
  cajaAperturaId: string;
  gestion: number;
  montoAsignadoCaja: string;
  saldoLibrosEfectivo: string;
  totalValesPendientes: string;
  cantidadValesPendientes: number;
  valesPendientes: Array<{
    id: string;
    numeroVale: string;
    monto: string;
    fechaEntrega: string;
    solicitante: string;
    partida: string;
  }>;
  totalRendicionesEnTransito: string;
  cantidadRendicionesEnTransito: number;
  rendicionesEnTransito: Array<{
    id: string;
    numeroRendicion: string;
    totalDescargado: string;
    fechaRendicion: string;
  }>;
  efectivoTeoricoRequerido: string;
}

export interface ArqueoCaja {
  id: string;
  numeroArqueo: string;
  correlativo: number;
  cajaAperturaId: string;
  unidadId: string;
  gestion: number;
  fechaArqueo: string;
  tipoArqueo: TipoArqueo;
  custodioId: string;
  auditorId: string;
  totalBilletes: string;
  totalMonedas: string;
  totalEfectivoRecontado: string;
  totalValesPendientes: string;
  totalRendicionesSinReponer: string;
  totalGeneralRecontado: string;
  saldoSegunLibros: string;
  diferencia: string;
  estado: EstadoArqueo;
  billeteoJson: BilleteoDto;
  observaciones?: string | null;
  createdAt: string;
  unidad?: Unit;
  custodio?: { id: string; nombreCompleto: string; username: string };
  auditor?: { id: string; nombreCompleto: string; username: string };
}

export interface CreateArqueoInput {
  unidadId: string;
  tipoArqueo: TipoArqueo;
  billeteo: BilleteoDto;
  observaciones?: string;
}

// Reportes Ejecutivos y Métricas
export interface ReporteEjecucionPresupuestaria {
  gestion: number;
  unidadId?: string;
  totales: {
    asignado: number;
    comprometido: number;
    ejecutado: number;
    disponible: number;
    porcentajeEjecucion: number;
  };
  partidas: Array<{
    partidaId: string;
    codigo: string;
    descripcion: string;
    asignado: number;
    comprometido: number;
    ejecutado: number;
    disponible: number;
    porcentajeEjecucion: number;
  }>;
  unidades?: Array<{
    unidadId: string;
    codigo: string;
    nombre: string;
    asignado: number;
    comprometido: number;
    ejecutado: number;
    disponible: number;
    porcentajeEjecucion: number;
  }>;
}

export interface MovimientoKardex {
  fecha: string;
  tipo: string;
  documentoRef: string;
  descripcion: string;
  ingreso: number;
  egreso: number;
  saldo: number;
}

export interface KardexCaja {
  cajaApertura: {
    id: string;
    gestion: number;
    montoAsignado: string;
    saldoActualEfectivo: string;
    estado: string;
    unidad: {
      id: string;
      codigo: string;
      nombre: string;
    };
    responsable: {
      nombreCompleto: string;
      cargo: string;
    };
  };
  movimientos: MovimientoKardex[];
  resumen: {
    totalIngresos: number;
    totalEgresos: number;
    saldoFinal: number;
  };
}

export interface ItemCumplimientoPlazo {
  anticipoId: string;
  numeroVale: string;
  solicitante: string;
  cargo: string;
  area: string;
  monto: number;
  fechaEntrega: string;
  fechaLimite48h: string;
  horasHabilesTranscurridas: number;
  horasHabilesRestantes: number;
  estadoPlazo: 'A_TIEMPO' | 'EN_RIESGO' | 'VENCIDO' | 'RENDIDO_A_TIEMPO' | 'RENDIDO_FUERA_DE_PLAZO';
  rendicion?: {
    id: string;
    numeroRendicion: string;
    fechaRendicion: string;
    rendidoATiempo: boolean;
  };
}

export interface ReporteCumplimiento {
  gestion: number;
  unidadId?: string;
  totalAnticipos: number;
  totalRendidos: number;
  totalPendientes: number;
  totalVencidos: number;
  porcentajeCumplimiento: number;
  items: ItemCumplimientoPlazo[];
}

export interface CerrarCajaInput {
  comprobanteDeposito?: string;
  observaciones?: string;
}

export interface CorregirPedidoInput {
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

export interface CorregirAperturaInput {
  justificacion: string;
  responsableId?: string;
  fechaApertura?: string;
  docAutorizacion?: string;
  compIngreso?: string;
}

export interface DevolverRendicionBorradorInput {
  motivoDevolucion: string;
  observaciones?: string;
}



