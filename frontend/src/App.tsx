import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Loader, Stack, Text } from '@mantine/core';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/Layout/AppLayout';
import { LoginPage } from './pages/Login/LoginPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { AperturaPage } from './pages/Apertura/AperturaPage';
import { PresupuestosPage } from './pages/Presupuestos/PresupuestosPage';
import { ResponsablesPage } from './pages/Responsables/ResponsablesPage';
import { UnidadesPage } from './pages/Unidades/UnidadesPage';
import { PartidasPage } from './pages/Partidas/PartidasPage';
import { UsuariosPage } from './pages/Usuarios/UsuariosPage';
import { AuditoriaPage } from './pages/Auditoria/AuditoriaPage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <Stack align="center" gap="xs">
          <Loader color="cpsTeal" size="lg" />
          <Text size="sm" c="dimmed">
            Verificando sesión institucional CPS...
          </Text>
        </Stack>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.rol !== 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  const [currentGestion, setCurrentGestion] = useState<number>(2026);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout currentGestion={currentGestion} onGestionChange={setCurrentGestion} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage currentGestion={currentGestion} />} />
        <Route path="apertura" element={<AperturaPage currentGestion={currentGestion} />} />
        <Route
          path="responsables"
          element={
            <AdminRoute>
              <ResponsablesPage />
            </AdminRoute>
          }
        />
        <Route
          path="unidades"
          element={
            <AdminRoute>
              <UnidadesPage />
            </AdminRoute>
          }
        />

        {/* Rutas exclusivas para el Administrador */}
        <Route
          path="partidas"
          element={
            <AdminRoute>
              <PartidasPage />
            </AdminRoute>
          }
        />
        <Route
          path="usuarios"
          element={
            <AdminRoute>
              <UsuariosPage />
            </AdminRoute>
          }
        />
        <Route
          path="auditoria"
          element={
            <AdminRoute>
              <AuditoriaPage />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
