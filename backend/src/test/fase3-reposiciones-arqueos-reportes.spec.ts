import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, RolUsuario, EstadoAnticipo, EstadoRendicion, EstadoReposicion, TipoArqueo, EstadoArqueo, TipoMovimientoEfectivo } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ReposicionesService } from '../reposiciones/reposiciones.service';
import { ArqueosService } from '../arqueos/arqueos.service';
import { ReportesService } from '../reportes/reportes.service';
import { PrismaService } from '../prisma/prisma.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Fase 3: Reposiciones, Arqueos Físicos y Reportes Ejecutivos', () => {
  let prisma: PrismaClient;
  let reposicionesService: ReposicionesService;
  let arqueosService: ArqueosService;
  let reportesService: ReportesService;

  const adminUser = {
    id: 'admin-fase3',
    username: 'admin_fase3',
    nombreCompleto: 'Administrador General',
    rol: RolUsuario.ADMINISTRADOR,
    unidades: [],
  };

  const financieroUser = {
    id: 'financiero-fase3',
    username: 'financiero_fase3',
    nombreCompleto: 'Financiero Central',
    rol: RolUsuario.FINANCIERO,
    unidades: [],
  };

  const encargadoUser = {
    id: 'encargado-fase3',
    username: 'encargado_fase3',
    nombreCompleto: 'Encargado Caja Regional',
    rol: RolUsuario.ENCARGADO,
    unidades: ['unit-fase3'],
  };

  let testUnitId: string;
  let testCajaId: string;
  let testPartidaId: string;
  let testRendicionId: string;

  beforeAll(async () => {
    const rawUrl = process.env.DATABASE_URL || '';
    const testDbUrl = rawUrl.includes('caja_chica_cps')
      ? rawUrl.replace('caja_chica_cps', 'caja_chica_cps_test')
      : rawUrl;

    prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await prisma.$connect();

    // Inyectar en los servicios
    const prismaServiceMock = prisma as any;
    reposicionesService = new ReposicionesService(prismaServiceMock);
    arqueosService = new ArqueosService(prismaServiceMock);
    reportesService = new ReportesService(prismaServiceMock);

    // Limpieza
    await prisma.arqueoCaja.deleteMany();
    await prisma.movimientoEfectivo.deleteMany();
    await prisma.documentoDescargo.deleteMany();
    await prisma.rendicion.deleteMany();
    await prisma.reposicion.deleteMany();
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

    // Crear usuarios de prueba
    await prisma.user.createMany({
      data: [
        {
          id: adminUser.id,
          username: adminUser.username,
          nombreCompleto: adminUser.nombreCompleto,
          rol: adminUser.rol,
          passwordHash: 'dummy',
        },
        {
          id: financieroUser.id,
          username: financieroUser.username,
          nombreCompleto: financieroUser.nombreCompleto,
          rol: financieroUser.rol,
          passwordHash: 'dummy',
        },
        {
          id: encargadoUser.id,
          username: encargadoUser.username,
          nombreCompleto: encargadoUser.nombreCompleto,
          rol: encargadoUser.rol,
          passwordHash: 'dummy',
        },
      ],
    });

    // Crear unidad
    const unit = await prisma.unit.create({
      data: {
        id: 'unit-fase3',
        codigo: 'F3-LPZ',
        nombre: 'Hospital Regional Fase 3',
      },
    });
    testUnitId = unit.id;

    // Asignar encargado
    await prisma.userUnit.create({
      data: { userId: encargadoUser.id, unitId: testUnitId },
    });

    // Responsable
    const resp = await prisma.responsable.create({
      data: {
        id: 'resp-fase3',
        unidadId: testUnitId,
        nombres: 'Carlos',
        apellidos: 'Mamani',
        carnetIdentidad: '7788990 LP',
        cargo: 'Encargado de Caja Regional',
        documentoDesignacion: 'MEMO-098/2026',
        fechaDesignacion: new Date('2026-01-02'),
      },
    });

    // Apertura de caja: 10,000 Bs
    const caja = await prisma.cajaApertura.create({
      data: {
        id: 'caja-fase3',
        unidadId: testUnitId,
        gestion: 2026,
        responsableId: resp.id,
        montoAutorizado: 10000.0,
        importeRecibido: 10000.0,
        fechaApertura: new Date('2026-01-05'),
        docAutorizacion: 'RES-01/2026',
        compIngreso: 'ING-01/2026',
        estado: 'ABIERTA',
      },
    });
    testCajaId = caja.id;

    // Movimiento inicial de apertura
    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: testCajaId,
        tipo: TipoMovimientoEfectivo.APERTURA,
        monto: 10000.0,
        descripcion: 'Apertura de fondo inicial',
        actorId: adminUser.id,
      },
    });

    // Partida
    const partida = await prisma.partida.create({
      data: {
        id: 'partida-fase3',
        codigo: '39500',
        descripcion: 'Útiles de escritorio y oficina',
      },
    });
    testPartidaId = partida.id;

    await prisma.unidadPartida.create({
      data: { unidadId: testUnitId, partidaId: testPartidaId },
    });

    await prisma.presupuestoPartida.create({
      data: {
        unidadId: testUnitId,
        gestion: 2026,
        partidaId: testPartidaId,
        montoAsignado: 5000.0,
      },
    });

    // Pedido y Anticipo entregado: 450 Bs
    const pedido = await prisma.pedido.create({
      data: {
        numeroPedido: 'PED-F3-001',
        unidadId: testUnitId,
        gestion: 2026,
        partidaId: testPartidaId,
        cajaAperturaId: testCajaId,
        fechaSolicitud: new Date('2026-02-01'),
        solicitanteNombres: 'Ana',
        solicitanteApellidos: 'Quispe',
        solicitanteCi: '1234567 LP',
        solicitanteArea: 'Jefatura de Enfermería',
        descripcion: 'Compra urgente de papel membretado',
        motivo: 'Atención de pacientes',
        receptorNombres: 'Ana',
        receptorApellidos: 'Quispe',
        receptorCi: '1234567 LP',
        monto: 450.0,
        estado: 'ENTREGADO',
        registradoPorId: encargadoUser.id,
      },
    });

    const anticipo = await prisma.anticipo.create({
      data: {
        numeroVale: 'VALE-F3-001',
        correlativoVale: 1,
        pedidoId: pedido.id,
        cajaAperturaId: testCajaId,
        monto: 450.0,
        fechaEntrega: new Date('2026-02-02T09:00:00Z'),
        estado: EstadoAnticipo.RENDIDO,
        entregadoPorId: encargadoUser.id,
        datosValeJson: '{}',
      },
    });

    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: testCajaId,
        tipo: TipoMovimientoEfectivo.ENTREGA_ANTICIPO,
        monto: 450.0,
        descripcion: 'Entrega de anticipo Vale 001',
        actorId: encargadoUser.id,
        anticipoId: anticipo.id,
      },
    });

    // Rendición aprobada: Gasto 400 Bs, Devuelto 50 Bs
    const rendicion = await prisma.rendicion.create({
      data: {
        numeroRendicion: 'REND-F3-2026-0001',
        correlativoRendicion: 1,
        anticipoId: anticipo.id,
        cajaAperturaId: testCajaId,
        unidadId: testUnitId,
        gestion: 2026,
        fechaRendicion: new Date('2026-02-03T10:00:00Z'),
        montoAnticipo: 450.0,
        totalDescargado: 400.0,
        montoSobrante: 50.0,
        montoDevuelto: 50.0,
        estado: EstadoRendicion.APROBADA,
        creadoPorUserId: encargadoUser.id,
        aprobadoPorUserId: financieroUser.id,
        fechaAprobacion: new Date('2026-02-03T14:00:00Z'),
      },
    });
    testRendicionId = rendicion.id;

    // Factura de descargo
    await prisma.documentoDescargo.create({
      data: {
        rendicionId: rendicion.id,
        tipoDocumento: 'FACTURA_COMPRA',
        numeroDocumento: 'FAC-1234',
        nitCiEmisor: '1029384021',
        razonSocial: 'Librería Central SRL',
        fechaEmision: new Date('2026-02-02'),
        partidaId: testPartidaId,
        importe: 400.0,
        concepto: 'Papel institucional resmas',
      },
    });

    // Devolución sobrante de 50 Bs a caja
    await prisma.movimientoEfectivo.create({
      data: {
        cajaAperturaId: testCajaId,
        tipo: TipoMovimientoEfectivo.DEVOLUCION_SOBRANTE,
        monto: 50.0,
        descripcion: 'Devolución sobrante rendición 001',
        actorId: encargadoUser.id,
        rendicionId: rendicion.id,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.arqueoCaja.deleteMany();
      await prisma.movimientoEfectivo.deleteMany();
      await prisma.documentoDescargo.deleteMany();
      await prisma.rendicion.deleteMany();
      await prisma.reposicion.deleteMany();
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

  // ==================== 1. REPOSICIONES ====================
  describe('Módulo de Reposiciones de Fondos (Reembolsos)', () => {
    let reposicionId: string;

    it('debe listar rendiciones pendientes de reposición', async () => {
      const pendientes = await reposicionesService.getRendicionesPendientes(
        testUnitId,
        2026,
        encargadoUser,
      );
      expect(pendientes.length).toBe(1);
      expect(pendientes[0].id).toBe(testRendicionId);
      expect(Number(pendientes[0].totalDescargado)).toBe(400.0);
    });

    it('debe permitir al encargado solicitar la reposición agrupando rendiciones aprobadas', async () => {
      const rep = await reposicionesService.create(
        {
          unidadId: testUnitId,
          gestion: 2026,
          rendicionIds: [testRendicionId],
          observaciones: 'Primera reposición de gastos de oficina',
        },
        encargadoUser,
      );

      expect(rep).toBeDefined();
      expect(rep.numeroReposicion).toBe('REP-F3-LPZ-2026-0001');
      expect(Number(rep.montoTotal)).toBe(400.0);
      expect(rep.estado).toBe(EstadoReposicion.SOLICITADA);
      reposicionId = rep.id;

      // Verificar que la rendición ahora tenga vinculado el reposicionId
      const rend = await prisma.rendicion.findUnique({ where: { id: testRendicionId } });
      expect(rend?.reposicionId).toBe(reposicionId);
    });

    it('debe permitir al Financiero aprobar la reposición', async () => {
      const aprobada = await reposicionesService.aprobar(
        reposicionId,
        { observaciones: 'Verificado conforme a normativa y documentación de respaldo.' },
        financieroUser,
      );

      expect(aprobada.estado).toBe(EstadoReposicion.APROBADA);
      expect(aprobada.aprobadoPorId).toBe(financieroUser.id);
      expect(aprobada.fechaAprobacion).toBeDefined();
    });

    it('debe permitir efectuar la reposición ingresando el efectivo con comprobante de pago', async () => {
      const efectuada = await reposicionesService.efectuar(
        reposicionId,
        {
          comprobantePago: 'CHEQ-BUN-9921',
          bancoOrigen: 'Banco Unión',
          observaciones: 'Cheque emitido y cobrado por el encargado',
        },
        financieroUser,
      );

      expect(efectuada.estado).toBe(EstadoReposicion.EFECTUADA);
      expect(efectuada.comprobantePago).toBe('CHEQ-BUN-9921');

      // Verificar que se haya registrado automáticamente el MovimientoEfectivo de REPOSICION
      const mov = await prisma.movimientoEfectivo.findUnique({
        where: { reposicionId },
      });
      expect(mov).toBeDefined();
      expect(mov?.tipo).toBe(TipoMovimientoEfectivo.REPOSICION);
      expect(Number(mov?.monto)).toBe(400.0);
    });
  });

  // ==================== 2. ARQUEOS FÍSICOS ====================
  describe('Módulo de Arqueos Físicos de Caja Chica', () => {
    it('debe obtener el resumen previo al arqueo físico', async () => {
      const resumen = await arqueosService.getResumenPrevio(testUnitId, 2026, encargadoUser);
      expect(resumen).toBeDefined();
      expect(Number(resumen.fondoAutorizado)).toBe(10000.0);
      expect(resumen.valesPendientes.cantidad).toBe(0); // El vale ya fue rendido
    });

    it('debe registrar un arqueo con billeteo exacto (CONFORME)', async () => {
      // Caja tiene 10,000 Bs (10000 apertura - 450 anticipo + 50 sobrante + 400 reposición = 10,000 Bs)
      // Desglose: 40 billetes de Bs. 200 (8,000) + 20 billetes de Bs. 100 (2,000) = 10,000
      const arqueo = await arqueosService.create(
        {
          unidadId: testUnitId,
          gestion: 2026,
          tipoArqueo: TipoArqueo.PERIODICO,
          horaArqueo: '15:30',
          billeteo: {
            b200: 40,
            b100: 20,
            b50: 0,
            b20: 0,
            b10: 0,
            m5: 0,
            m2: 0,
            m1: 0,
            m050: 0,
            m020: 0,
            m010: 0,
          },
          observaciones: 'Arqueo quincenal ordinario conforme',
        },
        financieroUser,
      );

      expect(arqueo.numeroActa).toBe('ARQ-F3-LPZ-2026-0001');
      expect(Number(arqueo.totalEfectivo)).toBe(10000.0);
      expect(Number(arqueo.diferencia)).toBe(0.0);
      expect(arqueo.resultado).toBe(EstadoArqueo.CONFORME);
    });

    it('debe registrar un arqueo con faltante si el efectivo físico es menor', async () => {
      // Desglose: 40 billetes de Bs. 200 = 8,000 (Falta 2,000)
      const arqueo = await arqueosService.create(
        {
          unidadId: testUnitId,
          gestion: 2026,
          tipoArqueo: TipoArqueo.SORPRESIVO,
          billeteo: {
            b200: 40,
            b100: 0,
            b50: 0,
            b20: 0,
            b10: 0,
            m5: 0,
            m2: 0,
            m1: 0,
            m050: 0,
            m020: 0,
            m010: 0,
          },
          testigoNombre: 'Lic. Javier Morales (Auditor)',
          observaciones: 'Faltante de 2000 Bs detectado en control sorpresivo',
        },
        adminUser,
      );

      expect(arqueo.resultado).toBe(EstadoArqueo.FALTANTE);
      expect(Number(arqueo.diferencia)).toBe(-2000.0);
    });
  });

  // ==================== 3. REPORTES EJECUTIVOS ====================
  describe('Módulo de Reportes Ejecutivos', () => {
    it('debe emitir el reporte de ejecución presupuestaria consolidada', async () => {
      const rep = await reportesService.getEjecucionPresupuestaria({
        gestion: 2026,
        unidadId: testUnitId,
        currentUser: adminUser,
      });

      expect(rep).toBeDefined();
      expect(rep.totales).toBeDefined();
      expect(rep.totales.asignado).toBe(5000.0);
      expect(rep.totales.ejecutado).toBe(400.0); // 400 Bs de la rendición aprobada
      expect(rep.totales.disponible).toBe(4600.0);
      expect(rep.partidas).toBeDefined();
    });

    it('debe generar el Kardex de Caja con saldo progresivo exacto', async () => {
      const kardex = await reportesService.getKardexCaja(testUnitId, 2026, adminUser);
      expect(kardex).toBeDefined();
      expect(kardex.movimientos.length).toBe(4);
      // Movimientos: Apertura (10000), Anticipo (-450), Devolución (+50), Reposición (+400) -> Saldo final: 10,000
      expect(kardex.resumen.saldoFinal).toBe(10000.0);
    });

    it('debe auditar el cumplimiento del plazo de 48 horas administrativas', async () => {
      const cumplimiento = await reportesService.getCumplimientoPlazos(
        2026,
        testUnitId,
        adminUser,
      );
      expect(cumplimiento).toBeDefined();
      expect(cumplimiento.totalAnticipos).toBe(1);
      expect(cumplimiento.totalRendidos).toBe(1);
      expect(cumplimiento.porcentajeCumplimiento).toBe(100.0);
    });
  });
});
