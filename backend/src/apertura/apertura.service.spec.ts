import { Test, TestingModule } from '@nestjs/testing';
import { AperturaService } from './apertura.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { EstadoCajaApertura, RolUsuario, TipoMovimientoEfectivo, Prisma } from '@prisma/client';

describe('AperturaService (Reglas de Apertura, Concurrencia y Entrada Única)', () => {
  let service: AperturaService;
  let prisma: any;
  let audit: any;

  const mockAdminUser = {
    id: 'admin-1',
    username: 'admin',
    nombreCompleto: 'Administrador',
    rol: RolUsuario.ADMINISTRADOR,
    unidades: [],
  };

  const mockAperturaBorrador = {
    id: 'apertura-1',
    unidadId: 'unit-1',
    gestion: 2026,
    responsableId: 'resp-1',
    montoAutorizado: new Prisma.Decimal('10000.00'),
    importeRecibido: new Prisma.Decimal('10000.00'),
    fechaApertura: new Date('2026-01-10'),
    docAutorizacion: 'Res. 01/2026',
    compIngreso: 'Egreso 101 / Cheque 99',
    estado: EstadoCajaApertura.BORRADOR,
    unidad: { id: 'unit-1', codigo: 'LP-ADM' },
    responsable: { id: 'resp-1', nombres: 'Carlos', apellidos: 'Pérez' },
  };

  beforeEach(async () => {
    prisma = {
      cajaApertura: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      responsable: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AperturaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AperturaService>(AperturaService);
  });

  it('debe confirmar apertura en transacción y crear una sola entrada de efectivo', async () => {
    prisma.cajaApertura.findUnique.mockResolvedValue(mockAperturaBorrador);

    let movimientoCreado: any = null;

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        cajaApertura: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({
            ...mockAperturaBorrador,
            estado: EstadoCajaApertura.ABIERTA,
            fechaConfirmacion: new Date(),
            confirmadoPorId: mockAdminUser.id,
            movimientos: [],
          }),
        },
        movimientoEfectivo: {
          create: jest.fn().mockImplementation((args: any) => {
            movimientoCreado = args.data;
            return { id: 'mov-1', ...args.data };
          }),
        },
      };
      return callback(txMock);
    });

    const result = await service.confirmarApertura('apertura-1', mockAdminUser);

    expect(result.caja.estado).toBe(EstadoCajaApertura.ABIERTA);
    expect(movimientoCreado).not.toBeNull();
    expect(movimientoCreado.tipo).toBe(TipoMovimientoEfectivo.APERTURA);
    expect(movimientoCreado.monto).toEqual(mockAperturaBorrador.importeRecibido);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'CONFIRMAR_APERTURA_CAJA' }),
    );
  });

  it('debe rechazar confirmación si la apertura ya estaba abierta (prevención de doble confirmación)', async () => {
    prisma.cajaApertura.findUnique.mockResolvedValue({
      ...mockAperturaBorrador,
      estado: EstadoCajaApertura.ABIERTA,
    });

    await expect(
      service.confirmarApertura('apertura-1', mockAdminUser),
    ).rejects.toThrow(ConflictException);
  });

  it('debe rechazar confirmación si otra transacción concurrente la confirmó simultáneamente (updateMany count = 0)', async () => {
    prisma.cajaApertura.findUnique.mockResolvedValue(mockAperturaBorrador);

    prisma.$transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        cajaApertura: {
          // Simula carrera: count es 0 porque otro proceso ya cambió el estado a ABIERTA
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return callback(txMock);
    });

    await expect(
      service.confirmarApertura('apertura-1', mockAdminUser),
    ).rejects.toThrow(ConflictException);
  });

  it('debe impedir edición directa de datos si la apertura ya fue confirmada', async () => {
    prisma.cajaApertura.findUnique.mockResolvedValue({
      ...mockAperturaBorrador,
      estado: EstadoCajaApertura.ABIERTA,
    });

    await expect(
      service.update(
        'apertura-1',
        {
          responsableId: 'resp-1',
          montoAutorizado: '12000.00',
          importeRecibido: '12000.00',
          fechaApertura: '2026-01-10',
          docAutorizacion: 'Res. 01/2026',
          compIngreso: 'Egreso 101',
        },
        mockAdminUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
