import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';
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

    // Validación para rol ENCARGADO
    if (createUserDto.rol === RolUsuario.ENCARGADO) {
      if (!createUserDto.carnetIdentidad?.trim()) {
        throw new BadRequestException('El carnet de identidad es obligatorio para usuarios con rol ENCARGADO.');
      }
      if (!createUserDto.cargo?.trim()) {
        throw new BadRequestException('El cargo institucional es obligatorio para usuarios con rol ENCARGADO.');
      }
      const hasDesignaciones = createUserDto.designaciones && createUserDto.designaciones.length > 0;
      const hasUnidades = createUserDto.unidades && createUserDto.unidades.length > 0;
      if (!hasDesignaciones && !hasUnidades) {
        throw new BadRequestException(
          'Debe asignar al menos una unidad institucional con su documento y fecha de designación para el encargado.',
        );
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const nombres = createUserDto.nombres?.trim() || null;
    const apellidos = createUserDto.apellidos?.trim() || null;
    let nombreCompleto = createUserDto.nombreCompleto?.trim();
    if (!nombreCompleto) {
      if (nombres && apellidos) {
        nombreCompleto = `${nombres} ${apellidos}`.trim();
      } else if (nombres) {
        nombreCompleto = nombres;
      } else {
        nombreCompleto = createUserDto.username.trim();
      }
    }

    const carnetIdentidad = createUserDto.carnetIdentidad?.trim() || null;
    const cargo = createUserDto.cargo?.trim() || null;
    const activo = createUserDto.activo !== undefined ? createUserDto.activo : true;

    // Transacción atómica: usuario, perfil, permisos de unidad y designaciones
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: createUserDto.username.trim(),
          nombres,
          apellidos,
          nombreCompleto,
          email: createUserDto.email?.trim().toLowerCase() || null,
          passwordHash,
          rol: createUserDto.rol,
          activo,
          carnetIdentidad,
          cargo,
        },
      });

      // Procesar designaciones para rol ENCARGADO
      if (createUserDto.rol === RolUsuario.ENCARGADO) {
        if (createUserDto.designaciones && createUserDto.designaciones.length > 0) {
          const unitIds = createUserDto.designaciones.map((d) => d.unidadId);
          const unitsExist = await tx.unit.findMany({ where: { id: { in: unitIds } } });
          if (unitsExist.length !== unitIds.length) {
            throw new BadRequestException('Una o más unidades indicadas en las designaciones no existen.');
          }

          // Crear permisos en usuario_unidades
          await tx.userUnit.createMany({
            data: unitIds.map((unitId) => ({
              userId: newUser.id,
              unitId,
            })),
          });

          // Crear o vincular fichas de Responsable
          for (const desig of createUserDto.designaciones) {
            if (desig.responsableId) {
              // Vinculación explícita de ficha existente
              await tx.responsable.update({
                where: { id: desig.responsableId },
                data: {
                  userId: newUser.id,
                  unidadId: desig.unidadId,
                  nombres: nombres || nombreCompleto,
                  apellidos: apellidos || '',
                  carnetIdentidad: carnetIdentidad || '',
                  cargo: desig.cargo?.trim() || cargo || 'Encargado de Caja Chica',
                  documentoDesignacion: desig.documentoDesignacion.trim(),
                  fechaDesignacion: new Date(desig.fechaDesignacion),
                  activo,
                },
              });
            } else {
              // Nueva designación de responsable
              await tx.responsable.create({
                data: {
                  userId: newUser.id,
                  unidadId: desig.unidadId,
                  nombres: nombres || nombreCompleto,
                  apellidos: apellidos || '',
                  carnetIdentidad: carnetIdentidad || '',
                  cargo: desig.cargo?.trim() || cargo || 'Encargado de Caja Chica',
                  documentoDesignacion: desig.documentoDesignacion.trim(),
                  fechaDesignacion: new Date(desig.fechaDesignacion),
                  activo,
                },
              });
            }
          }
        } else if (createUserDto.unidades && createUserDto.unidades.length > 0) {
          // Asignación de unidades tradicional
          await tx.userUnit.createMany({
            data: createUserDto.unidades.map((unitId) => ({
              userId: newUser.id,
              unitId,
            })),
          });
        }
      }

      return newUser;
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'CREAR_USUARIO_UNIFICADO',
      entidad: 'User',
      entidadId: user.id,
      detalle: { username: user.username, rol: user.rol, nombreCompleto: user.nombreCompleto },
    });

    return this.findOne(user.id);
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
        { nombres: { contains: params.search, mode: 'insensitive' } },
        { apellidos: { contains: params.search, mode: 'insensitive' } },
        { carnetIdentidad: { contains: params.search, mode: 'insensitive' } },
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
          responsables: {
            include: {
              unidad: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rawItems.map(({ passwordHash: _, ...user }) => ({
      ...user,
      unidades: user.unidades.map((u) => u.unit),
      responsables: user.responsables,
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
        responsables: {
          include: {
            unidad: true,
          },
          orderBy: { createdAt: 'desc' },
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
      responsables: user.responsables,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: AuthenticatedUser) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        unidades: true,
        responsables: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const targetRol = updateUserDto.rol || existingUser.rol;

    const nombres = updateUserDto.nombres !== undefined ? updateUserDto.nombres?.trim() || null : existingUser.nombres;
    const apellidos = updateUserDto.apellidos !== undefined ? updateUserDto.apellidos?.trim() || null : existingUser.apellidos;

    let nombreCompleto = updateUserDto.nombreCompleto?.trim();
    if (!nombreCompleto) {
      if (nombres && apellidos) {
        nombreCompleto = `${nombres} ${apellidos}`.trim();
      } else if (nombres) {
        nombreCompleto = nombres;
      } else {
        nombreCompleto = existingUser.nombreCompleto;
      }
    }

    const carnetIdentidad = updateUserDto.carnetIdentidad !== undefined
      ? updateUserDto.carnetIdentidad?.trim() || null
      : existingUser.carnetIdentidad;
    const cargo = updateUserDto.cargo !== undefined
      ? updateUserDto.cargo?.trim() || null
      : existingUser.cargo;
    const activo = updateUserDto.activo !== undefined ? updateUserDto.activo : existingUser.activo;

    // Si el rol es o pasa a ser ENCARGADO y se envían designaciones:
    if (targetRol === RolUsuario.ENCARGADO && updateUserDto.designaciones !== undefined) {
      if (!carnetIdentidad) {
        throw new BadRequestException('El carnet de identidad es obligatorio para un encargado.');
      }
      if (!cargo) {
        throw new BadRequestException('El cargo institucional es obligatorio para un encargado.');
      }
      if (updateUserDto.designaciones.length === 0 && activo) {
        throw new BadRequestException('Un encargado activo debe contar con al menos una unidad institucional y designación asignada.');
      }
    }

    let passwordHash: string | undefined;
    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(updateUserDto.password, salt);
    }

    // Transacción atómica de actualización
    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar datos base del usuario
      await tx.user.update({
        where: { id },
        data: {
          nombres,
          apellidos,
          nombreCompleto,
          email: updateUserDto.email !== undefined ? updateUserDto.email?.trim().toLowerCase() || null : undefined,
          rol: targetRol,
          activo,
          carnetIdentidad,
          cargo,
          passwordHash,
        },
      });

      // 2. Si se proporcionaron designaciones:
      if (updateUserDto.designaciones !== undefined) {
        const newUnitIds = updateUserDto.designaciones.map((d) => d.unidadId);

        // Verificar existencia de unidades
        if (newUnitIds.length > 0) {
          const unitsExist = await tx.unit.findMany({ where: { id: { in: newUnitIds } } });
          if (unitsExist.length !== newUnitIds.length) {
            throw new BadRequestException('Una o más unidades indicadas en las designaciones no existen.');
          }
        }

        // Sincronizar permisos en usuario_unidades
        await tx.userUnit.deleteMany({ where: { userId: id } });
        if (newUnitIds.length > 0) {
          await tx.userUnit.createMany({
            data: newUnitIds.map((unitId) => ({
              userId: id,
              unitId,
            })),
          });
        }

        // Fichas de Responsable existentes para este usuario
        const existingResps = await tx.responsable.findMany({ where: { userId: id } });
        const currentAssignedUnits = new Set(newUnitIds);

        // Preservación histórica: unidades removidas no se eliminan, se desactivan
        for (const er of existingResps) {
          if (!currentAssignedUnits.has(er.unidadId)) {
            await tx.responsable.update({
              where: { id: er.id },
              data: { activo: false },
            });
          }
        }

        // Sincronizar o crear designaciones
        for (const desig of updateUserDto.designaciones) {
          if (desig.responsableId) {
            // Vinculación explícita de ficha de responsable existente
            await tx.responsable.update({
              where: { id: desig.responsableId },
              data: {
                userId: id,
                unidadId: desig.unidadId,
                nombres: nombres || nombreCompleto,
                apellidos: apellidos || '',
                carnetIdentidad: carnetIdentidad || '',
                cargo: desig.cargo?.trim() || cargo || 'Encargado de Caja Chica',
                documentoDesignacion: desig.documentoDesignacion.trim(),
                fechaDesignacion: new Date(desig.fechaDesignacion),
                activo,
              },
            });
          } else {
            // Buscar si ya existía una ficha para esta combinación (userId, unidadId)
            const existingForUnit = existingResps.find((r) => r.unidadId === desig.unidadId);
            if (existingForUnit) {
              await tx.responsable.update({
                where: { id: existingForUnit.id },
                data: {
                  nombres: nombres || nombreCompleto,
                  apellidos: apellidos || '',
                  carnetIdentidad: carnetIdentidad || '',
                  cargo: desig.cargo?.trim() || cargo || existingForUnit.cargo,
                  documentoDesignacion: desig.documentoDesignacion.trim(),
                  fechaDesignacion: new Date(desig.fechaDesignacion),
                  activo,
                },
              });
            } else {
              await tx.responsable.create({
                data: {
                  userId: id,
                  unidadId: desig.unidadId,
                  nombres: nombres || nombreCompleto,
                  apellidos: apellidos || '',
                  carnetIdentidad: carnetIdentidad || '',
                  cargo: desig.cargo?.trim() || cargo || 'Encargado de Caja Chica',
                  documentoDesignacion: desig.documentoDesignacion.trim(),
                  fechaDesignacion: new Date(desig.fechaDesignacion),
                  activo,
                },
              });
            }
          }
        }
      } else {
        // Si no se enviaron designaciones pero el usuario fue desactivado
        if (activo === false) {
          await tx.responsable.updateMany({
            where: { userId: id },
            data: { activo: false },
          });
        }
      }
    });

    await this.auditService.log({
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      accion: 'ACTUALIZAR_USUARIO_UNIFICADO',
      entidad: 'User',
      entidadId: id,
      detalle: {
        nombreCompleto,
        rol: targetRol,
        activo,
        passwordModificado: !!updateUserDto.password,
      },
    });

    return this.findOne(id);
  }

  async assignUnits(id: string, assignUnitsDto: AssignUnitsDto, currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const existingUnits = await this.prisma.unit.findMany({
      where: { id: { in: assignUnitsDto.unitIds } },
    });

    if (existingUnits.length !== assignUnitsDto.unitIds.length) {
      throw new BadRequestException('Una o más unidades indicadas no existen.');
    }

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

