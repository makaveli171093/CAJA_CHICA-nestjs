import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
import { SavePartidasPresupuestosDto } from './dto/save-partidas-presupuestos.dto';
import { AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class UnitsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createUnitDto: CreateUnitDto, currentUser: AuthenticatedUser) {
    const existing = await this.prisma.unit.findUnique({
      where: { codigo: createUnitDto.codigo.trim().toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una unidad con el código "${createUnitDto.codigo}".`,
      );
    }

    const unit = await this.prisma.unit.create({
      data: {
        codigo: createUnitDto.codigo.trim().toUpperCase(),
        nombre: createUnitDto.nombre.trim(),
        dependencia: createUnitDto.dependencia?.trim() || null,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CREAR_UNIDAD',
      entidad: 'Unit',
      entidadId: unit.id,
      detalle: { codigo: unit.codigo, nombre: unit.nombre },
    });

    return unit;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    activo?: boolean;
    currentUser: AuthenticatedUser;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.activo !== undefined) {
      where.activo = params.activo;
    }

    if (params.currentUser.rol === RolUsuario.ENCARGADO) {
      // Encargado solo ve sus unidades asignadas
      where.id = { in: params.currentUser.unidades };
    }

    if (params.search) {
      where.OR = [
        { codigo: { contains: params.search, mode: 'insensitive' } },
        { nombre: { contains: params.search, mode: 'insensitive' } },
        { dependencia: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.unit.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ENCARGADO &&
      !currentUser.unidades.includes(id)
    ) {
      throw new NotFoundException('Unidad no encontrada o no autorizada.');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        responsables: {
          where: { activo: true },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }

    return unit;
  }

  async update(
    id: string,
    updateUnitDto: UpdateUnitDto,
    currentUser: AuthenticatedUser,
  ) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unidad no encontrada.');
    }

    const data: any = {};
    if (updateUnitDto.nombre !== undefined) data.nombre = updateUnitDto.nombre.trim();
    if (updateUnitDto.dependencia !== undefined)
      data.dependencia = updateUnitDto.dependencia?.trim() || null;
    if (updateUnitDto.activo !== undefined) data.activo = updateUnitDto.activo;

    const updated = await this.prisma.unit.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ACTUALIZAR_UNIDAD',
      entidad: 'Unit',
      entidadId: id,
      detalle: data,
    });

    return updated;
  }

  async deactivate(id: string, currentUser: AuthenticatedUser) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unidad no encontrada.');
    }

    // Soft delete / desactivar catálogo usado para preservar trazabilidad
    const updated = await this.prisma.unit.update({
      where: { id },
      data: { activo: false },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'DESACTIVAR_UNIDAD',
      entidad: 'Unit',
      entidadId: id,
      detalle: { codigo: unit.codigo },
    });

    return { message: `Unidad "${unit.nombre}" desactivada con éxito.`, unit: updated };
  }

  async getPartidasHabilitadas(unidadId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ENCARGADO &&
      !currentUser.unidades.includes(unidadId)
    ) {
      throw new NotFoundException('Unidad no encontrada o no autorizada.');
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: unidadId } });
    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }

    if (currentUser.rol === RolUsuario.ENCARGADO) {
      // Encargados solo ven las partidas activas que están habilitadas para esta unidad
      const habilitadas = await this.prisma.unidadPartida.findMany({
        where: {
          unidadId,
          activo: true,
          partida: { activo: true },
        },
        include: {
          partida: true,
        },
        orderBy: {
          partida: { codigo: 'asc' },
        },
      });

      return habilitadas.map((h) => ({
        id: h.id,
        partidaId: h.partidaId,
        codigo: h.partida.codigo,
        descripcion: h.partida.descripcion,
        habilitado: true,
      }));
    }

    // Administrador: obtiene el catálogo completo indicando cuáles están habilitadas
    const [todasPartidas, asignaciones] = await Promise.all([
      this.prisma.partida.findMany({
        where: { activo: true },
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.unidadPartida.findMany({
        where: { unidadId },
      }),
    ]);

    const mapaAsignaciones = new Map<string, boolean>();
    asignaciones.forEach((a) => mapaAsignaciones.set(a.partidaId, a.activo));

    return todasPartidas.map((p) => ({
      partidaId: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      habilitado: mapaAsignaciones.get(p.id) || false,
    }));
  }

  async togglePartidaHabilitada(
    unidadId: string,
    dto: { partidaId: string; activo: boolean },
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR) {
      throw new BadRequestException('Solo el administrador puede habilitar o inhabilitar partidas.');
    }

    const [unit, partida] = await Promise.all([
      this.prisma.unit.findUnique({ where: { id: unidadId } }),
      this.prisma.partida.findUnique({ where: { id: dto.partidaId } }),
    ]);

    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }
    if (!partida) {
      throw new NotFoundException('Partida presupuestaria no encontrada en el clasificador.');
    }

    const record = await this.prisma.unidadPartida.upsert({
      where: {
        unidadId_partidaId: {
          unidadId,
          partidaId: dto.partidaId,
        },
      },
      create: {
        unidadId,
        partidaId: dto.partidaId,
        activo: dto.activo,
      },
      update: {
        activo: dto.activo,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: dto.activo ? 'HABILITAR_PARTIDA_UNIDAD' : 'DESHABILITAR_PARTIDA_UNIDAD',
      entidad: 'UnidadPartida',
      entidadId: record.id,
      detalle: {
        unidadId,
        codigoUnidad: unit.codigo,
        partidaId: dto.partidaId,
        codigoPartida: partida.codigo,
        activo: dto.activo,
      },
    });

    return {
      message: `Partida ${partida.codigo} ${dto.activo ? 'habilitada' : 'deshabilitada'} para ${unit.codigo}.`,
      item: record,
    };
  }

  async getPendientesPresupuesto(unidadId: string, currentUser: AuthenticatedUser) {
    if (
      currentUser.rol === RolUsuario.ENCARGADO &&
      !currentUser.unidades.includes(unidadId)
    ) {
      throw new NotFoundException('Unidad no encontrada o no autorizada.');
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: unidadId } });
    if (!unit) {
      throw new NotFoundException('Unidad no encontrada.');
    }

    // Buscar partidas con presupuestos registrados en esta unidad
    const presupuestos = await this.prisma.presupuestoPartida.findMany({
      where: { unidadId },
      include: { partida: true },
    });

    if (presupuestos.length === 0) {
      return [];
    }

    // Obtener partidas actualmente habilitadas
    const habilitadas = await this.prisma.unidadPartida.findMany({
      where: { unidadId, activo: true },
    });
    const habilitadasSet = new Set(habilitadas.map((h) => h.partidaId));

    // Filtrar aquellas con presupuesto previo que no están habilitadas
    const pendientesMap = new Map<string, any>();
    for (const p of presupuestos) {
      if (!habilitadasSet.has(p.partidaId) && !pendientesMap.has(p.partidaId)) {
        pendientesMap.set(p.partidaId, {
          partidaId: p.partida.id,
          codigo: p.partida.codigo,
          descripcion: p.partida.descripcion,
          gestion: p.gestion,
          montoRegistrado: p.montoAsignado.toFixed(2),
        });
      }
    }

    return Array.from(pendientesMap.values());
  }

  async getPartidasConPresupuesto(
    unidadId: string,
    gestion: number,
    currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.rol === RolUsuario.ENCARGADO &&
      !currentUser.unidades.includes(unidadId)
    ) {
      throw new ForbiddenException('No tiene permisos para consultar datos de esta unidad.');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unidadId },
      select: { id: true, codigo: true, nombre: true, dependencia: true, activo: true },
    });

    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }

    const numGestion = Number(gestion) || new Date().getFullYear();

    const [todasPartidas, asignaciones, presupuestos] = await Promise.all([
      this.prisma.partida.findMany({
        where: { activo: true },
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.unidadPartida.findMany({
        where: { unidadId },
      }),
      this.prisma.presupuestoPartida.findMany({
        where: { unidadId, gestion: numGestion },
        include: {
          historial: {
            orderBy: { fecha: 'desc' },
            take: 5,
          },
        },
      }),
    ]);

    const mapaHabilitadas = new Map<string, boolean>();
    asignaciones.forEach((a) => mapaHabilitadas.set(a.partidaId, a.activo));

    const mapaPresupuestos = new Map<string, any>();
    presupuestos.forEach((p) => mapaPresupuestos.set(p.partidaId, p));

    let totalHabilitado = new Decimal('0.00');
    let totalDeshabilitado = new Decimal('0.00');

    const items = todasPartidas.map((p) => {
      const pres = mapaPresupuestos.get(p.id);
      const habilitado = mapaHabilitadas.get(p.id) || false;

      let montoAsignado: string | null = null;
      let presupuestoId: string | null = null;

      if (pres) {
        presupuestoId = pres.id;
        montoAsignado = pres.montoAsignado.toFixed(2);
        if (habilitado) {
          totalHabilitado = totalHabilitado.plus(new Decimal(pres.montoAsignado.toString()));
        } else {
          totalDeshabilitado = totalDeshabilitado.plus(new Decimal(pres.montoAsignado.toString()));
        }
      }

      return {
        partidaId: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        habilitado,
        presupuestoId,
        montoAsignado,
        historial: pres
          ? pres.historial.map((h: any) => ({
              ...h,
              montoAnterior: h.montoAnterior.toFixed(2),
              montoNuevo: h.montoNuevo.toFixed(2),
            }))
          : [],
      };
    });

    return {
      unidad: unit,
      gestion: numGestion,
      items,
      totalPresupuestado: totalHabilitado.toFixed(2),
      totalPresupuestoHabilitado: totalHabilitado.toFixed(2),
      totalPresupuestoDeshabilitado: totalDeshabilitado.toFixed(2),
      partidasHabilitadas: items.filter((i) => i.habilitado).length,
      partidasConPresupuesto: items.filter((i) => i.presupuestoId !== null).length,
      partidasDeshabilitadasConPresupuesto: items.filter(
        (i) => !i.habilitado && i.presupuestoId !== null,
      ).length,
      totalPartidasCatalogo: items.length,
    };
  }

  async savePartidasPresupuestos(
    unidadId: string,
    dto: SavePartidasPresupuestosDto,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.rol !== RolUsuario.ADMINISTRADOR) {
      throw new ForbiddenException('Solo el administrador puede configurar partidas y presupuestos.');
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: unidadId } });
    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }

    const numGestion = Number(dto.gestion);
    if (!numGestion || numGestion < 2020 || numGestion > 2100) {
      throw new BadRequestException('Gestión fiscal inválida.');
    }

    // Validar montos monetarios antes de iniciar la transacción
    for (const item of dto.items) {
      if (
        item.montoAsignado !== undefined &&
        item.montoAsignado !== null &&
        item.montoAsignado.trim() !== ''
      ) {
        const val = item.montoAsignado.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(val)) {
          throw new BadRequestException(
            `El monto presupuestario para la partida debe ser un número decimal válido mayor o igual a 0.00 con hasta 2 decimales.`,
          );
        }
        const dec = new Decimal(val);
        if (dec.isNegative() || dec.greaterThan('999999999999.99')) {
          throw new BadRequestException('El monto presupuestario está fuera de los límites permitidos.');
        }
      }
    }

    // Ejecutar todas las operaciones en una sola transacción ACID
    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        // 1. Determinar el estado final de habilitación de la partida para esta unidad
        let finalHabilitado: boolean;
        if (item.habilitado !== undefined) {
          finalHabilitado = item.habilitado;
        } else {
          const currentUp = await tx.unidadPartida.findUnique({
            where: {
              unidadId_partidaId: {
                unidadId,
                partidaId: item.partidaId,
              },
            },
          });
          finalHabilitado = currentUp?.activo ?? false;
        }

        const existingPresupuesto = await tx.presupuestoPartida.findUnique({
          where: {
            unidadId_gestion_partidaId: {
              unidadId,
              gestion: numGestion,
              partidaId: item.partidaId,
            },
          },
        });

        const hasMontoInput =
          item.montoAsignado !== undefined &&
          item.montoAsignado !== null &&
          item.montoAsignado.trim() !== '';

        // REGLA: Si la partida queda o está deshabilitada, rechazar nuevas asignaciones o cambios de monto
        if (!finalHabilitado && hasMontoInput) {
          const montoStr = new Decimal(item.montoAsignado.trim()).toFixed(2);
          const decimalMonto = new Prisma.Decimal(montoStr);

          if (!existingPresupuesto) {
            const partidaInfo = await tx.partida.findUnique({ where: { id: item.partidaId } });
            const codigoPartida = partidaInfo?.codigo || item.partidaId;
            throw new BadRequestException(
              `No se puede asignar presupuesto a la partida ${codigoPartida} porque no está habilitada para esta unidad. Habilite la partida antes de asignar presupuesto.`,
            );
          } else if (!existingPresupuesto.montoAsignado.equals(decimalMonto)) {
            const partidaInfo = await tx.partida.findUnique({ where: { id: item.partidaId } });
            const codigoPartida = partidaInfo?.codigo || item.partidaId;
            throw new BadRequestException(
              `No se puede modificar el presupuesto de la partida ${codigoPartida} porque está deshabilitada para esta unidad. Habilite la partida antes de modificar su monto.`,
            );
          }
        }

        // 2. Actualizar estado de habilitación si fue especificado
        if (item.habilitado !== undefined) {
          await tx.unidadPartida.upsert({
            where: {
              unidadId_partidaId: {
                unidadId,
                partidaId: item.partidaId,
              },
            },
            create: {
              unidadId,
              partidaId: item.partidaId,
              activo: item.habilitado,
            },
            update: {
              activo: item.habilitado,
            },
          });
        }

        // 3. Crear o actualizar presupuesto si la partida queda habilitada y se especificó un monto válido
        if (finalHabilitado && hasMontoInput) {
          const montoStr = new Decimal(item.montoAsignado.trim()).toFixed(2);
          const decimalMonto = new Prisma.Decimal(montoStr);

          if (existingPresupuesto) {
            if (!existingPresupuesto.montoAsignado.equals(decimalMonto)) {
              const montoAnterior = existingPresupuesto.montoAsignado;
              await tx.presupuestoPartida.update({
                where: { id: existingPresupuesto.id },
                data: { montoAsignado: decimalMonto },
              });

              await tx.presupuestoHistorial.create({
                data: {
                  presupuestoPartidaId: existingPresupuesto.id,
                  montoAnterior,
                  montoNuevo: decimalMonto,
                  motivo:
                    (item.motivo && item.motivo.trim()) ||
                    'Ajuste presupuestario desde configuración de unidad',
                  actorId: currentUser.id,
                  actorUsername: currentUser.username,
                },
              });
            }
          } else {
            const nuevo = await tx.presupuestoPartida.create({
              data: {
                unidadId,
                gestion: numGestion,
                partidaId: item.partidaId,
                montoAsignado: decimalMonto,
              },
            });

            await tx.presupuestoHistorial.create({
              data: {
                presupuestoPartidaId: nuevo.id,
                montoAnterior: new Prisma.Decimal('0.00'),
                montoNuevo: decimalMonto,
                motivo:
                  (item.motivo && item.motivo.trim()) ||
                  'Asignación presupuestaria inicial desde unidad',
                actorId: currentUser.id,
                actorUsername: currentUser.username,
              },
            });
          }
        }
      }
    });

    // Auditoría institucional
    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CONFIGURAR_PARTIDAS_PRESUPUESTOS_UNIDAD',
      entidad: 'Unit',
      entidadId: unidadId,
      detalle: {
        unidadId,
        gestion: numGestion,
        itemsModificados: dto.items.length,
      },
    });

    return this.getPartidasConPresupuesto(unidadId, numGestion, currentUser);
  }
}
