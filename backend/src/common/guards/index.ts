import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RolUsuario } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, AuthenticatedUser } from '../decorators';

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
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    // El Administrador tiene acceso global para configuración y auditoría
    if (user.rol === RolUsuario.ADMINISTRADOR) {
      return true;
    }

    // Obtener unidadId desde params, query o body
    const unidadId =
      request.params?.unidadId ||
      request.query?.unidadId ||
      request.body?.unidadId;

    if (!unidadId) {
      // Si la ruta no especifica unidadId, se permite solo si el controlador maneja filtrado por unidades asignadas
      return true;
    }

    // Verificar que el usuario tenga la unidad asignada
    const hasAccess = user.unidades && user.unidades.includes(unidadId);
    if (!hasAccess) {
      throw new ForbiddenException(
        'Acceso denegado: No cuenta con autorización para operar en la unidad solicitada.',
      );
    }

    return true;
  }
}
