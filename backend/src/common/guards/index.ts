import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RolUsuario } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, AuthenticatedUser } from '../decorators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    const hasRole = requiredRoles.includes(user.rol);
    if (!hasRole) {
      throw new ForbiddenException('No tiene permisos para realizar esta acción.');
    }
    return true;
  }
}

@Injectable()
export class UnitAccessGuard implements CanActivate {
  constructor(private prisma?: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    // El Administrador tiene acceso global para configuración y auditoría
    if (user.rol === RolUsuario.ADMINISTRADOR) {
      return true;
    }

    // 1. Obtener unidadId explícito si fue enviado en params, query o body
    const unidadId =
      request.params?.unidadId ||
      request.query?.unidadId ||
      request.body?.unidadId;

    if (unidadId) {
      const hasAccess = user.unidades && user.unidades.includes(unidadId);
      if (!hasAccess) {
        throw new ForbiddenException(
          'Acceso denegado: No cuenta con autorización para operar en la unidad indicada.',
        );
      }
    }

    // 2. Si se envía un :id de recurso directo, resolver a la unidad real en BD
    const resourceId = request.params?.id;
    if (resourceId && this.prisma) {
      const path = (request.baseUrl || request.url || '').toLowerCase();

      if (path.includes('unidades')) {
        const hasAccess = user.unidades && user.unidades.includes(resourceId);
        if (!hasAccess) {
          throw new ForbiddenException(
            'Acceso denegado: No tiene autorización para consultar o modificar esta unidad.',
          );
        }
      } else if (path.includes('responsables')) {
        const responsable = await this.prisma.responsable.findUnique({
          where: { id: resourceId },
          select: { unidadId: true },
        });
        if (responsable) {
          const hasAccess = user.unidades && user.unidades.includes(responsable.unidadId);
          if (!hasAccess) {
            throw new ForbiddenException(
              'Acceso denegado: El responsable pertenece a una unidad no autorizada para su usuario.',
            );
          }
        }
      } else if (path.includes('presupuestos')) {
        const presupuesto = await this.prisma.presupuestoPartida.findUnique({
          where: { id: resourceId },
          select: { unidadId: true },
        });
        if (presupuesto) {
          const hasAccess = user.unidades && user.unidades.includes(presupuesto.unidadId);
          if (!hasAccess) {
            throw new ForbiddenException(
              'Acceso denegado: La asignación presupuestaria pertenece a una unidad no autorizada.',
            );
          }
        }
      } else if (path.includes('apertura')) {
        const apertura = await this.prisma.cajaApertura.findUnique({
          where: { id: resourceId },
          select: { unidadId: true },
        });
        if (apertura) {
          const hasAccess = user.unidades && user.unidades.includes(apertura.unidadId);
          if (!hasAccess) {
            throw new ForbiddenException(
              'Acceso denegado: La apertura de caja pertenece a una unidad no autorizada.',
            );
          }
        }
      }
    }

    return true;
  }
}
