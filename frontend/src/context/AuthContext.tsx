import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Unit } from '../types';
import { api } from '../services/api';

export type UnitsStatus = 'loading' | 'success' | 'empty' | 'no_permission' | 'error';

interface AuthContextType {
  user: User | null;
  activeUnitId: string | null;
  activeUnit: Unit | null;
  accessibleUnits: Unit[];
  unitsStatus: UnitsStatus;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveUnitId: (unitId: string | null) => void;
  refreshUser: () => Promise<void>;
  reloadUnits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeUnitId, setActiveUnitIdState] = useState<string | null>(null);
  const [accessibleUnits, setAccessibleUnits] = useState<Unit[]>([]);
  const [unitsStatus, setUnitsStatus] = useState<UnitsStatus>('loading');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const determineActiveUnit = (units: Unit[], currentUnitId: string | null): string | null => {
    if (units.length === 1) {
      return units[0].id;
    }
    if (units.length > 1) {
      const exists = units.some((u) => u.id === currentUnitId);
      if (exists) return currentUnitId;
      return units[0].id;
    }
    return null;
  };

  const resolveUnits = async (userData: User, currentActiveId: string | null) => {
    let units: Unit[] = userData.unidades || [];

    // Si es administrador y no vinieron unidades o se requiere refrescar catálogo institucional
    if (userData.rol === 'ADMINISTRADOR') {
      try {
        const res = await api.get<{ items: Unit[] }>('/unidades?activo=true&limit=100');
        if (res.data?.items) {
          units = res.data.items;
        }
      } catch {
        // En caso de fallo en la llamada de unidades, se conserva lo que haya en userData
      }
    }

    setAccessibleUnits(units);

    if (units.length > 0) {
      setUnitsStatus('success');
      const selected = determineActiveUnit(units, currentActiveId);
      setActiveUnitIdState(selected);
    } else {
      setActiveUnitIdState(null);
      if (userData.rol === 'ADMINISTRADOR') {
        setUnitsStatus('empty');
      } else {
        setUnitsStatus('no_permission');
      }
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get<User>('/auth/me');
      const userData = response.data;
      setUser(userData);
      await resolveUnits(userData, activeUnitId);
    } catch {
      setUser(null);
      setAccessibleUnits([]);
      setActiveUnitIdState(null);
      setUnitsStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [activeUnitId]);

  const reloadUnits = async () => {
    if (!user) return;
    await resolveUnits(user, activeUnitId);
  };

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      setAccessibleUnits([]);
      setActiveUnitIdState(null);
      setUnitsStatus('error');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post<{ user: User }>('/auth/login', {
      username: username.trim(),
      password,
    });
    const userData = response.data.user;
    setUser(userData);
    await resolveUnits(userData, null);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorar error al cerrar sesión
    } finally {
      setUser(null);
      setAccessibleUnits([]);
      setActiveUnitIdState(null);
      setUnitsStatus('empty');
    }
  };

  const setActiveUnitId = (unitId: string | null) => {
    setActiveUnitIdState(unitId);
  };

  const activeUnit =
    accessibleUnits.find((u) => u.id === activeUnitId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUnitId,
        activeUnit,
        accessibleUnits,
        unitsStatus,
        isLoading,
        login,
        logout,
        setActiveUnitId,
        refreshUser,
        reloadUnits,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
