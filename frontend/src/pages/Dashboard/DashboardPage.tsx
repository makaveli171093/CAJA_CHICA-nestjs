import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  SimpleGrid,
  Group,
  Stack,
  Badge,
  Table,
  Box,
  Loader,
  Alert,
  Card,
  ThemeIcon,
  Button,
} from '@mantine/core';
import {
  IconCoin,
  IconReceipt2,
  IconWallet,
  IconAlertCircle,
  IconUser,
  IconFileText,
  IconLockOpen,
  IconBuilding,
  IconShieldLock,
  IconClock,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DashboardData } from '../../types';
import { formatDateToBO, formatDateTimeToBO } from '../../utils/dateUtils';

export const DashboardPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, activeUnit, unitsStatus, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const fetchDashboard = async () => {
    if (!activeUnitId) {
      setData(null);
      return;
    }

    // Limpiar inmediatamente datos anteriores al cambiar de unidad
    setData(null);
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<DashboardData>(
        `/dashboard?unidadId=${activeUnitId}&gestion=${currentGestion}`,
      );
      setData(res.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'No se pudo cargar la información del panel para la unidad seleccionada.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeUnitId, currentGestion]);

  // Pantallas de estado cuando no hay unidad activa seleccionada
  if (!activeUnitId) {
    if (unitsStatus === 'loading') {
      return (
        <Box p="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Stack align="center">
            <Loader color="cpsTeal" size="lg" />
            <Text size="sm" c="dimmed">
              Cargando unidades autorizadas...
            </Text>
          </Stack>
        </Box>
      );
    }

    if (unitsStatus === 'empty') {
      return (
        <Paper p="xl" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={56} radius="xl" color="orange" variant="light">
              <IconBuilding size={32} />
            </ThemeIcon>
            <Title order={3} c="#1e293b" ta="center">
              No existen unidades institucionales registradas
            </Title>
            <Text size="sm" c="dimmed" ta="center" maw={500}>
              Para comenzar a operar el sistema de caja chica, registre la primera unidad institucional o establecimiento de salud.
            </Text>
            {isAdmin && (
              <Button color="cpsTeal" onClick={() => navigate('/unidades')}>
                Ir a Unidades Institucionales
              </Button>
            )}
          </Stack>
        </Paper>
      );
    }

    if (unitsStatus === 'no_permission') {
      return (
        <Paper p="xl" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={56} radius="xl" color="red" variant="light">
              <IconShieldLock size={32} />
            </ThemeIcon>
            <Title order={3} c="#1e293b" ta="center">
              Sin unidades asignadas
            </Title>
            <Text size="sm" c="dimmed" ta="center" maw={500}>
              Su usuario no cuenta con ninguna unidad institucional asignada actualmente. Solicite a la administración central que le asigne su unidad en el módulo de Usuarios y Unidades.
            </Text>
          </Stack>
        </Paper>
      );
    }

    return (
      <Paper p="xl" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Stack align="center" gap="sm" py="xl">
          <ThemeIcon size={56} radius="xl" color="gray" variant="light">
            <IconAlertCircle size={32} />
          </ThemeIcon>
          <Title order={3} c="dimmed">
            Sin unidad seleccionada
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Seleccione una unidad institucional en el selector superior para visualizar saldos y estados de caja.
          </Text>
        </Stack>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Box p="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Stack align="center">
          <Loader color="cpsTeal" size="lg" />
          <Text size="sm" c="dimmed">
            Consultando saldos y presupuestos de la unidad...
          </Text>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error al cargar datos" color="red">
        {error}
      </Alert>
    );
  }

  const caja = data?.caja;

  return (
    <Stack gap="lg">
      {/* Encabezado con información de la unidad */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap">
          <Box>
            <Group gap="xs">
              <Badge color="cpsTeal" size="lg" variant="filled">
                {data?.unidad.codigo || activeUnit?.codigo}
              </Badge>
              <Title order={3} fw={700} c="#1e293b">
                {data?.unidad.nombre || activeUnit?.nombre}
              </Title>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Dependencia: {data?.unidad.dependencia || activeUnit?.dependencia || 'Nivel Central'} | Gestión Fiscal: {currentGestion}
            </Text>
          </Box>

          <Group>
            {caja ? (
              <Badge
                size="lg"
                color={caja.estado === 'ABIERTA' ? 'teal' : caja.estado === 'BORRADOR' ? 'yellow' : 'gray'}
                variant="light"
              >
                ESTADO: {caja.estado}
              </Badge>
            ) : (
              <Badge size="lg" color="orange" variant="light">
                CAJA NO APERTURADA EN ESTA GESTIÓN
              </Badge>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Tarjetas de Saldos Reales y Compromisos */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {/* 1. Fondo Autorizado (efectivo físico de caja) */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              FONDO AUTORIZADO (EFECTIVO)
            </Text>
            <ThemeIcon color="teal" variant="light" size={32} radius="md">
              <IconCoin size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#007B6D">
            Bs. {data?.montoAutorizado || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Efectivo físico asignado a la caja
          </Text>
          {data?.resumen?.totalPresupuestoAsignado && parseFloat(data.resumen.totalPresupuestoAsignado) > 0 && (
            <Text size="xs" c="#007B6D" mt={4} fw={600}>
              Presupuesto partidas: Bs. {data.resumen.totalPresupuestoAsignado}
            </Text>
          )}
        </Card>

        {/* 2. Efectivo Disponible */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              EFECTIVO DISPONIBLE
            </Text>
            <ThemeIcon color="blue" variant="light" size={32} radius="md">
              <IconWallet size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#1e40af">
            Bs. {data?.efectivoDisponible || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Saldo en caja (descontando anticipos)
          </Text>
        </Card>

        {/* 3. Límite por Operación (10% del presupuesto asignado POA) */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              LÍMITE POR OPERACIÓN
            </Text>
            <ThemeIcon color="cyan" variant="light" size={32} radius="md">
              <IconReceipt2 size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#0e7490">
            Bs. {data?.limitePorComprobante || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            10 % del presupuesto asignado POA (Reglamento CPS)
          </Text>
        </Card>

        {/* 4. Anticipos Pendientes de Rendición */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              ANTICIPOS PENDIENTES
            </Text>
            <ThemeIcon color="orange" variant="light" size={32} radius="md">
              <IconClock size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#d97706">
            Bs. {data?.totalAnticiposPendientes || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {data?.cantidadAnticiposPendientes || 0} vale(s) 001 pendientes de rendición
          </Text>
        </Card>

        {/* 5. Presupuesto Comprometido */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              PRESUPUESTO COMPROMETIDO
            </Text>
            <ThemeIcon color="red" variant="light" size={32} radius="md">
              <IconFileText size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#dc2626">
            Bs. {data?.totalComprometido || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Comprometido por anticipos entregados
          </Text>
        </Card>

        {/* 6. Gasto Ejecutado */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              GASTO EJECUTADO
            </Text>
            <ThemeIcon color="pink" variant="light" size={32} radius="md">
              <IconReceipt2 size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#e11d48">
            Bs. {data?.totalEjecutado || data?.resumen?.totalEjecutado || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Consolidado por rendiciones aprobadas
          </Text>
        </Card>

        {/* 7. Presupuesto Disponible */}
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700}>
              PRESUPUESTO DISPONIBLE
            </Text>
            <ThemeIcon color="grape" variant="light" size={32} radius="md">
              <IconCoin size={18} />
            </ThemeIcon>
          </Group>
          <Text fw={700} size="xl" mt="xs" c="#7e22ce">
            Bs. {data?.totalDisponiblePresupuesto || data?.resumen.totalPresupuestoAsignado || '0.00'}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            De un total asignado de Bs. {data?.resumen.totalPresupuestoAsignado || '0.00'}
          </Text>
        </Card>
      </SimpleGrid>

      {/* Datos del Responsable o Acción de Apertura */}
      {caja ? (
        <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
          <Title order={4} mb="sm" c="#1e293b">
            Datos de Apertura y Responsable Designado
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            <Box>
              <Text size="xs" c="dimmed" fw={600}>
                RESPONSABLE DE CAJA CHICA:
              </Text>
              <Group gap="xs" mt={2}>
                <IconUser size={16} color="#007B6D" />
                <Text size="sm" fw={600}>
                  {data.responsable?.nombres} {data.responsable?.apellidos}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                CI: {data.responsable?.carnetIdentidad} | Cargo: {data.responsable?.cargo}
              </Text>
            </Box>

            <Box>
              <Text size="xs" c="dimmed" fw={600}>
                DOCUMENTO DE AUTORIZACIÓN:
              </Text>
              <Text size="sm" fw={500} mt={2}>
                {caja.docAutorizacion}
              </Text>
              <Text size="xs" c="dimmed">
                Fecha apertura: {formatDateToBO(caja.fechaApertura)}
              </Text>
            </Box>

            <Box>
              <Text size="xs" c="dimmed" fw={600}>
                COMPROBANTE DE INGRESO:
              </Text>
              <Text size="sm" fw={500} mt={2}>
                {caja.compIngreso}
              </Text>
              <Text size="xs" c="dimmed">
                {caja.fechaConfirmacion
                  ? `Confirmada: ${formatDateTimeToBO(caja.fechaConfirmacion)}`
                  : 'Pendiente de confirmación'}
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>
      ) : (
        <Paper p="lg" radius="md" withBorder style={{ backgroundColor: '#fffbeb', borderColor: '#fef3c7' }}>
          <Group justify="space-between" wrap="wrap">
            <Box>
              <Text fw={700} c="#92400e">
                La caja chica para esta unidad y gestión no ha sido aperturada aún.
              </Text>
              <Text size="xs" c="#b45309" mt={2}>
                Registre la apertura inicial indicando el responsable, importe autorizado y comprobante de ingreso de efectivo.
              </Text>
            </Box>
            <Button
              color="cpsTeal"
              leftSection={<IconLockOpen size={16} />}
              onClick={() => navigate('/apertura')}
            >
              Aperturar Caja Chica
            </Button>
          </Group>
        </Paper>
      )}

      {/* Tabla de Presupuesto por Partida */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={4} c="#1e293b">
              Presupuesto Asignado por Partida
            </Title>
            <Text size="xs" c="dimmed">
              Disponibilidad presupuestaria autorizada para la gestión fiscal {currentGestion}
            </Text>
          </Box>
          <Button
            size="xs"
            variant="light"
            color="cpsTeal"
            onClick={() => navigate('/presupuestos')}
          >
            Gestionar Partidas Presupuestarias
          </Button>
        </Group>

        {data?.presupuestoPorPartida && data.presupuestoPorPartida.length > 0 ? (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th style={{ width: 140 }}>Código Partida</Table.Th>
                <Table.Th>Descripción Oficial del Gasto</Table.Th>
                <Table.Th style={{ width: 140, textAlign: 'right' }}>Presupuesto Asignado</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Comprometido</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Ejecutado</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Disponible</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.presupuestoPorPartida.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Badge color="dark" variant="outline">
                      {item.partidaCodigo}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{item.partidaDescripcion}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                    Bs. {item.montoAsignado}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                    Bs. {item.comprometido || '0.00'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600, color: '#e11d48' }}>
                    Bs. {item.ejecutado || '0.00'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 700, color: '#007B6D' }}>
                    Bs. {item.disponible || item.montoAsignado}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="lg" ta="center" style={{ backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <Text size="sm" c="dimmed">
              No existen asignaciones presupuestarias registradas para esta unidad en la gestión {currentGestion}.
            </Text>
            <Button
              size="xs"
              variant="subtle"
              color="cpsTeal"
              mt="xs"
              onClick={() => navigate('/presupuestos')}
            >
              Asignar Partidas Presupuestarias
            </Button>
          </Box>
        )}
      </Paper>
    </Stack>
  );
};
