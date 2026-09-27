import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient, EstadoCajaApertura, TipoMovimientoEfectivo, RolUsuario, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { UnitAccessGuard, RolesGuard } from '../common/guards';
import { ExecutionContext, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { CreateAperturaDto } from '../apertura/dto/create-apertura.dto';
import { plainToInstance } from 'class-transformer';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import { PartidasService } from '../partidas/partidas.service';
import { UnitsService } from '../units/units.service';
import { UsersService } from '../users/users.service';
import { ResponsablesService } from '../responsables/responsables.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Pruebas de Integración Reales con PostgreSQL (caja_chica_cps_test)', () => {
  let prisma: PrismaClient;
  let unitAccessGuard: UnitAccessGuard;

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
    unitAccessGuard = new UnitAccessGuard(prisma as any);
  });

  afterAll(async () => {
    if (prisma) {
      // Limpiar datos ficticios exclusivamente de la base de prueba
      await prisma.movimientoEfectivo.deleteMany();
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

  const createMockContext = (user: any, params: any = {}, query: any = {}, body: any = {}, url = '/api'): ExecutionContext => {
    const req = {
      user,
      params,
      query,
      body,
      baseUrl: url,
      url,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => {},
      getClass: () => {},
    } as unknown as ExecutionContext;
  };

  it('1. Aislamiento entre dos unidades mediante resolución de recurso en PostgreSQL', async () => {
    // Crear Unidad A y Unidad B ficticias en la base de prueba
    const unitA = await prisma.unit.create({
      data: { codigo: 'TEST-UA', nombre: 'Unidad de Prueba A', dependencia: 'Central' },
    });
    const unitB = await prisma.unit.create({
      data: { codigo: 'TEST-UB', nombre: 'Unidad de Prueba B', dependencia: 'Central' },
    });

    // Responsable asignado formalmente a Unidad B
    const respB = await prisma.responsable.create({
      data: {
        unidadId: unitB.id,
        nombres: 'Responsable',
        apellidos: 'Unidad B',
        carnetIdentidad: '998877 LP',
        cargo: 'Encargado B',
        documentoDesignacion: 'Memo 002/2026',
        fechaDesignacion: new Date('2026-01-01'),
      },
    });

    // Usuario Encargado asignado EXCLUSIVAMENTE a Unidad A
    const userEncargadoA = {
      id: 'encargado-a-id',
      username: 'encargado_a',
      rol: RolUsuario.ENCARGADO,
      unidades: [unitA.id],
    };

    // Intento 1: Encargado A accede a su propia unidad A -> PERMITIDO
    const ctxA = createMockContext(userEncargadoA, { unidadId: unitA.id });
    await expect(unitAccessGuard.canActivate(ctxA)).resolves.toBe(true);

    // Intento 2: Encargado A intenta acceder a Unidad B por parámetro -> BLOQUEADO
    const ctxB = createMockContext(userEncargadoA, { unidadId: unitB.id });
    await expect(unitAccessGuard.canActivate(ctxB)).rejects.toThrow(ForbiddenException);

    // Intento 3: Encargado A intenta consultar el Responsable de Unidad B por ID directo -> BLOQUEADO
    const ctxRespB = createMockContext(userEncargadoA, { id: respB.id }, {}, {}, '/api/responsables');
    await expect(unitAccessGuard.canActivate(ctxRespB)).rejects.toThrow(ForbiddenException);
  });

  it('2. Rechazo de DTO inválidos (class-validator)', async () => {
    // DTO con importe recibido negativo, sin fecha y con código faltante
    const invalidData = {
      unidadId: 'algun-id',
      gestion: 1990, // Menor al mínimo permitido 2000
      responsableId: '',
      montoAutorizado: '10000.555', // Más de 2 decimales
      importeRecibido: '-500.00', // Negativo
      fechaApertura: 'fecha-invalida',
      docAutorizacion: '',
      compIngreso: '',
    };

    const dto = plainToInstance(CreateAperturaDto, invalidData);
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const propertyNames = errors.map((e) => e.property);
    expect(propertyNames).toContain('montoAutorizado');
    expect(propertyNames).toContain('importeRecibido');
    expect(propertyNames).toContain('gestion');
    expect(propertyNames).toContain('fechaApertura');
  });

  it('3. Dos confirmaciones simultáneas de la misma apertura (Concurrencia real en PostgreSQL): entrada única de efectivo', async () => {
    // Crear Unidad y Responsable para la prueba de apertura
    const unit = await prisma.unit.create({
      data: { codigo: 'TEST-CONF', nombre: 'Unidad Concurrencia', dependencia: 'Test' },
    });
    const resp = await prisma.responsable.create({
      data: {
        unidadId: unit.id,
        nombres: 'Mario',
        apellidos: 'Bross',
        carnetIdentidad: '554433 LP',
        cargo: 'Cajero Test',
        documentoDesignacion: 'Memo Conf',
        fechaDesignacion: new Date('2026-01-01'),
      },
    });

    // Crear Apertura en estado BORRADOR
    const apertura = await prisma.cajaApertura.create({
      data: {
        unidadId: unit.id,
        gestion: 2026,
        responsableId: resp.id,
        montoAutorizado: new Prisma.Decimal('10000.00'),
        importeRecibido: new Prisma.Decimal('10000.00'),
        fechaApertura: new Date('2026-01-15'),
        docAutorizacion: 'Res. Conf 01/2026',
        compIngreso: 'Egreso C-101',
        estado: EstadoCajaApertura.BORRADOR,
      },
    });

    // Función que replica exactamente la transacción atómica de AperturaService.confirmarApertura
    const ejecutarConfirmacion = async (actorId: string) => {
      return prisma.$transaction(async (tx) => {
        // Bloqueo atómico con condición: sólo actualiza si el estado actual es BORRADOR
        const updateResult = await tx.cajaApertura.updateMany({
          where: {
            id: apertura.id,
            estado: EstadoCajaApertura.BORRADOR,
          },
          data: {
            estado: EstadoCajaApertura.ABIERTA,
            fechaConfirmacion: new Date(),
            confirmadoPorId: actorId,
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException('Conflicto de concurrencia: La apertura ya fue confirmada previamente.');
        }

        // Crear una sola entrada de efectivo asociada
        const movimiento = await tx.movimientoEfectivo.create({
          data: {
            cajaAperturaId: apertura.id,
            tipo: TipoMovimientoEfectivo.APERTURA,
            monto: new Prisma.Decimal('10000.00'),
            descripcion: 'Fondo inicial recibido por apertura de caja chica',
            comprobanteReferencia: 'Egreso C-101',
            actorId,
          },
        });

        return movimiento;
      });
    };

    // Disparar dos confirmaciones concurrentes en paralelo sobre PostgreSQL
    const resultados = await Promise.allSettled([
      ejecutarConfirmacion('usuario-1'),
      ejecutarConfirmacion('usuario-2'),
    ]);

    // Una debe ser exitosa (fulfilled) y la otra debe ser rechazada (rejected con ConflictException)
    const exitosas = resultados.filter((r) => r.status === 'fulfilled');
    const rechazadas = resultados.filter((r) => r.status === 'rejected');

    expect(exitosas.length).toBe(1);
    expect(rechazadas.length).toBe(1);

    // Verificar en la base de datos real PostgreSQL que existe EXACTAMENTE UN movimiento de efectivo
    const movimientos = await prisma.movimientoEfectivo.findMany({
      where: { cajaAperturaId: apertura.id },
    });
    expect(movimientos.length).toBe(1);
    expect(movimientos[0].tipo).toBe(TipoMovimientoEfectivo.APERTURA);
    expect(movimientos[0].monto.toFixed(2)).toBe('10000.00');

    // Verificar que el estado en la base es ABIERTA
    const aperturaFinal = await prisma.cajaApertura.findUnique({
      where: { id: apertura.id },
    });
    expect(aperturaFinal?.estado).toBe(EstadoCajaApertura.ABIERTA);
  });

  it('4. Atomicidad transaccional: Ante fallo, no deben quedar movimientos ni cambios parciales en PostgreSQL', async () => {
    const unitRollback = await prisma.unit.create({
      data: { codigo: 'TEST-ROLL', nombre: 'Unidad Rollback', dependencia: 'Test' },
    });
    const respRollback = await prisma.responsable.create({
      data: {
        unidadId: unitRollback.id,
        nombres: 'Test',
        apellidos: 'Rollback',
        carnetIdentidad: '112233 LP',
        cargo: 'Responsable Rollback',
        documentoDesignacion: 'Memo Roll',
        fechaDesignacion: new Date('2026-01-01'),
      },
    });

    const aperturaRollback = await prisma.cajaApertura.create({
      data: {
        unidadId: unitRollback.id,
        gestion: 2026,
        responsableId: respRollback.id,
        montoAutorizado: new Prisma.Decimal('5000.00'),
        importeRecibido: new Prisma.Decimal('5000.00'),
        fechaApertura: new Date('2026-01-10'),
        docAutorizacion: 'Res. Rollback',
        compIngreso: 'Egreso Rollback',
        estado: EstadoCajaApertura.BORRADOR,
      },
    });

    // Transacción fallida intencionalmente a mitad de ejecución
    await expect(
      prisma.$transaction(async (tx) => {
        // Paso 1: Cambiar estado a ABIERTA
        await tx.cajaApertura.update({
          where: { id: aperturaRollback.id },
          data: { estado: EstadoCajaApertura.ABIERTA },
        });

        // Paso 2: Crear movimiento
        await tx.movimientoEfectivo.create({
          data: {
            cajaAperturaId: aperturaRollback.id,
            tipo: TipoMovimientoEfectivo.APERTURA,
            monto: new Prisma.Decimal('5000.00'),
            descripcion: 'Movimiento que debe revertirse',
            actorId: 'test-actor',
          },
        });

        // Paso 3: Lanzar excepción forzada
        throw new Error('FALLO_SIMULADO_POSTGRESQL');
      }),
    ).rejects.toThrow('FALLO_SIMULADO_POSTGRESQL');

    // Verificar en PostgreSQL: Estado debe seguir en BORRADOR y movimientos debe ser 0
    const aperturaVerif = await prisma.cajaApertura.findUnique({
      where: { id: aperturaRollback.id },
    });
    expect(aperturaVerif?.estado).toBe(EstadoCajaApertura.BORRADOR);

    const movimientosVerif = await prisma.movimientoEfectivo.findMany({
      where: { cajaAperturaId: aperturaRollback.id },
    });
    expect(movimientosVerif.length).toBe(0);
  });

  it('5. Importes exactos en PostgreSQL NUMERIC(14,2) y fechas DATE', async () => {
    const fondo = new Prisma.Decimal('15555.50');
    const decimalJs = new Decimal(fondo.toString());
    const limite10Pct = decimalJs.times(0.10);

    expect(limite10Pct.toFixed(2)).toBe('1555.55');

    // Crear partida con presupuesto de prueba
    const partida = await prisma.partida.create({
      data: { codigo: '31199', descripcion: 'Partida Test Decimales' },
    });

    const unit = await prisma.unit.findFirst();
    const presupuesto = await prisma.presupuestoPartida.create({
      data: {
        unidadId: unit!.id,
        gestion: 2026,
        partidaId: partida.id,
        montoAsignado: fondo,
      },
    });

    const guardado = await prisma.presupuestoPartida.findUnique({
      where: { id: presupuesto.id },
    });

    expect(guardado?.montoAsignado.toFixed(2)).toBe('15555.50');
  });

  it('6. Habilitación de partidas por unidad: aislamiento entre unidades A y B, rechazo de uso en unidad no habilitada y conservación histórica', async () => {
    const mockAuditService: any = { log: jest.fn().mockResolvedValue(true) };
    const presupuestosService = new PresupuestosService(prisma as any, mockAuditService);
    const partidasService = new PartidasService(prisma as any, mockAuditService);
    const unitsService = new UnitsService(prisma as any, mockAuditService);

    // 1. Crear dos unidades institucionales
    const unidadA = await prisma.unit.create({
      data: { codigo: 'H-LPZ-ISO', nombre: 'Hospital Petrolero La Paz' },
    });
    const unidadB = await prisma.unit.create({
      data: { codigo: 'H-CBB-ISO', nombre: 'Hospital Petrolero Cochabamba' },
    });

    // 2. Crear partida general en el clasificador
    const partida = await prisma.partida.create({
      data: { codigo: '31110-ISO', descripcion: 'Medicamentos Especiales ISO' },
    });

    // 3. Crear perfiles: Admin y Encargado de Unidad B
    const adminUser = { id: 'admin-iso', username: 'admin_iso', rol: RolUsuario.ADMINISTRADOR, unidades: [] };
    const encargadoB = { id: 'encargado-b', username: 'enc_cbb', rol: RolUsuario.ENCARGADO, unidades: [unidadB.id] };

    // 4. Habilitar partida ÚNICAMENTE en Unidad A
    await unitsService.togglePartidaHabilitada(
      unidadA.id,
      { partidaId: partida.id, activo: true },
      adminUser as any,
    );

    // 5. Verificar que en Unidad B no está habilitada
    const habilitadasB = await unitsService.getPartidasHabilitadas(unidadB.id, adminUser as any);
    const partidaEnB = habilitadasB.find((p: any) => p.partidaId === partida.id);
    expect(partidaEnB?.habilitado).toBe(false);

    // 6. Intento de asignar presupuesto para esta partida en Unidad B (enviando partidaId directamente)
    // DEBE SER RECHAZADO con BadRequestException
    await expect(
      presupuestosService.create(
        {
          unidadId: unidadB.id,
          gestion: 2026,
          partidaId: partida.id,
          montoAsignado: '10000.00',
        },
        adminUser as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // Verificar en BD que no quedó ningún registro en Unidad B
    const presupuestosEnB = await prisma.presupuestoPartida.findMany({
      where: { unidadId: unidadB.id, partidaId: partida.id },
    });
    expect(presupuestosEnB.length).toBe(0);

    // 7. Asignación de presupuesto en Unidad A (donde sí está habilitada)
    // DEBE TENER ÉXITO
    const presupuestoA = await presupuestosService.create(
      {
        unidadId: unidadA.id,
        gestion: 2026,
        partidaId: partida.id,
        montoAsignado: '15000.00',
      },
      adminUser as any,
    );
    expect(presupuestoA.montoAsignado).toBe('15000.00');

    // 8. Desactivar la habilitación en Unidad A
    await unitsService.togglePartidaHabilitada(
      unidadA.id,
      { partidaId: partida.id, activo: false },
      adminUser as any,
    );

    // 9. Verificar conservación histórica: presupuesto e historial en Unidad A permanecen intactos
    const presupuestoHistorico = await prisma.presupuestoPartida.findUnique({
      where: { id: presupuestoA.id },
      include: { historial: true },
    });
    expect(presupuestoHistorico).not.toBeNull();
    expect(presupuestoHistorico?.montoAsignado.toFixed(2)).toBe('15000.00');
    expect(presupuestoHistorico?.historial.length).toBeGreaterThan(0);

    // 10. Consulta de partidas por parte del Encargado de Unidad B:
    // Solo ve partidas habilitadas de B -> la lista no debe incluir la partida no habilitada
    const partidasParaEncargadoB = await partidasService.findAll({
      unidadId: unidadB.id,
      currentUser: encargadoB as any,
    });
    const encontrada = partidasParaEncargadoB.items.find((p: any) => p.id === partida.id);
    expect(encontrada).toBeUndefined();

    // 11. Encargado de Unidad B intenta consultar partidas de Unidad A: RECHAZADO con ForbiddenException
    await expect(
      partidasService.findAll({
        unidadId: unidadA.id,
        currentUser: encargadoB as any,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('7. Independencia presupuestaria estricta entre unidades: Misma partida admite montos distintos y modificar uno no afecta al otro ni genera efectivo', async () => {
    const mockAuditService: any = { log: jest.fn().mockResolvedValue(true) };
    const presupuestosService = new PresupuestosService(prisma as any, mockAuditService);
    const unitsService = new UnitsService(prisma as any, mockAuditService);

    // 1. Crear dos unidades distintas
    const unit1 = await prisma.unit.create({
      data: { codigo: 'DEP-LPZ', nombre: 'Policlínico 9 de Abril' },
    });
    const unit2 = await prisma.unit.create({
      data: { codigo: 'DEP-SCZ', nombre: 'Policlínico Santa Cruz' },
    });

    // 2. Crear una única partida general
    const partida = await prisma.partida.create({
      data: { codigo: '39100-TEST', descripcion: 'Material de Escritorio' },
    });

    const adminUser = { id: 'admin-test-presupuesto', username: 'admin_test', rol: RolUsuario.ADMINISTRADOR, unidades: [] };

    // 3. Habilitar la partida en ambas unidades individualmente
    await unitsService.togglePartidaHabilitada(unit1.id, { partidaId: partida.id, activo: true }, adminUser as any);
    await unitsService.togglePartidaHabilitada(unit2.id, { partidaId: partida.id, activo: true }, adminUser as any);

    // 4. Asignar presupuestos independientes para la misma gestión (2026):
    // Unit1: Bs. 5,000.00
    // Unit2: Bs. 12,000.00
    const presUnit1 = await presupuestosService.create(
      {
        unidadId: unit1.id,
        gestion: 2026,
        partidaId: partida.id,
        montoAsignado: '5000.00',
      },
      adminUser as any,
    );

    const presUnit2 = await presupuestosService.create(
      {
        unidadId: unit2.id,
        gestion: 2026,
        partidaId: partida.id,
        montoAsignado: '12000.00',
      },
      adminUser as any,
    );

    expect(presUnit1.montoAsignado).toBe('5000.00');
    expect(presUnit2.montoAsignado).toBe('12000.00');

    // 5. Verificar montos calculados por unidad de forma independiente
    const listUnit1 = await presupuestosService.findAll({ unidadId: unit1.id, gestion: 2026, currentUser: adminUser as any });
    const listUnit2 = await presupuestosService.findAll({ unidadId: unit2.id, gestion: 2026, currentUser: adminUser as any });

    const item1 = listUnit1.items.find((p) => p.partida.codigo === '39100-TEST');
    const item2 = listUnit2.items.find((p) => p.partida.codigo === '39100-TEST');

    expect(item1?.montoAsignado).toBe('5000.00');
    expect(item2?.montoAsignado).toBe('12000.00');

    // 6. Modificar el monto de Unit1 a Bs. 8,000.00
    await presupuestosService.update(
      presUnit1.id,
      { montoAsignado: '8000.00', motivo: 'Incremento de partida para Unidad 1' },
      adminUser as any,
    );

    // 7. Verificar que Unit1 cambió a 8,000.00 y Unit2 PERMANECE EXACTAMENTE EN 12,000.00
    const item1Actualizado = await prisma.presupuestoPartida.findUnique({ where: { id: presUnit1.id } });
    const item2Intacto = await prisma.presupuestoPartida.findUnique({ where: { id: presUnit2.id } });

    expect(item1Actualizado?.montoAsignado.toFixed(2)).toBe('8000.00');
    expect(item2Intacto?.montoAsignado.toFixed(2)).toBe('12000.00');

    // 8. Confirmar que asignar o modificar presupuesto NO generó ningún movimiento de efectivo en caja
    const movimientosEfectivo = await prisma.movimientoEfectivo.findMany({
      where: {
        cajaApertura: {
          unidadId: { in: [unit1.id, unit2.id] },
        },
      },
    });
    expect(movimientosEfectivo.length).toBe(0);
  });

  it('8. Registro Unificado de Encargado y Responsable de Caja Chica: Creación atómica, edición sin duplicidad, protección de acceso y conservación histórica', async () => {
    const mockAuditService: any = { log: jest.fn().mockResolvedValue(true) };
    const usersService = new UsersService(prisma as any, mockAuditService);
    const responsablesService = new ResponsablesService(prisma as any, mockAuditService);

    const adminUser = { id: 'admin-super', username: 'admin_test', rol: RolUsuario.ADMINISTRADOR, unidades: [] };

    // 1. Crear dos unidades de prueba
    const uCentral = await prisma.unit.create({
      data: { codigo: 'H-CENTRAL', nombre: 'Hospital Petrolero Central' },
    });
    const uNorte = await prisma.unit.create({
      data: { codigo: 'H-NORTE', nombre: 'Clínica Integral Norte' },
    });

    // 2. Crear un encargado con designación y unidad en una sola operación atómica
    const encargadoCreado = await usersService.create(
      {
        username: 'mrodriguez',
        nombres: 'María Elena',
        apellidos: 'Rodríguez Flores',
        email: 'mrodriguez@cps.org.bo',
        password: 'PasswordSegura#2026',
        rol: RolUsuario.ENCARGADO,
        carnetIdentidad: '7845123 LP',
        cargo: 'Encargada de Fondos',
        designaciones: [
          {
            unidadId: uCentral.id,
            documentoDesignacion: 'Memo RRHH 101/2026',
            fechaDesignacion: '2026-01-10',
            cargo: 'Encargada Titular Central',
          },
        ],
      },
      adminUser as any,
    );

    expect(encargadoCreado.username).toBe('mrodriguez');
    expect(encargadoCreado.carnetIdentidad).toBe('7845123 LP');
    expect(encargadoCreado.responsables.length).toBe(1);
    expect(encargadoCreado.responsables[0].documentoDesignacion).toBe('Memo RRHH 101/2026');
    expect(encargadoCreado.responsables[0].userId).toBe(encargadoCreado.id);
    expect(encargadoCreado.unidades.length).toBe(1);
    expect(encargadoCreado.unidades[0].id).toBe(uCentral.id);

    // 3. Impedir acceso a unidades no asignadas:
    const ctxPermitido = createMockContext(
      { id: encargadoCreado.id, username: 'mrodriguez', rol: RolUsuario.ENCARGADO, unidades: [uCentral.id] },
      { unidadId: uCentral.id },
    );
    await expect(unitAccessGuard.canActivate(ctxPermitido)).resolves.toBe(true);

    const ctxDenegado = createMockContext(
      { id: encargadoCreado.id, username: 'mrodriguez', rol: RolUsuario.ENCARGADO, unidades: [uCentral.id] },
      { unidadId: uNorte.id },
    );
    await expect(unitAccessGuard.canActivate(ctxDenegado)).rejects.toThrow(ForbiddenException);

    // 4. Mostrar el encargado correspondiente en la apertura (responsables activos para uCentral):
    const respsParaApertura = await responsablesService.findAll({
      unidadId: uCentral.id,
      activo: true,
      currentUser: adminUser as any,
    });
    expect(respsParaApertura.items.length).toBe(1);
    expect(respsParaApertura.items[0].carnetIdentidad).toBe('7845123 LP');
    expect(respsParaApertura.items[0].user?.username).toBe('mrodriguez');

    // 5. Completar un usuario existente sin duplicar cuenta ni perfil (simulación del caso "alinares"):
    // Crear un usuario que inicialmente sólo tenía credenciales y UserUnit, pero sin perfil ni Responsable
    const usuarioBase = await prisma.user.create({
      data: {
        username: 'joperador',
        nombreCompleto: 'Juan Operador',
        passwordHash: 'hash-ficticio',
        rol: RolUsuario.ENCARGADO,
        activo: true,
        unidades: {
          create: [{ unitId: uCentral.id }],
        },
      },
    });

    // Ahora se edita para completar CI, cargo y su designación formal:
    const usuarioActualizado = await usersService.update(
      usuarioBase.id,
      {
        nombres: 'Juan Carlos',
        apellidos: 'Operador Quispe',
        carnetIdentidad: '3456789 CB',
        cargo: 'Cajero Operador',
        designaciones: [
          {
            unidadId: uCentral.id,
            documentoDesignacion: 'Memo CITE 088/2026',
            fechaDesignacion: '2026-02-01',
          },
        ],
      },
      adminUser as any,
    );

    expect(usuarioActualizado.id).toBe(usuarioBase.id); // Conserva su mismo ID
    expect(usuarioActualizado.carnetIdentidad).toBe('3456789 CB');
    expect(usuarioActualizado.responsables.length).toBe(1);
    expect(usuarioActualizado.responsables[0].userId).toBe(usuarioBase.id);

    // Verificar en la BD que NO se duplicaron usuarios
    const countUsers = await prisma.user.count({ where: { username: 'joperador' } });
    expect(countUsers).toBe(1);

    // 6. Conservar referencias históricas al cambiar una designación o reasignar unidades:
    // Agregar uNorte al usuario mrodriguez y remover uCentral
    await usersService.update(
      encargadoCreado.id,
      {
        designaciones: [
          {
            unidadId: uNorte.id,
            documentoDesignacion: 'Memo Reasignación 202/2026',
            fechaDesignacion: '2026-03-01',
          },
        ],
      },
      adminUser as any,
    );

    // La designación anterior de uCentral NO fue eliminada de la base, sino desactivada:
    const respHistoricoCentral = await prisma.responsable.findFirst({
      where: { userId: encargadoCreado.id, unidadId: uCentral.id },
    });
    expect(respHistoricoCentral).not.toBeNull();
    expect(respHistoricoCentral?.activo).toBe(false);

    // La nueva designación en uNorte está activa:
    const respNuevaNorte = await prisma.responsable.findFirst({
      where: { userId: encargadoCreado.id, unidadId: uNorte.id },
    });
    expect(respNuevaNorte).not.toBeNull();
    expect(respNuevaNorte?.activo).toBe(true);

    // 7. Desactivar la cuenta debe impedir su uso operativo en la apertura:
    await usersService.update(encargadoCreado.id, { activo: false }, adminUser as any);

    const respsActivosNorte = await responsablesService.findAll({
      unidadId: uNorte.id,
      activo: true,
      currentUser: adminUser as any,
    });
    const encontradoDesactivado = respsActivosNorte.items.find((r) => r.userId === encargadoCreado.id);
    expect(encontradoDesactivado).toBeUndefined(); // Excluido porque su cuenta de usuario está inactiva

    // 8. Revertir toda la operación si falla una parte del registro (Atomicidad de Transacción):
    await expect(
      usersService.create(
        {
          username: 'fallido_user',
          nombres: 'Fallo',
          apellidos: 'Simulado',
          password: 'PasswordValida#2026',
          rol: RolUsuario.ENCARGADO,
          carnetIdentidad: '111111 LP',
          cargo: 'Cargo Test',
          designaciones: [
            {
              unidadId: 'unidad-inexistente-que-causa-error',
              documentoDesignacion: 'Memo Invalido',
              fechaDesignacion: '2026-01-01',
            },
          ],
        },
        adminUser as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // Comprobar en PostgreSQL que el usuario "fallido_user" NO fue creado (Rollback completo)
    const usuarioRollback = await prisma.user.findUnique({
      where: { username: 'fallido_user' },
    });
    expect(usuarioRollback).toBeNull();
  });

  it('9. Configuración integral de partidas y presupuestos desde Unidades Institucionales', async () => {
    const auditService = { log: jest.fn().mockResolvedValue({}) };
    const unitsService = new UnitsService(prisma as any, auditService as any);

    const adminUser = {
      id: 'admin-uuid',
      username: 'admin',
      rol: RolUsuario.ADMINISTRADOR,
      unidades: [],
    };

    const encargadoUser = {
      id: 'enc-uuid',
      username: 'encargado',
      rol: RolUsuario.ENCARGADO,
      unidades: [],
    };

    const initialMovimientosCount = await prisma.movimientoEfectivo.count();

    // 1. Crear 2 unidades y 1 partida en la base de prueba
    const u1 = await prisma.unit.create({
      data: { codigo: 'CONF-U1', nombre: 'Unidad Config 1', dependencia: 'Central' },
    });
    const u2 = await prisma.unit.create({
      data: { codigo: 'CONF-U2', nombre: 'Unidad Config 2', dependencia: 'Central' },
    });
    const p1 = await prisma.partida.create({
      data: { codigo: '99100', descripcion: 'Partida Test Configuración' },
    });

    // 2. Habilitar la partida y asignarle presupuesto desde la unidad 1 (Gestión 2026: 5000.00)
    const res1 = await unitsService.savePartidasPresupuestos(
      u1.id,
      {
        gestion: 2026,
        items: [
          {
            partidaId: p1.id,
            habilitado: true,
            montoAsignado: '5000.00',
            motivo: 'Asignación U1 2026',
          },
        ],
      },
      adminUser as any,
    );

    expect(res1.partidasHabilitadas).toBe(1);
    expect(res1.partidasConPresupuesto).toBe(1);
    expect(res1.totalPresupuestado).toBe('5000.00');

    // 3. Asignar un monto DISTINTO a la misma partida en Unidad 2 (Gestión 2026: 8500.50)
    const res2 = await unitsService.savePartidasPresupuestos(
      u2.id,
      {
        gestion: 2026,
        items: [
          {
            partidaId: p1.id,
            habilitado: true,
            montoAsignado: '8500.50',
            motivo: 'Asignación U2 2026',
          },
        ],
      },
      adminUser as any,
    );

    expect(res2.totalPresupuestado).toBe('8500.50');

    // Comprobar que en Unidad 1 sigue siendo 5000.00 (Independencia total entre unidades)
    const checkU1 = await unitsService.getPartidasConPresupuesto(u1.id, 2026, adminUser as any);
    const itemU1 = checkU1.items.find((i) => i.partidaId === p1.id);
    expect(itemU1?.montoAsignado).toBe('5000.00');
    expect(itemU1?.habilitado).toBe(true);

    // 4. Modificar el monto en Unidad 1 (Gestión 2026: 6200.00) sin afectar Unidad 2 ni otra gestión (Gestión 2025)
    // Asignar también en Gestión 2025 para Unidad 1: 3000.00
    await unitsService.savePartidasPresupuestos(
      u1.id,
      {
        gestion: 2025,
        items: [
          {
            partidaId: p1.id,
            habilitado: true,
            montoAsignado: '3000.00',
            motivo: 'Asignación U1 2025',
          },
        ],
      },
      adminUser as any,
    );

    // Ajustar Gestión 2026 en Unidad 1:
    await unitsService.savePartidasPresupuestos(
      u1.id,
      {
        gestion: 2026,
        items: [
          {
            partidaId: p1.id,
            habilitado: true,
            montoAsignado: '6200.00',
            motivo: 'Reasignación aprobada',
          },
        ],
      },
      adminUser as any,
    );

    // Comprobar Gestión 2026 en U1 actualizada a 6200.00
    const checkU1_2026 = await unitsService.getPartidasConPresupuesto(u1.id, 2026, adminUser as any);
    expect(checkU1_2026.items.find((i) => i.partidaId === p1.id)?.montoAsignado).toBe('6200.00');

    // Comprobar que Gestión 2025 en U1 sigue siendo 3000.00
    const checkU1_2025 = await unitsService.getPartidasConPresupuesto(u1.id, 2025, adminUser as any);
    expect(checkU1_2025.items.find((i) => i.partidaId === p1.id)?.montoAsignado).toBe('3000.00');

    // Comprobar que Unidad 2 en Gestión 2026 sigue intacta en 8500.50
    const checkU2_2026 = await unitsService.getPartidasConPresupuesto(u2.id, 2026, adminUser as any);
    expect(checkU2_2026.items.find((i) => i.partidaId === p1.id)?.montoAsignado).toBe('8500.50');

    // 5. Comprobar que NO se crearon movimientos de efectivo
    const movimientosCount = await prisma.movimientoEfectivo.count();
    expect(movimientosCount).toBe(initialMovimientosCount);

    // 6. Deshabilitar la partida en Unidad 1 NO elimina su presupuesto ni historial
    await unitsService.savePartidasPresupuestos(
      u1.id,
      {
        gestion: 2026,
        items: [
          {
            partidaId: p1.id,
            habilitado: false,
          },
        ],
      },
      adminUser as any,
    );

    const checkU1_deshabilitada = await unitsService.getPartidasConPresupuesto(u1.id, 2026, adminUser as any);
    const itemDeshab = checkU1_deshabilitada.items.find((i) => i.partidaId === p1.id);
    expect(itemDeshab?.habilitado).toBe(false);
    expect(itemDeshab?.montoAsignado).toBe('6200.00'); // Presupuesto preservado
    expect(itemDeshab?.historial?.length).toBeGreaterThan(0); // Historial preservado

    // 7. Validar permisos: Solo el ADMINISTRADOR puede configurar partidas y presupuestos
    await expect(
      unitsService.savePartidasPresupuestos(
        u1.id,
        {
          gestion: 2026,
          items: [{ partidaId: p1.id, habilitado: true }],
        },
        encargadoUser as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('10. Reglas de partidas deshabilitadas, preservación histórica y restricciones ENCARGADO vs ADMINISTRADOR', async () => {
    const auditService = { log: jest.fn().mockResolvedValue({}) };
    const unitsService = new UnitsService(prisma as any, auditService as any);
    const presupuestosService = new PresupuestosService(prisma as any, auditService as any);
    const responsablesService = new ResponsablesService(prisma as any, auditService as any);

    const adminUser = {
      id: 'admin-uuid-10',
      username: 'admin10',
      rol: RolUsuario.ADMINISTRADOR,
      unidades: [],
    };

    // Crear unidades U1 y U2
    const u1 = await prisma.unit.create({
      data: { codigo: 'REG-U1', nombre: 'Unidad Reglas 1', dependencia: 'Central' },
    });
    const u2 = await prisma.unit.create({
      data: { codigo: 'REG-U2', nombre: 'Unidad Reglas 2', dependencia: 'Central' },
    });

    const encargadoU1 = {
      id: 'enc-u1-uuid',
      username: 'encargado_u1',
      rol: RolUsuario.ENCARGADO,
      unidades: [u1.id],
    };

    // Crear partida pTest
    const pTest = await prisma.partida.create({
      data: { codigo: '99200', descripcion: 'Partida Test Reglas Deshabilitada' },
    });

    // 1. Partida deshabilitada: rechaza nueva asignación por API
    await expect(
      presupuestosService.create(
        {
          unidadId: u1.id,
          partidaId: pTest.id,
          gestion: 2026,
          montoAsignado: '1000.00',
        },
        adminUser as any,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      unitsService.savePartidasPresupuestos(
        u1.id,
        {
          gestion: 2026,
          items: [{ partidaId: pTest.id, habilitado: false, montoAsignado: '1000.00' }],
        },
        adminUser as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // 2. Habilitar y asignar en un solo guardado: permitido
    const saveSingleRes = await unitsService.savePartidasPresupuestos(
      u1.id,
      {
        gestion: 2026,
        items: [
          {
            partidaId: pTest.id,
            habilitado: true,
            montoAsignado: '4500.00',
            motivo: 'Asignación conjunta',
          },
        ],
      },
      adminUser as any,
    );

    const itemGuardado = saveSingleRes.items.find((i) => i.partidaId === pTest.id);
    expect(itemGuardado?.habilitado).toBe(true);
    expect(itemGuardado?.montoAsignado).toBe('4500.00');
    expect(saveSingleRes.totalPresupuestoHabilitado).toBe('4500.00');

    // 3. Deshabilitar con presupuesto previo: preserva historial y presupuesto intacto
    await unitsService.savePartidasPresupuestos(
      u1.id,
      {
        gestion: 2026,
        items: [{ partidaId: pTest.id, habilitado: false }],
      },
      adminUser as any,
    );

    const getPresDeshab = await unitsService.getPartidasConPresupuesto(u1.id, 2026, adminUser as any);
    const itemDeshab = getPresDeshab.items.find((i) => i.partidaId === pTest.id);
    expect(itemDeshab?.habilitado).toBe(false);
    expect(itemDeshab?.montoAsignado).toBe('4500.00');
    expect(itemDeshab?.historial?.length).toBeGreaterThan(0);
    expect(getPresDeshab.totalPresupuestoHabilitado).toBe('0.00');
    expect(getPresDeshab.totalPresupuestoDeshabilitado).toBe('4500.00');

    // 4. Partida deshabilitada: rechaza modificación por API
    await expect(
      unitsService.savePartidasPresupuestos(
        u1.id,
        {
          gestion: 2026,
          items: [{ partidaId: pTest.id, montoAsignado: '9000.00' }],
        },
        adminUser as any,
      ),
    ).rejects.toThrow(BadRequestException);

    const presPartida = await prisma.presupuestoPartida.findUnique({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: u1.id,
          gestion: 2026,
          partidaId: pTest.id,
        },
      },
    });

    await expect(
      presupuestosService.update(
        presPartida!.id,
        { montoAsignado: '9000.00', motivo: 'Intento de ajuste en deshabilitada' },
        adminUser as any,
      ),
    ).rejects.toThrow(BadRequestException);

    // 5. Encargado: puede consultar su presupuesto pero cualquier modificación devuelve 403
    const consultaEncargado = await presupuestosService.findAll({
      unidadId: u1.id,
      gestion: 2026,
      currentUser: encargadoU1 as any,
    });
    expect(consultaEncargado.items.length).toBeGreaterThan(0);

    const consultaUnitsEncargado = await unitsService.getPartidasConPresupuesto(
      u1.id,
      2026,
      encargadoU1 as any,
    );
    expect(consultaUnitsEncargado.items.length).toBeGreaterThan(0);

    // Intentos de modificación por el Encargado -> 403 Forbidden
    await expect(
      presupuestosService.create(
        { unidadId: u1.id, partidaId: pTest.id, gestion: 2026, montoAsignado: '1000.00' },
        encargadoU1 as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      presupuestosService.update(
        presPartida!.id,
        { montoAsignado: '2000.00', motivo: 'Encargado intentando modificar' },
        encargadoU1 as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      unitsService.savePartidasPresupuestos(
        u1.id,
        { gestion: 2026, items: [{ partidaId: pTest.id, habilitado: true }] },
        encargadoU1 as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      responsablesService.create(
        {
          unidadId: u1.id,
          nombres: 'Intruso',
          apellidos: 'Intruso',
          carnetIdentidad: '9999999',
          cargo: 'Encargado',
          documentoDesignacion: 'RES-001',
          fechaDesignacion: '2026-01-01',
        },
        encargadoU1 as any,
      ),
    ).rejects.toThrow(ForbiddenException);

    // 6. Encargado: no puede consultar unidades ajenas
    await expect(
      presupuestosService.findAll({
        unidadId: u2.id,
        gestion: 2026,
        currentUser: encargadoU1 as any,
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      unitsService.getPartidasConPresupuesto(u2.id, 2026, encargadoU1 as any),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      unitsService.findOne(u2.id, encargadoU1 as any),
    ).rejects.toThrow();
  });
});


