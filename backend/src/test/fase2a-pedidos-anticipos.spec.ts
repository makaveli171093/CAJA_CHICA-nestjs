import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  PrismaClient,
  Prisma,
  EstadoCajaApertura,
  TipoMovimientoEfectivo,
  RolUsuario,
  EstadoPedido,
  EstadoAnticipo,
} from '@prisma/client';
import Decimal from 'decimal.js';
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PedidosService } from '../pedidos/pedidos.service';
import { ValePdfService } from '../pedidos/services/vale-pdf.service';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { UnitsService } from '../units/units.service';
import { UpdatePedidoDto } from '../pedidos/dto/update-pedido.dto';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Pruebas de Integración Fase 2A: Pedidos, Anticipos y Vale 001 (caja_chica_cps_test)', () => {
  let prisma: PrismaClient;
  let pedidosService: PedidosService;
  let presupuestosService: PresupuestosService;
  let dashboardService: DashboardService;
  let unitsService: UnitsService;
  let valePdfService: ValePdfService;

  let unitA: any;
  let unitB: any;
  let partida1: any;
  let partida2: any;
  let adminUser: any;
  let encargadoA: any;
  let encargadoB: any;
  let responsableA: any;
  let cajaA: any;

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

    await prisma.$connect();

    // Mock AuditService
    const mockAuditService: any = {
      log: jest.fn().mockResolvedValue({ id: 'audit-mock-id' }),
    };

    valePdfService = new ValePdfService();
    pedidosService = new PedidosService(prisma as any, mockAuditService, valePdfService);
    presupuestosService = new PresupuestosService(prisma as any, mockAuditService);
    dashboardService = new DashboardService(prisma as any);
    unitsService = new UnitsService(prisma as any, mockAuditService);
  });

  afterAll(async () => {
    if (prisma) {
      await (prisma as any).arqueoCaja?.deleteMany();
      await (prisma as any).movimientoEfectivo?.deleteMany();
      await (prisma as any).documentoDescargo?.deleteMany();
      await (prisma as any).rendicion?.deleteMany();
      await (prisma as any).reposicion?.deleteMany();
      await prisma.anticipo.deleteMany();
      await prisma.pedido.deleteMany();
      await prisma.cajaApertura.deleteMany();
      await prisma.presupuestoHistorial.deleteMany();
      await prisma.presupuestoPartida.deleteMany();
      await prisma.unidadPartida.deleteMany();
      await prisma.responsable.deleteMany();
      await prisma.partida.deleteMany();
      await prisma.userUnit.deleteMany();
      await prisma.unit.deleteMany();
      await prisma.user.deleteMany();
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    // Limpieza de datos entre pruebas
    await (prisma as any).documentoDescargo?.deleteMany();
    await (prisma as any).rendicion?.deleteMany();
    await prisma.movimientoEfectivo.deleteMany();
    await prisma.anticipo.deleteMany();
    await prisma.pedido.deleteMany();

    await prisma.cajaApertura.deleteMany();
    await prisma.presupuestoHistorial.deleteMany();
    await prisma.presupuestoPartida.deleteMany();
    await prisma.unidadPartida.deleteMany();
    await prisma.responsable.deleteMany();
    await prisma.partida.deleteMany();
    await prisma.userUnit.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.user.deleteMany();

    // Crear unidades
    unitA = await prisma.unit.create({
      data: { codigo: 'POL-ARCE', nombre: 'Policonsultorio Arce', activo: true },
    });
    unitB = await prisma.unit.create({
      data: { codigo: 'HOSP-NORTE', nombre: 'Hospital Norte', activo: true },
    });

    // Crear partidas del catálogo
    partida1 = await prisma.partida.create({
      data: { codigo: '34200', descripcion: 'Productos Químicos y Farmacéuticos', activo: true },
    });
    partida2 = await prisma.partida.create({
      data: { codigo: '39500', descripcion: 'Útiles de Escritorio y Oficina', activo: true },
    });

    // Habilitar partida1 en unitA (partida2 queda deshabilitada)
    await prisma.unidadPartida.create({
      data: { unidadId: unitA.id, partidaId: partida1.id, activo: true },
    });

    // Crear usuarios
    adminUser = await prisma.user.create({
      data: {
        username: 'admin_test_2a',
        nombreCompleto: 'Administrador de Pruebas',
        passwordHash: 'hash',
        rol: RolUsuario.ADMINISTRADOR,
        activo: true,
      },
    });

    encargadoA = await prisma.user.create({
      data: {
        username: 'encargado_arce',
        nombreCompleto: 'Encargado Arce',
        passwordHash: 'hash',
        rol: RolUsuario.ENCARGADO,
        activo: true,
      },
    });
    await prisma.userUnit.create({
      data: { userId: encargadoA.id, unitId: unitA.id },
    });

    encargadoB = await prisma.user.create({
      data: {
        username: 'encargado_norte',
        nombreCompleto: 'Encargado Norte',
        passwordHash: 'hash',
        rol: RolUsuario.ENCARGADO,
        activo: true,
      },
    });
    await prisma.userUnit.create({
      data: { userId: encargadoB.id, unitId: unitB.id },
    });

    // Asignar encargadoA como Responsable formal de caja en unitA
    responsableA = await prisma.responsable.create({
      data: {
        userId: encargadoA.id,
        unidadId: unitA.id,
        nombres: 'Ángel',
        apellidos: 'Linares',
        carnetIdentidad: '5928174 LP',
        cargo: 'Responsable Caja Arce',
        documentoDesignacion: 'RES-001/2026',
        fechaDesignacion: new Date('2026-01-01'),
        activo: true,
      },
    });

    // Apertura de caja en unitA: Fondo autorizado 10,000.00, Efectivo inicial 10,000.00
    cajaA = await prisma.cajaApertura.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        responsableId: responsableA.id,
        montoAutorizado: new Decimal('10000.00'),
        importeRecibido: new Decimal('10000.00'),
        fechaApertura: new Date('2026-01-02'),
        docAutorizacion: 'RES-DAF-001/2026',
        compIngreso: 'ING-001',
        estado: EstadoCajaApertura.ABIERTA,
        fechaConfirmacion: new Date('2026-01-02T08:00:00Z'),
        confirmadoPorId: adminUser.id,
      },
    });

    // Movimiento inicial de efectivo por APERTURA
    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: cajaA.id,
        tipo: TipoMovimientoEfectivo.APERTURA,
        monto: new Decimal('10000.00'),
        descripcion: 'Apertura de caja',
        actorId: adminUser.id,
      },
    });

    // Presupuesto asignado en unitA (Gestión 2026): 3,000.00 en partida1 + 7,000.00 en partida2 = 10,000.00 POA
    await prisma.presupuestoPartida.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        partidaId: partida1.id,
        montoAsignado: new Decimal('3000.00'),
        activo: true,
      },
    });
    await prisma.presupuestoPartida.create({
      data: {
        unidadId: unitA.id,
        gestion: 2026,
        partidaId: partida2.id,
        montoAsignado: new Decimal('7000.00'),
        activo: true,
      },
    });
  });

  const getEncargadoAContext = () => ({
    id: encargadoA.id,
    username: encargadoA.username,
    nombreCompleto: encargadoA.nombreCompleto,
    rol: RolUsuario.ENCARGADO,
    unidades: [unitA.id],
    activo: true,
  });

  const getEncargadoBContext = () => ({
    id: encargadoB.id,
    username: encargadoB.username,
    nombreCompleto: encargadoB.nombreCompleto,
    rol: RolUsuario.ENCARGADO,
    unidades: [unitB.id],
    activo: true,
  });

  const getAdminContext = () => ({
    id: adminUser.id,
    username: adminUser.username,
    nombreCompleto: adminUser.nombreCompleto,
    rol: RolUsuario.ADMINISTRADOR,
    unidades: [unitA.id, unitB.id],
    activo: true,
  });

  it('1. Borrador sin efecto financiero: no altera efectivo ni presupuesto', async () => {
    const encCtx = getEncargadoAContext();

    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-001/2026',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Juan',
        solicitanteApellidos: 'Pérez',
        solicitanteCi: '1234567 LP',
        solicitanteArea: 'Laboratorio',
        descripcion: 'Reactivos menores',
        motivo: 'Urgencia de guardia',
        receptorNombres: 'Carlos',
        receptorApellidos: 'Gómez',
        receptorCi: '7654321 LP',
        monto: '500.00',
      },
      encCtx as any,
    );

    expect(pedido.estado).toBe(EstadoPedido.BORRADOR);

    // Verificar que no existen anticipos ni nuevos movimientos de efectivo
    const anticipos = await prisma.anticipo.findMany();
    expect(anticipos.length).toBe(0);

    const movimientos = await prisma.movimientoEfectivo.findMany();
    expect(movimientos.length).toBe(1); // Sólo el de apertura

    // Dashboard: Efectivo disponible y presupuesto intactos
    const dash = await dashboardService.getDashboardData(unitA.id, 2026, encCtx as any);
    expect(dash.efectivoDisponible).toBe('10000.00');
    expect(dash.totalComprometido).toBe('0.00');
    expect(dash.presupuestoPorPartida[0].comprometido).toBe('0.00');
    expect(dash.presupuestoPorPartida[0].disponible).toBe('3000.00');
  });

  it('2. Entrega correcta con un solo egreso y compromiso atómico', async () => {
    const encCtx = getEncargadoAContext();

    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-002/2026',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Ana',
        solicitanteApellidos: 'López',
        solicitanteCi: '3344556 LP',
        solicitanteArea: 'Enfermería',
        descripcion: 'Termómetros clínicos',
        motivo: 'Reposición inmediata',
        receptorNombres: 'Ana',
        receptorApellidos: 'López',
        receptorCi: '3344556 LP',
        monto: '400.00',
      },
      encCtx as any,
    );

    const resEntrega = await pedidosService.entregar(pedido.id, encCtx as any);

    expect(resEntrega.numeroVale).toBe('VALE-001-POL-ARCE-2026-0001');
    expect(resEntrega.pedido.estado).toBe(EstadoPedido.ENTREGADO);

    // Verificar Anticipo
    const anticipo = await prisma.anticipo.findUnique({
      where: { pedidoId: pedido.id },
    });
    expect(anticipo).not.toBeNull();
    expect(anticipo?.estado).toBe(EstadoAnticipo.PENDIENTE);
    expect(new Decimal(anticipo!.monto.toString()).toFixed(2)).toBe('400.00');
    expect(anticipo?.numeroVale).toBe('VALE-001-POL-ARCE-2026-0001');

    // Verificar UN SOLO movimiento de egreso de efectivo
    const movimientos = await prisma.movimientoEfectivo.findMany({
      where: { cajaAperturaId: cajaA.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(movimientos.length).toBe(2); // Apertura + Entrega Anticipo

    const egreso = movimientos[1];
    expect(egreso.tipo).toBe(TipoMovimientoEfectivo.ENTREGA_ANTICIPO);
    expect(new Decimal(egreso.monto.toString()).toFixed(2)).toBe('-400.00');
    expect(egreso.anticipoId).toBe(anticipo?.id);

    // Saldo en Dashboard
    const dash = await dashboardService.getDashboardData(unitA.id, 2026, encCtx as any);
    expect(dash.efectivoDisponible).toBe('9600.00'); // 10000 - 400
    expect(dash.totalComprometido).toBe('400.00');
    expect(dash.presupuestoPorPartida[0].comprometido).toBe('400.00');
    expect(dash.presupuestoPorPartida[0].disponible).toBe('2600.00'); // 3000 - 400
  });

  it('3. Fondos o presupuesto insuficientes: rechazo inmediato', async () => {
    const encCtx = getEncargadoAContext();

    // Reducir presupuesto a 100.00
    await prisma.presupuestoPartida.update({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: unitA.id,
          gestion: 2026,
          partidaId: partida1.id,
        },
      },
      data: { montoAsignado: new Decimal('100.00') },
    });

    const pedidoPresupuesto = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-EXC-01',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Pedro',
        solicitanteApellidos: 'Ríos',
        solicitanteCi: '9988771',
        solicitanteArea: 'Farmacia',
        descripcion: 'Medicamentos',
        motivo: 'Urgencia',
        receptorNombres: 'Pedro',
        receptorApellidos: 'Ríos',
        receptorCi: '9988771',
        monto: '250.00', // Excede los 100.00 disponibles
      },
      encCtx as any,
    );

    await expect(
      pedidosService.entregar(pedidoPresupuesto.id, encCtx as any),
    ).rejects.toThrow(BadRequestException);

    // Restaurar presupuesto a 3000 pero dejar efectivo en 50.00
    await prisma.presupuestoPartida.update({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: unitA.id,
          gestion: 2026,
          partidaId: partida1.id,
        },
      },
      data: { montoAsignado: new Decimal('3000.00') },
    });

    // Simular salida masiva de efectivo previa
    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: cajaA.id,
        tipo: TipoMovimientoEfectivo.DESCARGO,
        monto: new Decimal('-9950.00'), // Quedan 50.00
        descripcion: 'Descargo previo de prueba',
        actorId: adminUser.id,
      },
    });

    await expect(
      pedidosService.entregar(pedidoPresupuesto.id, encCtx as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. Partida deshabilitada y unidad no autorizada: control estricto de acceso', async () => {
    const encCtxA = getEncargadoAContext();
    const encCtxB = getEncargadoBContext();

    // Partida2 no está habilitada para unitA
    await expect(
      pedidosService.create(
        {
          unidadId: unitA.id,
          gestion: 2026,
          cajaAperturaId: cajaA.id,
          partidaId: partida2.id,
          numeroPedido: 'PED-NO-HAB',
          fechaSolicitud: '2026-03-15',
          solicitanteNombres: 'Test',
          solicitanteApellidos: 'Test',
          solicitanteCi: '11111',
          solicitanteArea: 'Area',
          descripcion: 'Desc',
          motivo: 'Motivo',
          receptorNombres: 'Receptor',
          receptorApellidos: 'Receptor',
          receptorCi: '22222',
          monto: '100.00',
        },
        encCtxA as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // Encargado B intentando registrar pedido en unitA -> 403 Forbidden
    await expect(
      pedidosService.create(
        {
          unidadId: unitA.id,
          gestion: 2026,
          cajaAperturaId: cajaA.id,
          partidaId: partida1.id,
          numeroPedido: 'PED-NO-AUTH',
          fechaSolicitud: '2026-03-15',
          solicitanteNombres: 'Test',
          solicitanteApellidos: 'Test',
          solicitanteCi: '11111',
          solicitanteArea: 'Area',
          descripcion: 'Desc',
          motivo: 'Motivo',
          receptorNombres: 'Receptor',
          receptorApellidos: 'Receptor',
          receptorCi: '22222',
          monto: '100.00',
        },
        encCtxB as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('5. Límite exacto del 10% (1,000.00) y rechazo por exceso (1,000.01)', async () => {
    const encCtx = getEncargadoAContext();

    // Fondo autorizado: 10,000.00 -> 10% es exactamente 1,000.00
    const pedidoExacto = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-10PCT-OK',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Exacto',
        solicitanteApellidos: 'Diez',
        solicitanteCi: '101010',
        solicitanteArea: 'Servicios',
        descripcion: 'Compra al tope permitido',
        motivo: 'Justificación',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Exacto',
        receptorCi: '101010',
        monto: '1000.00',
      },
      encCtx as any,
    );

    // 1000.00 exactos debe pasar
    const entregaExacta = await pedidosService.entregar(pedidoExacto.id, encCtx as any);
    expect(entregaExacta.pedido.estado).toBe(EstadoPedido.ENTREGADO);

    // Pedido por 1,000.01 debe ser rechazado
    const pedidoExceso = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-10PCT-FAIL',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Exceso',
        solicitanteApellidos: 'Centavo',
        solicitanteCi: '202020',
        solicitanteArea: 'Servicios',
        descripcion: 'Compra sobre el tope',
        motivo: 'Justificación',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Exceso',
        receptorCi: '202020',
        monto: '1000.01',
      },
      encCtx as any,
    );

    await expect(
      pedidosService.entregar(pedidoExceso.id, encCtx as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. Reintento y entregas concurrentes: serialización y protección', async () => {
    const encCtx = getEncargadoAContext();

    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-CONCURRENTE',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Concurrente',
        solicitanteApellidos: 'Test',
        solicitanteCi: '303030',
        solicitanteArea: 'Sistemas',
        descripcion: 'Insumos de red',
        motivo: 'Mantenimiento',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Test',
        receptorCi: '303030',
        monto: '300.00',
      },
      encCtx as any,
    );

    // Dos llamadas concurrentes al mismo pedido
    const [res1, res2] = await Promise.allSettled([
      pedidosService.entregar(pedido.id, encCtx as any),
      pedidosService.entregar(pedido.id, encCtx as any),
    ]);

    const exitosos = [res1, res2].filter((r) => r.status === 'fulfilled');
    const fallidos = [res1, res2].filter((r) => r.status === 'rejected');

    expect(exitosos.length).toBe(1);
    expect(fallidos.length).toBe(1);
    expect((fallidos[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    // Reintento posterior secuencial debe fallar con ConflictException
    await expect(
      pedidosService.entregar(pedido.id, encCtx as any),
    ).rejects.toThrow(ConflictException);
  });

  it('7. Rollback ante fallo transaccional: estado permanece limpio', async () => {
    const encCtx = getEncargadoAContext();

    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-ROLLBACK',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Rollback',
        solicitanteApellidos: 'Test',
        solicitanteCi: '404040',
        solicitanteArea: 'Servicios',
        descripcion: 'Compra prueba rollback',
        motivo: 'Test',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Test',
        receptorCi: '404040',
        monto: '350.00',
      },
      encCtx as any,
    );

    // Simular que el responsable de caja es desactivado antes de la entrega
    await prisma.responsable.update({
      where: { id: responsableA.id },
      data: { activo: false },
    });

    await expect(
      pedidosService.entregar(pedido.id, encCtx as any),
    ).rejects.toThrow(BadRequestException);

    // Verificar que el pedido NO cambió a ENTREGADO
    const pedidoDb = await prisma.pedido.findUnique({ where: { id: pedido.id } });
    expect(pedidoDb?.estado).toBe(EstadoPedido.BORRADOR);

    // No se crearon anticipos ni egresos huérfanos
    const anticipos = await prisma.anticipo.findMany({ where: { pedidoId: pedido.id } });
    expect(anticipos.length).toBe(0);

    const movimientos = await prisma.movimientoEfectivo.findMany({
      where: { tipo: TipoMovimientoEfectivo.ENTREGA_ANTICIPO },
    });
    expect(movimientos.length).toBe(0);
  });

  it('8. Reimpresión sin efectos financieros: genera PDF desde snapshot idéntico', async () => {
    const encCtx = getEncargadoAContext();

    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-REIMPRESION',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Reimpresión',
        solicitanteApellidos: 'Snapshot',
        solicitanteCi: '505050',
        solicitanteArea: 'Rayos X',
        descripcion: 'Placas radiográficas menores',
        motivo: 'Stock mínimo',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Snapshot',
        receptorCi: '505050',
        monto: '600.00',
      },
      encCtx as any,
    );

    await pedidosService.entregar(pedido.id, encCtx as any);

    const movsAntes = await prisma.movimientoEfectivo.count();
    const anticiposAntes = await prisma.anticipo.count();

    const spy = jest
      .spyOn(valePdfService, 'generatePdf')
      .mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf vale 001 snapshot'));

    // Reimprimir PDF 1
    const { buffer: buf1, filename: f1 } = await pedidosService.getValePdfBuffer(
      pedido.id,
      encCtx as any,
    );
    expect(buf1.length).toBeGreaterThan(10);
    expect(f1).toContain('VALE-001-POL-ARCE-2026-0001');

    // Reimprimir PDF 2
    const { buffer: buf2 } = await pedidosService.getValePdfBuffer(
      pedido.id,
      encCtx as any,
    );
    expect(buf2.length).toBeGreaterThan(10);

    expect(spy).toHaveBeenCalledTimes(2);

    // Comprobar que no se generaron nuevos movimientos de efectivo ni nuevos anticipos
    const movsDespues = await prisma.movimientoEfectivo.count();
    const anticiposDespues = await prisma.anticipo.count();

    expect(movsDespues).toBe(movsAntes);
    expect(anticiposDespues).toBe(anticiposAntes);
  });

  it('9. Reducción de presupuesto incompatible con compromisos existentes: rechazo 400', async () => {
    const encCtx = getEncargadoAContext();
    const admCtx = getAdminContext();

    // Partida1 tiene 3,000.00 asignados. Entregar anticipo de 800.00
    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-COMPROMISO-TEST',
        fechaSolicitud: '2026-03-15',
        solicitanteNombres: 'Compromiso',
        solicitanteApellidos: 'Presupuesto',
        solicitanteCi: '606060',
        solicitanteArea: 'Pediatría',
        descripcion: 'Insumos pediátricos',
        motivo: 'Atención prioritaria',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Pedia',
        receptorCi: '606060',
        monto: '800.00',
      },
      encCtx as any,
    );

    await pedidosService.entregar(pedido.id, encCtx as any);

    const presPartida = await prisma.presupuestoPartida.findUnique({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: unitA.id,
          gestion: 2026,
          partidaId: partida1.id,
        },
      },
    });

    // Intentar reducir presupuesto a 700.00 (menor a los 800.00 comprometidos) -> 400 Bad Request
    await expect(
      presupuestosService.update(
        presPartida!.id,
        {
          montoAsignado: '700.00',
          motivo: 'Intento de recorte administrativo excesivo',
        },
        admCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // Intentar reducir presupuesto vía savePartidasPresupuestos a 500.00 -> 400 Bad Request
    await expect(
      unitsService.savePartidasPresupuestos(
        unitA.id,
        {
          gestion: 2026,
          items: [
            {
              partidaId: partida1.id,
              montoAsignado: '500.00',
              motivo: 'Ajuste recortando por debajo de compromisos',
            },
          ],
        },
        admCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // Reducir a 1,000.00 (>= 800.00) -> permitido
    const presAjustado = await presupuestosService.update(
      presPartida!.id,
      {
        montoAsignado: '1000.00',
        motivo: 'Ajuste presupuestario válido',
      },
      admCtx as any,
    );
    expect(presAjustado.montoAsignado).toBe('1000.00');
  });

  it('10. Dos pedidos DIFERENTES compitiendo concurrentemente por el mismo saldo: no dejan saldos negativos', async () => {
    const encCtx = getEncargadoAContext();

    // Reducir temporalmente el efectivo en caja a 600.00 creando un egreso previo (10,000 - 9,400 = 600)
    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: cajaA.id,
        tipo: TipoMovimientoEfectivo.AJUSTE,
        monto: new Prisma.Decimal('-9400.00'), // Saldo restante en efectivo: 10000 - 9400 = 600.00
        fecha: new Date('2026-02-01T10:00:00Z'),
        descripcion: 'Ajuste para prueba de concurrencia de efectivo',
        actorId: adminUser.id,
      },
    });

    // Crear dos pedidos DIFERENTES de 400.00 cada uno (400 + 400 = 800 > 600 disponible)
    const pedido1 = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-DIFF-1',
        fechaSolicitud: '2026-03-01',
        solicitanteNombres: 'Concurrente',
        solicitanteApellidos: 'Uno',
        solicitanteCi: '111111',
        solicitanteArea: 'Almacenes',
        descripcion: 'Compra A',
        motivo: 'Insumos A',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Uno',
        receptorCi: '111111',
        monto: '400.00',
      },
      encCtx as any,
    );

    const pedido2 = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-DIFF-2',
        fechaSolicitud: '2026-03-02',
        solicitanteNombres: 'Concurrente',
        solicitanteApellidos: 'Dos',
        solicitanteCi: '222222',
        solicitanteArea: 'Farmacia',
        descripcion: 'Compra B',
        motivo: 'Insumos B',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Dos',
        receptorCi: '222222',
        monto: '400.00',
      },
      encCtx as any,
    );

    // Ejecutar ambas entregas simultáneamente
    const [res1, res2] = await Promise.allSettled([
      pedidosService.entregar(pedido1.id, encCtx as any),
      pedidosService.entregar(pedido2.id, encCtx as any),
    ]);

    const exitosos = [res1, res2].filter((r) => r.status === 'fulfilled');
    const fallidos = [res1, res2].filter((r) => r.status === 'rejected');

    // Exactamente 1 debe ganar la carrera y el otro debe fallar (BadRequestException de saldo o ConflictException por aislamiento)
    expect(exitosos.length).toBe(1);
    expect(fallidos.length).toBe(1);

    // Verificar que el saldo de efectivo NUNCA quedó negativo
    const movimientos = await prisma.movimientoEfectivo.findMany({
      where: { cajaAperturaId: cajaA.id },
    });
    let saldoFinal = new Decimal('0.00');
    for (const m of movimientos) {
      saldoFinal = saldoFinal.plus(new Decimal(m.monto.toString()));
    }
    expect(saldoFinal.toNumber()).toBeGreaterThanOrEqual(0);
    expect(saldoFinal.toFixed(2)).toBe('200.00'); // 600 - 400 = 200
  });

  it('11. Entrega concurrente con reducción administrativa de presupuesto: protege disponibilidad', async () => {
    const encCtx = getEncargadoAContext();
    const admCtx = getAdminContext();

    // Presupuesto partida1 es 5,000.00. Crear pedido de 800.00.
    const pedido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-CONC-PRESUP',
        fechaSolicitud: '2026-03-05',
        solicitanteNombres: 'Concurrente',
        solicitanteApellidos: 'Presup',
        solicitanteCi: '555555',
        solicitanteArea: 'Auditoría',
        descripcion: 'Prueba concurrencia presupuesto',
        motivo: 'Test',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Presup',
        receptorCi: '555555',
        monto: '800.00',
      },
      encCtx as any,
    );

    const presPartida = await prisma.presupuestoPartida.findUnique({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: unitA.id,
          gestion: 2026,
          partidaId: partida1.id,
        },
      },
    });

    // Ejecutar simultáneamente entrega del pedido (requiere 800) y reducción administrativa a 500 (< 800)
    const [resEntrega, resAjuste] = await Promise.allSettled([
      pedidosService.entregar(pedido.id, encCtx as any),
      presupuestosService.update(
        presPartida!.id,
        {
          montoAsignado: '500.00',
          motivo: 'Ajuste concurrente a 500',
        },
        admCtx as any,
      ),
    ]);

    // O bien la entrega se procesó primero (y el ajuste a 500 fue rechazado porque comprometido es 800),
    // o bien el ajuste a 500 se procesó primero (y la entrega de 800 fue rechazada por presupuesto insuficiente).
    // En ningún caso pueden ser ambos exitosos.
    const exitosos = [resEntrega, resAjuste].filter((r) => r.status === 'fulfilled');
    expect(exitosos.length).toBeLessThanOrEqual(1);

    // Comprobar estado final en base de datos: presupuesto asignado >= anticipos comprometidos
    const presFinal = await prisma.presupuestoPartida.findUnique({
      where: { id: presPartida!.id },
    });
    const anticipos = await prisma.anticipo.findMany({
      where: {
        cajaApertura: { unidadId: unitA.id, gestion: 2026 },
        pedido: { partidaId: partida1.id },
        estado: 'PENDIENTE',
      },
    });
    let totalComprometido = new Decimal('0.00');
    for (const a of anticipos) {
      totalComprometido = totalComprometido.plus(new Decimal(a.monto.toString()));
    }
    expect(new Decimal(presFinal!.montoAsignado.toString()).toNumber()).toBeGreaterThanOrEqual(
      totalComprometido.toNumber(),
    );
  });

  it('12. Validación estricta de fechas respecto a apertura de caja y gestión fiscal', async () => {
    const encCtx = getEncargadoAContext();

    // 1. Fecha anterior a apertura de caja (cajaA se abrió en 2026-01-02) -> rechazo 400
    await expect(
      pedidosService.create(
        {
          unidadId: unitA.id,
          gestion: 2026,
          cajaAperturaId: cajaA.id,
          partidaId: partida1.id,
          numeroPedido: 'PED-FECHA-PREVIA',
          fechaSolicitud: '2026-01-01', // Antes de 2026-01-02
          solicitanteNombres: 'Fecha',
          solicitanteApellidos: 'Invalida',
          solicitanteCi: '999999',
          solicitanteArea: 'Finanzas',
          descripcion: 'Intento fecha previa a apertura',
          motivo: 'Test',
          receptorNombres: 'Receptor',
          receptorApellidos: 'Fecha',
          receptorCi: '999999',
          monto: '100.00',
        },
        encCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // 2. Año de fecha no coincide con gestión fiscal -> rechazo 400
    await expect(
      pedidosService.create(
        {
          unidadId: unitA.id,
          gestion: 2026,
          cajaAperturaId: cajaA.id,
          partidaId: partida1.id,
          numeroPedido: 'PED-FECHA-ANIO',
          fechaSolicitud: '2025-12-20', // Gestión 2025 vs 2026
          solicitanteNombres: 'Fecha',
          solicitanteApellidos: 'Invalida',
          solicitanteCi: '999999',
          solicitanteArea: 'Finanzas',
          descripcion: 'Intento año dispar',
          motivo: 'Test',
          receptorNombres: 'Receptor',
          receptorApellidos: 'Fecha',
          receptorCi: '999999',
          monto: '100.00',
        },
        encCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // 3. Crear pedido válido y luego intentar actualizarlo con fecha previa a apertura -> rechazo 400
    const pedidoValido = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-FECHA-OK',
        fechaSolicitud: '2026-02-15',
        solicitanteNombres: 'Fecha',
        solicitanteApellidos: 'Valida',
        solicitanteCi: '999999',
        solicitanteArea: 'Finanzas',
        descripcion: 'Fecha valida',
        motivo: 'Test',
        receptorNombres: 'Receptor',
        receptorApellidos: 'Valido',
        receptorCi: '999999',
        monto: '100.00',
      },
      encCtx as any,
    );

    await expect(
      pedidosService.update(
        pedidoValido.id,
        { fechaSolicitud: '2026-01-01' }, // Anterior a apertura (2026-01-02)
        encCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('11. Manejo de fechas de negocio Bolivia: Contrato 2026-03-12, entrega mismo día válida y entrega anterior rechazada sin efectos financieros', async () => {
    const encCtx = { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] };

    // 1. Crear un pedido para el 12 de marzo de 2026 (2026-03-12)
    const pedido12Marzo = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-12MARZO/2026',
        fechaSolicitud: '2026-03-12',
        solicitanteNombres: 'Mario',
        solicitanteApellidos: 'Bustamante',
        solicitanteCi: '5544332 LP',
        solicitanteArea: 'Pediatría',
        descripcion: 'Compra insumos de prueba',
        motivo: 'Requerimiento médico',
        receptorNombres: 'Mario',
        receptorApellidos: 'Bustamante',
        receptorCi: '5544332 LP',
        monto: '150.00',
      },
      encCtx as any,
    );

    expect(pedido12Marzo.fechaSolicitud.toISOString().slice(0, 10)).toBe('2026-03-12');
    expect(pedido12Marzo.estado).toBe(EstadoPedido.BORRADOR);

    const initialAnticiposCount = await prisma.anticipo.count();
    const initialMovimientosCount = await prisma.movimientoEfectivo.count();

    // 2. Intento de entrega con fecha ANTERIOR a la fecha de solicitud (ej. 2026-03-11)
    await expect(
      pedidosService.entregar(
        pedido12Marzo.id,
        { fechaEntrega: '2026-03-11' },
        encCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // 3. Comprobar que NO hubo efectos financieros ante el rechazo
    const anticiposAfterReject = await prisma.anticipo.count();
    const movimientosAfterReject = await prisma.movimientoEfectivo.count();
    expect(anticiposAfterReject).toBe(initialAnticiposCount);
    expect(movimientosAfterReject).toBe(initialMovimientosCount);

    const pedidoCheck = await prisma.pedido.findUnique({ where: { id: pedido12Marzo.id } });
    expect(pedidoCheck!.estado).toBe(EstadoPedido.BORRADOR);

    // 4. Entrega el MISMO DÍA (2026-03-12 >= 2026-03-12): Debe ser plenamente válida
    const entregaMismoDia = await pedidosService.entregar(
      pedido12Marzo.id,
      { fechaEntrega: '2026-03-12' },
      encCtx as any,
    );

    expect(entregaMismoDia.pedido.estado).toBe(EstadoPedido.ENTREGADO);
    expect(entregaMismoDia.numeroVale).toBeDefined();

    // Comprobar que sí se generó el anticipo y movimiento contable
    const anticiposAfterDeliver = await prisma.anticipo.count();
    expect(anticiposAfterDeliver).toBe(initialAnticiposCount + 1);

    const anticipoDb = await prisma.anticipo.findUnique({
      where: { pedidoId: pedido12Marzo.id },
    });
    expect(anticipoDb).not.toBeNull();
    expect(anticipoDb!.monto.toString()).toBe('150');
  });

  it('12. Edición de pedido en BORRADOR: DTO estricto sin unidadId/gestion/cajaAperturaId, actualización de fechaSolicitud y protección de pedido ENTREGADO', async () => {
    const encCtx = { id: encargadoA.id, username: encargadoA.username, rol: RolUsuario.ENCARGADO, unidades: [unitA.id] };

    // 1. Crear pedido inicial en BORRADOR
    const pedidoBorrador = await pedidosService.create(
      {
        unidadId: unitA.id,
        gestion: 2026,
        cajaAperturaId: cajaA.id,
        partidaId: partida1.id,
        numeroPedido: 'PED-EDIT-TEST/2026',
        fechaSolicitud: '2026-03-01',
        solicitanteNombres: 'Funcionario',
        solicitanteApellidos: 'Original',
        solicitanteCi: '1234567 LP',
        solicitanteArea: 'Almacén',
        descripcion: 'Material de escritorio',
        motivo: 'Reposición',
        receptorNombres: 'Funcionario',
        receptorApellidos: 'Original',
        receptorCi: '1234567 LP',
        monto: '80.00',
      },
      encCtx as any,
    );

    expect(pedidoBorrador.estado).toBe(EstadoPedido.BORRADOR);
    expect(pedidoBorrador.unidadId).toBe(unitA.id);
    expect(pedidoBorrador.gestion).toBe(2026);
    expect(pedidoBorrador.cajaAperturaId).toBe(cajaA.id);

    // 2. VERIFICACIÓN DE RECHAZO: Enviar unidadId, gestion, cajaAperturaId con forbidNonWhitelisted debe fallar
    const invalidPayloadWithContext = {
      unidadId: unitA.id,
      gestion: 2026,
      cajaAperturaId: cajaA.id,
      fechaSolicitud: '2026-03-15',
    };
    const invalidDto = plainToInstance(UpdatePedidoDto, invalidPayloadWithContext);
    const validationErrors = await validate(invalidDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(validationErrors.length).toBeGreaterThan(0);
    const propertiesWithErrors = validationErrors.map((e) => e.property);
    expect(propertiesWithErrors).toContain('unidadId');
    expect(propertiesWithErrors).toContain('gestion');
    expect(propertiesWithErrors).toContain('cajaAperturaId');

    // 3. VERIFICACIÓN DE ACTUALIZACIÓN CORRECTA:
    // Payload limpio conteniendo únicamente campos admitidos por UpdatePedidoDto
    const validUpdatePayload = {
      fechaSolicitud: '2026-03-15',
      descripcion: 'Material de escritorio actualizado',
      monto: '95.00',
    };
    const validDto = plainToInstance(UpdatePedidoDto, validUpdatePayload);
    const validValidationErrors = await validate(validDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(validValidationErrors.length).toBe(0);

    const initialAnticipos = await prisma.anticipo.count();
    const initialMovimientos = await prisma.movimientoEfectivo.count();

    const updatedPedido = await pedidosService.update(
      pedidoBorrador.id,
      validDto,
      encCtx as any,
    );

    // Comprobar que la fechaSolicitud se actualizó a 2026-03-15
    expect(updatedPedido.fechaSolicitud.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(updatedPedido.descripcion).toBe('Material de escritorio actualizado');
    expect(updatedPedido.monto).toBe('95.00');

    // Comprobar que unidadId, gestion y cajaAperturaId permanecen exactamente iguales
    expect(updatedPedido.unidadId).toBe(unitA.id);
    expect(updatedPedido.gestion).toBe(2026);
    expect(updatedPedido.cajaAperturaId).toBe(cajaA.id);
    expect(updatedPedido.estado).toBe(EstadoPedido.BORRADOR);

    // Comprobar que no se crearon movimientos ni anticipos al editar
    expect(await prisma.anticipo.count()).toBe(initialAnticipos);
    expect(await prisma.movimientoEfectivo.count()).toBe(initialMovimientos);

    // 4. Entregar el pedido para pasar a ENTREGADO
    await pedidosService.entregar(
      pedidoBorrador.id,
      { fechaEntrega: '2026-03-15' },
      encCtx as any,
    );

    const pedidoEntregado = await prisma.pedido.findUnique({
      where: { id: pedidoBorrador.id },
    });
    expect(pedidoEntregado!.estado).toBe(EstadoPedido.ENTREGADO);

    // 5. Intentar editar el pedido una vez ENTREGADO -> Debe ser rechazado
    await expect(
      pedidosService.update(
        pedidoBorrador.id,
        { fechaSolicitud: '2026-03-20' },
        encCtx as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
