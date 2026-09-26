import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateResponsableDto, UpdateResponsableDto } from './dto/create-responsable.dto';
import { AuthenticatedUser } from '../common/decorators';
import { RolUsuario } from '@prisma/client';

@Injectable()
export class ResponsablesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private checkUnitPermission(unidadId: string, currentUser: AuthenticatedUser) {
    if (currentUser.rol === RolUsuario.ADMINISTRADOR) return;
    if (!currentUser.unidades.includes(unidadId)) {
      throw new ForbiddenException('No tiene permisos para gestionar responsables en esta unidad.');
    }
  }

  async create(createDto: CreateResponsableDto, currentUser: AuthenticatedUser) {
    this.checkUnitPermission(createDto.unidadId, currentUser);

    const unit = await this.prisma.unit.findUnique({
      where: { id: createDto.unidadId },
    });
    if (!unit) {
      throw new NotFoundException('Unidad institucional no encontrada.');
    }

    const responsable = await this.prisma.responsable.create({
      data: {
        unidadId: createDto.unidadId,
        nombres: createDto.nombres.trim(),
        apellidos: createDto.apellidos.trim(),
        carnetIdentidad: createDto.carnetIdentidad.trim(),
        cargo: createDto.cargo.trim(),
        documentoDesignacion: createDto.documentoDesignacion.trim(),
        fechaDesignacion: new Date(createDto.fechaDesignacion),
      },
      include: {
        unidad: true,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CREAR_RESPONSABLE',
      entidad: 'Responsable',
      entidadId: responsable.id,
      detalle: {
        nombres: responsable.nombres,
        apellidos: responsable.apellidos,
        unidadCodigo: unit.codigo,
      },
    });

    return responsable;
  }

  async findAll(params: {
    unidadId?: string;
    page?: number;
    limit?: number;
    search?: string;
    activo?: boolean;
    desvinculados?: boolean;
    currentUser: AuthenticatedUser;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.desvinculados) {
      where.userId = null;
    }
    if (params.activo !== undefined) {
      if (params.activo === true) {
        where.activo = true;
        where.NOT = {
          user: {
            activo: false,
          },
        };
      } else {
        where.activo = false;
      }
    }

    if (params.currentUser.rol === RolUsuario.ENCARGADO) {
      if (params.unidadId) {
        this.checkUnitPermission(params.unidadId, params.currentUser);
        where.unidadId = params.unidadId;
      } else {
        where.unidadId = { in: params.currentUser.unidades };
      }
    } else if (params.unidadId) {
      where.unidadId = params.unidadId;
    }

    if (params.search) {
      where.OR = [
        { nombres: { contains: params.search, mode: 'insensitive' } },
        { apellidos: { contains: params.search, mode: 'insensitive' } },
        { carnetIdentidad: { contains: params.search, mode: 'insensitive' } },
        { documentoDesignacion: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.responsable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          unidad: true,
          user: {
            select: {
              id: true,
              username: true,
              nombreCompleto: true,
              email: true,
              activo: true,
              rol: true,
            },
          },
        },
      }),
      this.prisma.responsable.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, currentUser: AuthenticatedUser) {
    const responsable = await this.prisma.responsable.findUnique({
      where: { id },
      include: {
        unidad: true,
        user: {
          select: {
            id: true,
            username: true,
            nombreCompleto: true,
            email: true,
            activo: true,
            rol: true,
          },
        },
      },
    });

    if (!responsable) {
      throw new NotFoundException('Responsable no encontrado.');
    }

    this.checkUnitPermission(responsable.unidadId, currentUser);
    return responsable;
  }

  async update(
    id: string,
    updateDto: UpdateResponsableDto,
    currentUser: AuthenticatedUser,
  ) {
    const responsable = await this.prisma.responsable.findUnique({ where: { id } });
    if (!responsable) {
      throw new NotFoundException('Responsable no encontrado.');
    }

    this.checkUnitPermission(responsable.unidadId, currentUser);

    const data: any = {};
    if (updateDto.nombres) data.nombres = updateDto.nombres.trim();
    if (updateDto.apellidos) data.apellidos = updateDto.apellidos.trim();
    if (updateDto.carnetIdentidad) data.carnetIdentidad = updateDto.carnetIdentidad.trim();
    if (updateDto.cargo) data.cargo = updateDto.cargo.trim();
    if (updateDto.documentoDesignacion) data.documentoDesignacion = updateDto.documentoDesignacion.trim();
    if (updateDto.fechaDesignacion) data.fechaDesignacion = new Date(updateDto.fechaDesignacion);
    if (updateDto.activo !== undefined) data.activo = updateDto.activo;

    const updated = await this.prisma.responsable.update({
      where: { id },
      data,
      include: {
        unidad: true,
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ACTUALIZAR_RESPONSABLE',
      entidad: 'Responsable',
      entidadId: id,
      detalle: data,
    });

    return updated;
  }

  async deactivate(id: string, currentUser: AuthenticatedUser) {
    const responsable = await this.prisma.responsable.findUnique({ where: { id } });
    if (!responsable) {
      throw new NotFoundException('Responsable no encontrado.');
    }

    this.checkUnitPermission(responsable.unidadId, currentUser);

    const updated = await this.prisma.responsable.update({
      where: { id },
      data: { activo: false },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'DESACTIVAR_RESPONSABLE',
      entidad: 'Responsable',
      entidadId: id,
      detalle: { nombres: responsable.nombres, apellidos: responsable.apellidos },
    });

    return { message: 'Responsable desactivado exitosamente.', responsable: updated };
  }
}
