import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Unit } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  activeUnitId: string | null;
  activeUnit: Unit | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveUnitId: (unitId: string | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeUnitId, setActiveUnitIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const determineActiveUnit = (userData: User, currentUnitId: string | null): string | null => {
    if (userData.unidades && userData.unidades.length > 0) {
      const exists = userData.unidades.some((u) => u.id === currentUnitId);
      if (exists) return currentUnitId;
      return userData.unidades[0].id;
    }
    return null;
  };

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get<User>('/auth/me');
      const userData = response.data;
      setUser(userData);
      setActiveUnitIdState((prev) => determineActiveUnit(userData, prev));
    } catch {
      setUser(null);
      setActiveUnitIdState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
      setActiveUnitIdState(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const response = await api.post<{ user: User }>('/auth/login', {
      username: username.trim(),
      password,
    });
    const userData = response.data.user;
    setUser(userData);
    setActiveUnitIdState(determineActiveUnit(userData, null));
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorar error al cerrar sesión
    } finally {
      setUser(null);
      setActiveUnitIdState(null);
    }
  };

  const setActiveUnitId = (unitId: string | null) => {
    setActiveUnitIdState(unitId);
  };

  const activeUnit =
    user?.unidades?.find((u) => u.id === activeUnitId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUnitId,
        activeUnit,
        isLoading,
        login,
        logout,
        setActiveUnitId,
        refreshUser,
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
