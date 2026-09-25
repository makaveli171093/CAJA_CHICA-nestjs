import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedUser {
  id: string;
  username: string;
  nombreCompleto: string;
  rol: RolUsuario;
  unidades: string[]; // IDs de unidades autorizadas
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
