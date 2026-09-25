import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Group,
  Text,
  UnstyledButton,
  Badge,
  Menu,
  Select,
  Box,
  Divider,
  Stack,
  Button,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconDashboard,
  IconLockOpen,
  IconBuildingHospital,
  IconUsers,
  IconUserCheck,
  IconReceipt2,
  IconCoin,
  IconHistory,
  IconLogout,
  IconUser,
  IconBuilding,
  IconCalendar,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';

export const AppLayout: React.FC<{
  currentGestion: number;
  onGestionChange: (g: number) => void;
}> = ({ currentGestion, onGestionChange }) => {
  const [opened, { toggle }] = useDisclosure();
  const { user, activeUnitId, setActiveUnitId, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Inicio (Saldos y Límites)', path: '/dashboard', icon: IconDashboard },
    { label: 'Apertura de Caja', path: '/apertura', icon: IconLockOpen },
    { label: 'Presupuesto por Partida', path: '/presupuestos', icon: IconCoin },
    { label: 'Responsables de Caja', path: '/responsables', icon: IconUserCheck },
    { label: 'Unidades Institucionales', path: '/unidades', icon: IconBuildingHospital },
    {
      label: 'Clasificador de Partidas',
      path: '/partidas',
      icon: IconReceipt2,
      adminOnly: true,
    },
    {
      label: 'Usuarios y Unidades',
      path: '/usuarios',
      icon: IconUsers,
      adminOnly: true,
    },
    {
      label: 'Auditoría del Sistema',
      path: '/auditoria',
      icon: IconHistory,
      adminOnly: true,
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || user?.rol === 'ADMINISTRADOR',
  );

  const unitOptions =
    user?.unidades?.map((u) => ({
      value: u.id,
      label: `${u.codigo} - ${u.nombre}`,
    })) || [];

  const currentUnit = user?.unidades?.find((u) => u.id === activeUnitId);

  return (
    <AppShell
      header={{ height: 65 }}
      navbar={{
        width: 270,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Box>
              <Text fw={800} size="md" c="#007B6D" style={{ letterSpacing: '0.5px' }}>
                CAJA PETROLERA DE SALUD
              </Text>
              <Text size="xs" c="dimmed" fw={500}>
                Sistema Institucional de Caja Chica Multiunidad
              </Text>
            </Box>
          </Group>

          {/* Selector de Unidad y Gestión en la barra superior */}
          <Group gap="sm">
            {unitOptions.length > 0 && (
              <Select
                leftSection={<IconBuilding size={16} color="#007B6D" />}
                placeholder="Seleccione Unidad"
                data={unitOptions}
                value={activeUnitId}
                onChange={(val) => setActiveUnitId(val)}
                allowDeselect={false}
                size="xs"
                w={280}
              />
            )}

            <Select
              leftSection={<IconCalendar size={16} color="#007B6D" />}
              data={[
                { value: '2026', label: 'Gestión 2026' },
                { value: '2025', label: 'Gestión 2025' },
              ]}
              value={currentGestion.toString()}
              onChange={(val) => val && onGestionChange(parseInt(val, 10))}
              size="xs"
              w={130}
            />

            <Menu position="bottom-end" shadow="md" width={220}>
              <Menu.Target>
                <UnstyledButton
                  p={6}
                  style={{
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <Group gap="xs">
                    <IconUser size={18} color="#007B6D" />
                    <Box style={{ textAlign: 'left' }}>
                      <Text size="xs" fw={600} lineClamp={1}>
                        {user?.nombreCompleto || user?.username}
                      </Text>
                      <Badge
                        size="xs"
                        variant="light"
                        color={user?.rol === 'ADMINISTRADOR' ? 'blue' : 'teal'}
                      >
                        {user?.rol}
                      </Badge>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Usuario: {user?.username}</Menu.Label>
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={handleLogout}
                >
                  Cerrar Sesión
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0' }}>
        <Stack gap="xs" mt="xs">
          {/* Indicador de unidad activa */}
          <Box p="xs" style={{ backgroundColor: '#e6f8f5', borderRadius: 8 }}>
            <Text size="xs" fw={700} c="#007B6D">
              UNIDAD ACTIVA:
            </Text>
            <Text size="sm" fw={600} c="#005d52" lineClamp={2}>
              {currentUnit ? `${currentUnit.codigo} - ${currentUnit.nombre}` : 'Sin unidad seleccionada'}
            </Text>
            <Text size="xs" c="dimmed">
              Gestión Fiscal: {currentGestion}
            </Text>
          </Box>

          <Divider my="xs" />

          {/* Enlaces de Navegación */}
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <UnstyledButton
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  if (opened) toggle();
                }}
                p="xs"
                style={{
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: isActive ? '#007B6D' : 'transparent',
                  color: isActive ? '#ffffff' : '#334155',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Icon size={18} color={isActive ? '#ffffff' : '#007B6D'} />
                <Text size="sm">{item.label}</Text>
              </UnstyledButton>
            );
          })}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};
