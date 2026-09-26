import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UnitAccessGuard } from './index';
import { RolUsuario } from '@prisma/client';

describe('UnitAccessGuard (Aislamiento entre Unidades)', () => {
  let guard: UnitAccessGuard;

  beforeEach(() => {
    guard = new UnitAccessGuard();
  });

  const createMockContext = (user: any, params: any = {}, query: any = {}, body: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query,
          body,
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    } as unknown as ExecutionContext;
  };

  it('debe permitir acceso al Administrador a cualquier unidad (acceso global)', async () => {
    const adminUser = {
      id: 'admin-1',
      username: 'admin',
      rol: RolUsuario.ADMINISTRADOR,
      unidades: [],
    };

    const ctx = createMockContext(adminUser, { unidadId: 'unidad-foranea' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('debe permitir acceso al Encargado si la unidad solicitada está en sus unidades autorizadas', async () => {
    const encargadoUser = {
      id: 'encargado-1',
      username: 'encargado',
      rol: RolUsuario.ENCARGADO,
      unidades: ['unidad-1', 'unidad-2'],
    };

    const ctx = createMockContext(encargadoUser, { unidadId: 'unidad-1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('debe BLOQUEAR al Encargado cuando intenta acceder a una unidad no asignada (ID foráneo)', async () => {
    const encargadoUser = {
      id: 'encargado-1',
      username: 'encargado',
      rol: RolUsuario.ENCARGADO,
      unidades: ['unidad-1'],
    };

    const ctx = createMockContext(encargadoUser, { unidadId: 'unidad-2' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('debe detectar unidadId enviado en query params y bloquear si no está asignada', async () => {
    const encargadoUser = {
      id: 'encargado-1',
      username: 'encargado',
      rol: RolUsuario.ENCARGADO,
      unidades: ['unidad-1'],
    };

    const ctx = createMockContext(encargadoUser, {}, { unidadId: 'unidad-no-autorizada' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
