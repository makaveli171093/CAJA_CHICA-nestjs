import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignUnitsDto } from './dto/assign-units.dto';
import { AuthenticatedUser } from '../common/decorators';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({
      where: { username: createUserDto.username.trim() },
    });

    if (existing) {
      throw new ConflictException(
        `El nombre de usuario "${createUserDto.username}" ya está registrado en el sistema.`,
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        username: createUserDto.username.trim(),
        nombreCompleto: createUserDto.nombreCompleto.trim(),
        email: createUserDto.email?.trim().toLowerCase() || null,
        passwordHash,
        rol: createUserDto.rol,
        unidades: createUserDto.unidades?.length
          ? {
              create: createUserDto.unidades.map((unitId) => ({ unitId })),
            }
          : undefined,
      },
      include: {
        unidades: {
          include: {
            unit: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CREAR_USUARIO',
      entidad: 'User',
      entidadId: user.id,
      detalle: { username: user.username, rol: user.rol },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    rol?: any;
    activo?: boolean;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.activo !== undefined) where.activo = params.activo;
    if (params.rol) where.rol = params.rol;
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { nombreCompleto: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nombreCompleto: 'asc' },
        include: {
          unidades: {
            include: {
              unit: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rawItems.map(({ passwordHash: _, ...user }) => ({
      ...user,
      unidades: user.unidades.map((u) => u.unit),
    }));

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        unidades: {
          include: {
            unit: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const { passwordHash: _, ...safeUser } = user;
    return {
      ...safeUser,
      unidades: user.unidades.map((u) => u.unit),
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const data: any = {};
    if (updateUserDto.nombreCompleto) data.nombreCompleto = updateUserDto.nombreCompleto.trim();
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email?.trim().toLowerCase() || null;
    if (updateUserDto.rol) data.rol = updateUserDto.rol;
    if (updateUserDto.activo !== undefined) data.activo = updateUserDto.activo;

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ACTUALIZAR_USUARIO',
      entidad: 'User',
      entidadId: id,
      detalle: {
        nombreCompleto: data.nombreCompleto,
        email: data.email,
        rol: data.rol,
        activo: data.activo,
        passwordModificado: !!updateUserDto.password,
      },
    });

    const { passwordHash: _, ...safeUser } = updated;
    return safeUser;
  }

  async assignUnits(id: string, assignUnitsDto: AssignUnitsDto, currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Verificar que todas las unidades existan
    const existingUnits = await this.prisma.unit.findMany({
      where: { id: { in: assignUnitsDto.unitIds } },
    });

    if (existingUnits.length !== assignUnitsDto.unitIds.length) {
      throw new BadRequestException('Una o más unidades indicadas no existen.');
    }

    // Transacción para reemplazar asignaciones de manera atómica
    await this.prisma.$transaction(async (tx) => {
      await tx.userUnit.deleteMany({ where: { userId: id } });
      if (assignUnitsDto.unitIds.length > 0) {
        await tx.userUnit.createMany({
          data: assignUnitsDto.unitIds.map((unitId) => ({
            userId: id,
            unitId,
          })),
        });
      }
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ASIGNAR_UNIDADES_USUARIO',
      entidad: 'User',
      entidadId: id,
      detalle: {
        userId: id,
        unidadesAsignadas: assignUnitsDto.unitIds,
      },
    });

    return this.findOne(id);
  }
}
