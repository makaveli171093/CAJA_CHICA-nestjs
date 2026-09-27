import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto';
import { AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class PresupuestosService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (currentUser.rol === RolUsuario.ADMINISTRADOR) return;
    if (!currentUser.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene permisos para operar en esta unidad.');
    }
  }

  async create(createDto: CreatePresupuestoDto, currentUser: AuthenticatedUser) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR) {
      throw new ForbiddenException('Solo el administrador puede asignar presupuestos a partidas.');
    }
    this.checkUnitPermission(createDto.unidadId, currentUser);

    // Validar que la partida presupuestaria esté previamente habilitada para esta unidad institucional
    const partidaHabilitada = await this.prisma.unidadPartida.findUnique({
      where: {
        unidadId_partidaId: {
          unidadId: createDto.unidadId,
          partidaId: createDto.partidaId,
        },
      },
    });

    if (!partidaHabilitada || !partidaHabilitada.activo) {
      throw new BadRequestException(
        'La partida presupuestaria no está habilitada para esta unidad. Habilite la partida antes de asignar presupuesto.',
      );
    }

    const existing = await this.prisma.presupuestoPartida.findUnique({
      where: {
        unidadId_gestion_partidaId: {
          unidadId: createDto.unidadId,
          gestion: createDto.gestion,
          partidaId: createDto.partidaId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una asignación presupuestaria para esta partida en la gestión ${createDto.gestion}. Modifique la existente si requiere ajustar el monto.`,
      );
    }

    const decimalMonto = new Prisma.Decimal(createDto.montoAsignado);

    const result = await this.prisma.$transaction(async (tx) => {
      const presupuesto = await tx.presupuestoPartida.create({
        data: {
          unidadId: createDto.unidadId,
          gestion: createDto.gestion,
          partidaId: createDto.partidaId,
          montoAsignado: decimalMonto,
        },
        include: {
          partida: true,
          unidad: true,
        },
      });

      await tx.presupuestoHistorial.create({
        data: {
          presupuestoPartidaId: presupuesto.id,
          montoAnterior: new Prisma.Decimal('0.00'),
          montoNuevo: decimalMonto,
          motivo: 'Asignación presupuestaria inicial',
          actorId: currentUser.id,
          actorUsername: currentUser.username,
        },
      });

      return presupuesto;
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ASIGNAR_PRESUPUESTO_PARTIDA',
      entidad: 'PresupuestoPartida',
      entidadId: result.id,
      detalle: {
        unidadId: createDto.unidadId,
        gestion: createDto.gestion,
        partidaId: createDto.partidaId,
        montoAsignado: createDto.montoAsignado,
      },
    });

    return {
      ...result,
      montoAsignado: result.montoAsignado.toFixed(2),
    };
  }

  async findAll(params: {
    unidadId: string;
    gestion: number;
    currentUser: AuthenticatedUser;
  }) {
    this.checkUnitPermission(params.unidadId, params.currentUser);

    const [presupuestos, asignaciones] = await Promise.all([
      this.prisma.presupuestoPartida.findMany({
        where: {
          unidadId: params.unidadId,
          gestion: Number(params.gestion),
        },
        include: {
          partida: true,
          unidad: true,
          historial: {
            orderBy: { fecha: 'desc' },
          },
        },
        orderBy: {
          partida: { codigo: 'asc' },
        },
      }),
      this.prisma.unidadPartida.findMany({
        where: { unidadId: params.unidadId },
      }),
    ]);

    const mapaHabilitadas = new Map<string, boolean>();
    asignaciones.forEach((a) => mapaHabilitadas.set(a.partidaId, a.activo));

    let totalHabilitado = new Decimal('0.00');
    let totalDeshabilitado = new Decimal('0.00');

    const formatted = presupuestos.map((item) => {
      const habilitado = mapaHabilitadas.get(item.partidaId) || false;
      const itemDecimal = new Decimal(item.montoAsignado.toString());

      if (habilitado) {
        totalHabilitado = totalHabilitado.plus(itemDecimal);
      } else {
        totalDeshabilitado = totalDeshabilitado.plus(itemDecimal);
      }

      return {
        ...item,
        habilitado,
        montoAsignado: item.montoAsignado.toFixed(2),
        historial: item.historial.map((h) => ({
          ...h,
          montoAnterior: h.montoAnterior.toFixed(2),
          montoNuevo: h.montoNuevo.toFixed(2),
        })),
      };
    });

    return {
      items: formatted,
      totalPresupuesto: totalHabilitado.toFixed(2),
      totalPresupuestoHabilitado: totalHabilitado.toFixed(2),
      totalPresupuestoDeshabilitado: totalDeshabilitado.toFixed(2),
      cantidadPartidas: formatted.length,
      cantidadPartidasHabilitadas: formatted.filter((i) => i.habilitado).length,
      cantidadPartidasDeshabilitadas: formatted.filter((i) => !i.habilitado).length,
    };
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const item = await this.prisma.presupuestoPartida.findUnique({
      where: { id },
      include: {
        partida: true,
        unidad: true,
        historial: {
          orderBy: { fecha: 'desc' },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Asignación presupuestaria no encontrada.');
    }

    this.checkUnitPermission(item.unidadId, currentUser);

    return {
      ...item,
      montoAsignado: item.montoAsignado.toFixed(2),
      historial: item.historial.map((h) => ({
        ...h,
        montoAnterior: h.montoAnterior.toFixed(2),
        montoNuevo: h.montoNuevo.toFixed(2),
      })),
    };
  }

  async update(
    id: string,
    updateDto: UpdatePresupuestoDto,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR) {
      throw new ForbiddenException('Solo el administrador puede modificar asignaciones presupuestarias.');
    }

    const item = await this.prisma.presupuestoPartida.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Asignación presupuestaria no encontrada.');
    }

    this.checkUnitPermission(item.unidadId, currentUser);

    // Validar que la partida presupuestaria siga habilitada para la unidad
    const partidaHabilitada = await this.prisma.unidadPartida.findUnique({
      where: {
        unidadId_partidaId: {
          unidadId: item.unidadId,
          partidaId: item.partidaId,
        },
      },
    });

    if (!partidaHabilitada || !partidaHabilitada.activo) {
      throw new BadRequestException(
        'No se puede modificar el presupuesto de una partida deshabilitada para esta unidad. Habilite la partida antes de ajustar su monto.',
      );
    }

    const montoAnterior = item.montoAsignado;
    const montoNuevo = new Prisma.Decimal(updateDto.montoAsignado);

    const updated = await this.prisma.$transaction(async (tx) => {
      const presupuesto = await tx.presupuestoPartida.update({
        where: { id },
        data: {
          montoAsignado: montoNuevo,
        },
        include: {
          partida: true,
          unidad: true,
        },
      });

      await tx.presupuestoHistorial.create({
        data: {
          presupuestoPartidaId: id,
          montoAnterior,
          montoNuevo,
          motivo: updateDto.motivo.trim(),
          actorId: currentUser.id,
          actorUsername: currentUser.username,
        },
      });

      return presupuesto;
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'MODIFICAR_PRESUPUESTO_PARTIDA',
      entidad: 'PresupuestoPartida',
      entidadId: id,
      detalle: {
        montoAnterior: montoAnterior.toFixed(2),
        montoNuevo: montoNuevo.toFixed(2),
        motivo: updateDto.motivo,
      },
    });

    return {
      ...updated,
      montoAsignado: updated.montoAsignado.toFixed(2),
    };
  }
}
