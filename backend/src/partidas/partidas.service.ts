import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePartidaDto, UpdatePartidaDto } from './dto/create-partida.dto';
import { AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class PartidasService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createDto: CreatePartidaDto, currentUser: AuthenticatedUser) {
    const existing = await this.prisma.partida.findUnique({
      where: { codigo: createDto.codigo.trim() },
    });

    if (existing) {
      throw new ConflictException(
        `La partida con código "${createDto.codigo}" ya existe en el clasificador presupuestario.`,
      );
    }

    const partida = await this.prisma.partida.create({
      data: {
        codigo: createDto.codigo.trim(),
        descripcion: createDto.descripcion.trim(),
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CREAR_PARTIDA',
      entidad: 'Partida',
      entidadId: partida.id,
      detalle: { codigo: partida.codigo, descripcion: partida.descripcion },
    });

    return partida;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    activo?: boolean;
    unidadId?: string;
    currentUser?: AuthenticatedUser;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.activo !== undefined) where.activo = params.activo;

    if (params.currentUser) {
      if (params.currentUser.rol === RolUsuario.ENCARGADO) {
        if (params.unidadId) {
          if (!params.currentUser.unidades.includes(params.unidadId)) {
            throw new ForbiddenException('No tiene permisos para consultar partidas de esta unidad.');
          }
          where.unidadesHabilitadas = {
            some: {
              unidadId: params.unidadId,
              activo: true,
            },
          };
        } else {
          where.unidadesHabilitadas = {
            some: {
              unidadId: { in: params.currentUser.unidades },
              activo: true,
            },
          };
        }
      } else if (params.currentUser.rol === RolUsuario.ADMINISTRADOR && params.unidadId) {
        where.unidadesHabilitadas = {
          some: {
            unidadId: params.unidadId,
            activo: true,
          },
        };
      }
    } else if (params.unidadId) {
      where.unidadesHabilitadas = {
        some: {
          unidadId: params.unidadId,
          activo: true,
        },
      };
    }

    if (params.search) {
      where.OR = [
        { codigo: { contains: params.search, mode: 'insensitive' } },
        { descripcion: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.partida.findMany({
        where,
        skip,
        take: limit,
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.partida.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const partida = await this.prisma.partida.findUnique({ where: { id } });
    if (!partida) {
      throw new NotFoundException('Partida no encontrada.');
    }
    return partida;
  }

  async update(id: string, updateDto: UpdatePartidaDto, currentUser: AuthenticatedUser) {
    const partida = await this.prisma.partida.findUnique({ where: { id } });
    if (!partida) {
      throw new NotFoundException('Partida no encontrada.');
    }

    const data: any = {};
    if (updateDto.descripcion) data.descripcion = updateDto.descripcion.trim();
    if (updateDto.activo !== undefined) data.activo = updateDto.activo;

    const updated = await this.prisma.partida.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ACTUALIZAR_PARTIDA',
      entidad: 'Partida',
      entidadId: id,
      detalle: data,
    });

    return updated;
  }

  async deactivate(id: string, currentUser: AuthenticatedUser) {
    const partida = await this.prisma.partida.findUnique({ where: { id } });
    if (!partida) {
      throw new NotFoundException('Partida no encontrada.');
    }

    const updated = await this.prisma.partida.update({
      where: { id },
      data: { activo: false },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'DESACTIVAR_PARTIDA',
      entidad: 'Partida',
      entidadId: id,
      detalle: { codigo: partida.codigo },
    });

    return { message: `Partida "${partida.codigo}" desactivada correctamente.`, partida: updated };
  }
}
