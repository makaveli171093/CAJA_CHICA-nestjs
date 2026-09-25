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
}
