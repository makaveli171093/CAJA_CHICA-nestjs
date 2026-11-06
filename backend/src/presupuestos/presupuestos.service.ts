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
import { calcularDisponibilidadPresupuesto } from '../common/utils/presupuesto-calculo';

@Injectable()
export class PresupuestosService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ADMINISTRADOR ||
      currentUser.rol === RolUsuario.FINANCIERO ||
      currentUser.rol === RolUsuario.GERENCIA
    ) {
      return;
    }
    if (!currentUser.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene permisos para operar en esta unidad.');
    }
  }

  async create(createDto: CreatePresupuestoDto, currentUser: AuthenticatedUser) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR && currentUser.rol !== RolUsuario.FINANCIERO) {
      throw new ForbiddenException('Solo el administrador o financiero pueden asignar presupuestos a partidas.');
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

    const [presupuestos, asignaciones, anticipos] = await Promise.all([
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
      this.prisma.anticipo.findMany({
        where: {
          cajaApertura: {
            unidadId: params.unidadId,
            gestion: Number(params.gestion),
          },
          estado: 'PENDIENTE',
        },
        include: {
          pedido: { select: { partidaId: true } },
        },
      }),
    ]);

    const mapaHabilitadas = new Map<string, boolean>();
    asignaciones.forEach((a) => mapaHabilitadas.set(a.partidaId, a.activo));

    const mapaComprometido = new Map<string, Decimal>();
    anticipos.forEach((ant) => {
      const pId = ant.pedido.partidaId;
      const prev = mapaComprometido.get(pId) || new Decimal('0.00');
      mapaComprometido.set(pId, prev.plus(new Decimal(ant.monto.toString())));
    });

    let totalHabilitado = new Decimal('0.00');
    let totalDeshabilitado = new Decimal('0.00');
    let totalComprometido = new Decimal('0.00');

    const formatted = presupuestos.map((item) => {
      const habilitado = mapaHabilitadas.get(item.partidaId) || false;
      const itemDecimal = new Decimal(item.montoAsignado.toString());
      const comprometidoPartida = mapaComprometido.get(item.partidaId) || new Decimal('0.00');
      // REGLA CENTRALIZADA CPS: disponible = asignado - comprometidoPendiente - ejecutado
      const calculoPres = calcularDisponibilidadPresupuesto(itemDecimal, comprometidoPartida, 0);
      const disponiblePartida = calculoPres.disponible;

      if (habilitado) {
        totalHabilitado = totalHabilitado.plus(itemDecimal);
        totalComprometido = totalComprometido.plus(comprometidoPartida);
      } else {
        totalDeshabilitado = totalDeshabilitado.plus(itemDecimal);
      }

      return {
        ...item,
        habilitado,
        montoAsignado: item.montoAsignado.toFixed(2),
        comprometido: comprometidoPartida.toFixed(2),
        disponible: disponiblePartida.toFixed(2),
        historial: item.historial.map((h) => ({
          ...h,
          montoAnterior: h.montoAnterior.toFixed(2),
          montoNuevo: h.montoNuevo.toFixed(2),
        })),
      };
    });

    const totalDisponible = totalHabilitado.minus(totalComprometido);

    return {
      items: formatted,
      totalPresupuesto: totalHabilitado.toFixed(2),
      totalPresupuestoHabilitado: totalHabilitado.toFixed(2),
      totalPresupuestoDeshabilitado: totalDeshabilitado.toFixed(2),
      totalComprometido: totalComprometido.toFixed(2),
      totalDisponible: totalDisponible.toFixed(2),
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
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR && currentUser.rol !== RolUsuario.FINANCIERO) {
      throw new ForbiddenException('Solo el administrador o financiero pueden modificar asignaciones presupuestarias.');
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
    const montoNuevoDec = new Decimal(updateDto.montoAsignado);
    const montoNuevo = new Prisma.Decimal(montoNuevoDec.toFixed(2));

    const updated = await this.prisma.$transaction(
      async (tx) => {
        // 1. Bloqueo estricto de fila en presupuestos_partidas para serializar con entregas concurrentes
        await tx.$queryRaw`
          SELECT id FROM "presupuestos_partidas" WHERE id = ${id} FOR UPDATE
        `;

        // 2. Consultar anticipos pendientes dentro de la transacción protegida
        const anticiposPendientes = await tx.anticipo.findMany({
          where: {
            cajaApertura: {
              unidadId: item.unidadId,
              gestion: item.gestion,
            },
            pedido: {
              partidaId: item.partidaId,
            },
            estado: 'PENDIENTE',
          },
          select: { monto: true },
        });

        let totalComprometido = new Decimal('0.00');
        for (const ant of anticiposPendientes) {
          totalComprometido = totalComprometido.plus(new Decimal(ant.monto.toString()));
        }
        const totalEjecutado = new Decimal('0.00'); // Fase 2A: sin descargos ejecutados aún
        // REGLA CENTRALIZADA CPS: minimoPermitidoParaAjuste = comprometidoPendiente + ejecutado
        const calculo = calcularDisponibilidadPresupuesto(item.montoAsignado.toString(), totalComprometido, totalEjecutado);

        if (montoNuevoDec.lessThan(calculo.minimoPermitidoParaAjuste)) {
          throw new BadRequestException(
            `No se puede reducir el presupuesto por debajo de Bs ${calculo.minimoPermitidoParaAjuste.toFixed(2)}, monto actualmente comprometido en anticipos pendientes de rendición más gasto ejecutado.`,
          );
        }

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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

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
