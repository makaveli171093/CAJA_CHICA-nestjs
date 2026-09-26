import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
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
}
