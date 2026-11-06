import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PrismaClient,
  EstadoCajaApertura,
  RolUsuario,
  EstadoAnticipo,
  EstadoRendicion,
  TipoDocumentoDescargo,
  TipoMovimientoEfectivo,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { RendicionesService } from '../rendiciones/rendiciones.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ValePdfService } from '../pedidos/services/vale-pdf.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Pruebas de Integración Fase 2B: Rendición de Cuentas, Aprobación FINANCIERO y Regla 48 Horas Hábiles (caja_chica_cps_test)', () => {
  let prisma: PrismaClient;
  let rendicionesService: RendicionesService;
  let pedidosService: PedidosService;

  let unitA: any;
  let unitB: any;
  let partida1: any;
  let partida2: any;
  let adminUser: any;
  let financieroUser: any;
  let gerenciaUser: any;
  let encargadoA: any;
  let encargadoB: any;
  let responsableA: any;
  let cajaA: any;
  let anticipoA: any;

  beforeAll(async () => {
    const rawUrl = process.env.DATABASE_URL || '';
    const testDbUrl = rawUrl.includes('caja_chica_cps')
      ? rawUrl.replace('caja_chica_cps', 'caja_chica_cps_test')
      : rawUrl;

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: testDbUrl,
        },
      },
    });

    const mockAuditService: any = {
      log: jest.fn().mockResolvedValue({ id: 'audit-mock-id' }),
    };

    const valePdfService = new ValePdfService();
    pedidosService = new PedidosService(prisma as any, mockAuditService, valePdfService);
    rendicionesService = new RendicionesService(prisma as any);


    // Limpieza de datos previos de prueba en orden
    await (prisma as any).arqueoCaja?.deleteMany();
    await prisma.movimientoEfectivo.deleteMany();
    await prisma.documentoDescargo.deleteMany();
    await prisma.rendicion.deleteMany();
    await (prisma as any).reposicion?.deleteMany();
    await prisma.anticipo.deleteMany();
    await prisma.pedido.deleteMany();
    await prisma.presupuestoHistorial.deleteMany();
    await prisma.presupuestoPartida.deleteMany();
    await prisma.cajaApertura.deleteMany();
    await prisma.unidadPartida.deleteMany();
    await prisma.responsable.deleteMany();
    await prisma.userUnit.deleteMany();
    await prisma.auditoria.deleteMany();
    await prisma.user.deleteMany();
    await prisma.partida.deleteMany();
    await prisma.unit.deleteMany();

    // Creación de Unidades
    unitA = await prisma.unit.create({
      data: { codigo: 'LPZ-CENTRAL', nombre: 'Oficina Central La Paz' },
    });
    unitB = await prisma.unit.create({
      data: { codigo: 'CBB-HOSPITAL', nombre: 'Hospital Regional Cochabamba' },
    });

    // Partidas
    partida1 = await prisma.partida.create({
      data: { codigo: '31110', descripcion: 'Material de Limpieza e Higiene' },
    });
    partida2 = await prisma.partida.create({
      data: { codigo: '39500', descripcion: 'Útiles de Escritorio y Oficina' },
    });

    // Habilitar partidas para Unidad A
    await prisma.unidadPartida.create({
      data: { unidadId: unitA.id, partidaId: partida1.id, activo: true },
    });
    await prisma.unidadPartida.create({
      data: { unidadId: unitA.id, partidaId: partida2.id, activo: true },
    });

    // Usuarios: Admin, Financiero, Gerencia, Encargado A, Encargado B
    adminUser = await prisma.user.create({
      data: {
        username: 'admin_fase2b',
        nombreCompleto: 'Administrador General CPS',
        passwordHash: 'dummyhash',
        rol: RolUsuario.ADMINISTRADOR,
      },
    });

    financieroUser = await prisma.user.create({
      data: {
        username: 'financiero_daf',
        nombreCompleto: 'Lic. Roberto Morales (DAF)',
        passwordHash: 'dummyhash',
        rol: RolUsuario.FINANCIERO,
      },
    });

    gerenciaUser = await prisma.user.create({
      data: {
        username: 'gerencia_general',
        nombreCompleto: 'Dr. Fernando Salazar (Gerencia General)',
        passwordHash: 'dummyhash',
        rol: RolUsuario.GERENCIA,
      },
    });

    encargadoA = await prisma.user.create({
      data: {
        username: 'encargado_a',
        nombreCompleto: 'Juan Pérez (Caja Central)',
        carnetIdentidad: '4982341 LP',
        cargo: 'Encargado de Caja Chica LPZ',
        passwordHash: 'dummyhash',
        rol: RolUsuario.ENCARGADO,
        unidades: { create: { unitId: unitA.id } },
      },
    });

    encargadoB = await prisma.user.create({
      data: {
        username: 'encargado_b',
        nombreCompleto: 'Carlos Quispe (Caja CBB)',
        carnetIdentidad: '5982112 CB',
        cargo: 'Encargado de Caja CBB',
        passwordHash: 'dummyhash',
        rol: RolUsuario.ENCARGADO,
        unidades: { create: { unitId: unitB.id } },
      },
    });

    // Responsable institucional
    responsableA = await prisma.responsable.create({
      data: {
        userId: encargadoA.id,
        unidadId: unitA.id,
        nombres: 'Juan',
        apellidos: 'Pérez',
        carnetIdentidad: '4982341 LP',
        cargo: 'Encargado de Caja Chica LPZ',
        documentoDesignacion: 'MEMO-DAF-01/2026',
        fechaDesignacion: new Date('2026-01-02'),
      },
    });

    // Apertura de Caja Chica
    cajaA = await prisma.cajaApertura.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        responsableId: responsableA.id,
        montoAutorizado: new Decimal('10000.00'),
        importeRecibido: new Decimal('10000.00'),
        fechaApertura: new Date('2026-01-05'),
        docAutorizacion: 'RES-ADM-001/2026',
        compIngreso: 'CI-001/2026',
        estado: EstadoCajaApertura.ABIERTA,
        fechaConfirmacion: new Date('2026-01-05T08:00:00Z'),
        confirmadoPorId: adminUser.id,
      },
    });

    // Movimiento inicial de efectivo
    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: cajaA.id,
        tipo: TipoMovimientoEfectivo.APERTURA,
        monto: new Decimal('10000.00'),
        fecha: new Date('2026-01-05T08:00:00Z'),
        descripcion: 'Apertura de fondo inicial',
        comprobanteReferencia: 'CI-001/2026',
        actorId: adminUser.id,
      },
    });

    // Presupuesto partida
    await prisma.presupuestoPartida.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        partidaId: partida1.id,
        montoAsignado: new Decimal('5000.00'),
      },
    });

    // Crear un Pedido y Entregar Anticipo por Bs 500.00
    const pedido = await prisma.pedido.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-F2B-001',
        fechaSolicitud: new Date('2026-03-10'),
        lugar: 'La Paz',
        solicitanteNombres: 'Ana',
        solicitanteApellidos: 'Gómez',
        solicitanteCi: '3482910 LP',
        solicitanteArea: 'Laboratorio Clínico',
        descripcion: 'Compra de reactivos y material de aseo',
        motivo: 'Urgencia de limpieza',
        receptorNombres: 'Pedro',
        receptorApellidos: 'Mamani',
        receptorCi: '4829102 LP',
        monto: new Decimal('500.00'),
        registradoPorId: encargadoA.id,
      },
    });

    // Entregar anticipo
    const entregaRes = await pedidosService.entregar(
      pedido.id,
      { fechaEntrega: '2026-03-10' },
      { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
    );
    anticipoA = entregaRes.anticipo;
  });


  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Encargado puede crear una rendición en BORRADOR con facturas válidas y cálculo exacto de sobrante', async () => {
    const dto = {
      anticipoId: anticipoA.id,
      fechaRendicion: '2026-03-11',
      montoDevuelto: '50.00',
      observaciones: 'Rendición con 2 facturas autorizadas',
      documentos: [
        {
          tipoDocumento: TipoDocumentoDescargo.FACTURA_COMPRA,
          numeroDocumento: '8821',
          nitCiEmisor: '1029384019',
          razonSocial: 'Droguería y Limpieza Bolivia S.A.',
          fechaEmision: '2026-03-11',
          partidaId: partida1.id,
          importe: '300.00',
          concepto: 'Detergente institucional y desinfectante',
        },
        {
          tipoDocumento: TipoDocumentoDescargo.FACTURA_COMPRA,
          numeroDocumento: '1450',
          nitCiEmisor: '2039481029',
          razonSocial: 'Comercial El Papelero',
          fechaEmision: '2026-03-11',
          partidaId: partida1.id,
          importe: '150.00',
          concepto: 'Papel toalla interfoliado',
        },
      ],
    };

    const rendicion = await rendicionesService.create(
      dto,
      { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
    );

    expect(rendicion).toBeDefined();
    expect(rendicion.estado).toBe(EstadoRendicion.BORRADOR);
    expect(rendicion.numeroRendicion).toMatch(/^REND-002-LPZ-CENTRAL-2026-0001$/);
    expect(new Decimal(rendicion.totalDescargado).toFixed(2)).toBe('450.00');
    expect(new Decimal(rendicion.montoSobrante).toFixed(2)).toBe('50.00');
    expect(new Decimal(rendicion.montoDevuelto).toFixed(2)).toBe('50.00');
    expect(rendicion.documentos.length).toBe(2);
  });

  it('2. Rechaza rendición si el total descargado excede el monto del anticipo o si ya fue rendido', async () => {
    // 2.1 Conflicto por anticipo ya rendido previamente
    const dtoDuplicado = {
      anticipoId: anticipoA.id,
      documentos: [
        {
          tipoDocumento: TipoDocumentoDescargo.FACTURA_COMPRA,
          numeroDocumento: '9999',
          nitCiEmisor: '1029384019',
          razonSocial: 'Proveedor X',
          fechaEmision: '2026-03-11',
          partidaId: partida1.id,
          importe: '50.00',
          concepto: 'Gasto duplicado',
        },
      ],
    };

    await expect(
      rendicionesService.create(
        dtoDuplicado,
        { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
      ),
    ).rejects.toThrow(ConflictException);

    // 2.2 Exceso de monto en un nuevo pedido de Bs 200 entregado
    const pedido2 = await prisma.pedido.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-F2B-002',
        fechaSolicitud: new Date('2026-03-10'),
        lugar: 'La Paz',
        solicitanteNombres: 'Carlos',
        solicitanteApellidos: 'Vargas',
        solicitanteCi: '3829102 LP',
        solicitanteArea: 'Almacén',
        descripcion: 'Compra de bolsas',
        motivo: 'Insumos',
        receptorNombres: 'Carlos',
        receptorApellidos: 'Vargas',
        receptorCi: '3829102 LP',
        monto: new Decimal('200.00'),
        registradoPorId: encargadoA.id,
      },
    });

    const resEntrega2 = await pedidosService.entregar(
      pedido2.id,
      { fechaEntrega: '2026-03-10' },
      { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
    );

    const dtoExcedido = {
      anticipoId: resEntrega2.anticipo.id,
      documentos: [
        {
          tipoDocumento: TipoDocumentoDescargo.FACTURA_COMPRA,
          numeroDocumento: '7777',
          nitCiEmisor: '1029384019',
          razonSocial: 'Proveedor Mayor',
          fechaEmision: '2026-03-11',
          partidaId: partida1.id,
          importe: '250.00', // Excede los 200.00
          concepto: 'Gasto que supera el anticipo',
        },
      ],
    };

    await expect(
      rendicionesService.create(
        dtoExcedido,
        { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });


  it('3. Encargado B (Hospital Cochabamba) no puede ver ni operar rendiciones de Unidad A (Aislamiento Multiunidad)', async () => {
    const rendicion = await prisma.rendicion.findFirst({ where: { unidadId: unitA.id } });

    await expect(
      rendicionesService.findOne(
        rendicion!.id,
        { id: encargadoB.id, username: encargadoB.username, rol: RolUsuario.ENCARGADO, unidades: [unitB.id] } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('4. Encargado puede enviar la rendición a revisión (estado ENVIADA)', async () => {
    const rendicion = await prisma.rendicion.findFirst({ where: { unidadId: unitA.id } });

    const enviada = await rendicionesService.enviar(
      rendicion!.id,
      { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
    );

    expect(enviada.estado).toBe(EstadoRendicion.ENVIADA);
  });

  it('5. Rol FINANCIERO puede rechazar una rendición con motivo fundado (estado RECHAZADA)', async () => {
    const rendicion = await prisma.rendicion.findFirst({ where: { unidadId: unitA.id } });

    const rechazada = await rendicionesService.rechazar(
      rendicion!.id,
      { motivoRechazo: 'Falta adjuntar el recibo de caja de devolución del sobrante de Bs 50.00' },
      { id: financieroUser.id, username: financieroUser.username, rol: RolUsuario.FINANCIERO, unidades: [] } as any,
    );

    expect(rechazada.estado).toBe(EstadoRendicion.RECHAZADA);
    expect(rechazada.motivoRechazo).toContain('Falta adjuntar');
  });

  it('6. Encargado subsana y reenvía; Rol FINANCIERO aprueba la rendición definitivamente', async () => {
    const rendicion = await prisma.rendicion.findFirst({ where: { unidadId: unitA.id } });

    // Reenviar
    await rendicionesService.enviar(
      rendicion!.id,
      { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] } as any,
    );

    // Aprobar por FINANCIERO
    const aprobada = await rendicionesService.aprobar(
      rendicion!.id,
      { observaciones: 'Documentos y recibo de caja verificados al 100%' },
      { id: financieroUser.id, username: financieroUser.username, rol: RolUsuario.FINANCIERO, unidades: [] } as any,
    );

    expect(aprobada.estado).toBe(EstadoRendicion.APROBADA);
    expect(aprobada.aprobadoPorUserId).toBe(financieroUser.id);
    expect(aprobada.datosRendicionJson).toBeDefined();

    // Comprobar que el anticipo pasó a estado RENDIDO
    const anticipoActualizado = await prisma.anticipo.findUnique({ where: { id: anticipoA.id } });
    expect(anticipoActualizado!.estado).toBe(EstadoAnticipo.RENDIDO);

    // Comprobar que se generó la entrada de efectivo DEVOLUCION_SOBRANTE por Bs 50.00
    const movSobrante = await prisma.movimientoEfectivo.findFirst({
      where: {
        cajaAperturaId: cajaA.id,
        tipo: TipoMovimientoEfectivo.DEVOLUCION_SOBRANTE,
        rendicionId: rendicion!.id,
      },
    });
    expect(movSobrante).toBeDefined();
    expect(new Decimal(movSobrante!.monto).toFixed(2)).toBe('50.00');
  });

  it('7. Rol GERENCIA puede consultar la rendición y métricas en modo lectura', async () => {
    const rendicion = await prisma.rendicion.findFirst({ where: { unidadId: unitA.id } });

    const consulta = await rendicionesService.findOne(
      rendicion!.id,
      { id: gerenciaUser.id, username: gerenciaUser.username, rol: RolUsuario.GERENCIA, unidades: [] } as any,
    );

    expect(consulta).toBeDefined();
    expect(consulta.numeroRendicion).toBe(rendicion!.numeroRendicion);
    expect(consulta.estado).toBe(EstadoRendicion.APROBADA);
  });

  it('8. Motor de Impresión Dual: Retorna coordenadas milimétricas para formulario preimpreso físico', async () => {
    const rendicion = await prisma.rendicion.findFirst({ where: { unidadId: unitA.id } });

    const datosImpresion = await rendicionesService.getDatosReporteImpresion(
      rendicion!.id,
      { id: financieroUser.id, username: financieroUser.username, rol: RolUsuario.FINANCIERO, unidades: [] } as any,
    );

    expect(datosImpresion).toBeDefined();
    expect(datosImpresion.coordenadasPreimpreso).toBeDefined();
    expect(datosImpresion.coordenadasPreimpreso.tablaInicioTopMm).toBe(78);
    expect(datosImpresion.rendicion.anticipo.montoLiteral).toContain('BOLIVIANOS');
    expect(datosImpresion.rendicion.documentos.length).toBe(2);
  });

  afterAll(async () => {
    if (prisma) {
      await (prisma as any).arqueoCaja?.deleteMany();
      await prisma.movimientoEfectivo.deleteMany();
      await prisma.documentoDescargo.deleteMany();
      await prisma.rendicion.deleteMany();
      await (prisma as any).reposicion?.deleteMany();
      await prisma.anticipo.deleteMany();
      await prisma.pedido.deleteMany();
      await prisma.presupuestoHistorial.deleteMany();
      await prisma.presupuestoPartida.deleteMany();
      await prisma.cajaApertura.deleteMany();
      await prisma.unidadPartida.deleteMany();
      await prisma.responsable.deleteMany();
      await prisma.userUnit.deleteMany();
      await prisma.auditoria.deleteMany();
      await prisma.user.deleteMany();
      await prisma.partida.deleteMany();
      await prisma.$disconnect();
    }
  });
});
