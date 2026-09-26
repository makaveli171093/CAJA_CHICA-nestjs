import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Button,
  Table,
  Badge,
  Loader,
  Box,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUserPlus, IconUserX, IconEdit, IconInfoCircle } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Responsable } from '../../types';

export const ResponsablesPage: React.FC = () => {
  const { activeUnitId } = useAuth();
  const navigate = useNavigate();
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    if (!activeUnitId) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ items: Responsable[] }>(
        `/responsables?unidadId=${activeUnitId}`,
      );
      setResponsables(res.data.items);
    } catch (err: any) {
      notifications.show({
        title: 'Error de carga',
        message: err.response?.data?.message || 'Error al obtener responsables.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeUnitId]);

  const handleDeactivate = async (id: string) => {
    try {
      await api.delete(`/responsables/${id}`);
      notifications.show({
        title: 'Designación Desactivada',
        message: 'La designación de responsable fue marcada como inactiva (se conserva en el historial de aperturas).',
        color: 'teal',
      });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'No se pudo desactivar el responsable.',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between">
          <Box>
            <Title order={3} c="#1e293b">
              Encargados y Responsables de Caja Chica
            </Title>
            <Text size="xs" c="dimmed">
              Consulta de funcionarios formalmente designados para la custodia de fondos en la unidad activa
            </Text>
          </Box>
          <Button
            color="cpsTeal"
            leftSection={<IconUserPlus size={16} />}
            onClick={() => navigate('/usuarios')}
          >
            Registrar / Editar en Usuarios
          </Button>
        </Group>
      </Paper>

      <Alert color="teal" icon={<IconInfoCircle size={18} />}>
        El registro y actualización de encargados está unificado con las cuentas de usuario en{' '}
        <Text
          span
          fw={700}
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => navigate('/usuarios')}
        >
          Usuarios y Unidades
        </Text>
        . Toda designación mantiene una sola identidad personal vinculada a su cuenta de acceso institucional.
      </Alert>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : responsables.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th>Funcionario Designado</Table.Th>
                <Table.Th>Carnet de Identidad</Table.Th>
                <Table.Th>Cargo Institucional</Table.Th>
                <Table.Th>Cuenta de Usuario</Table.Th>
                <Table.Th>Documento de Designación</Table.Th>
                <Table.Th>Fecha Designación</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {responsables.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td style={{ fontWeight: 600 }}>
                    {r.nombres} {r.apellidos}
                  </Table.Td>
                  <Table.Td>{r.carnetIdentidad}</Table.Td>
                  <Table.Td>{r.cargo}</Table.Td>
                  <Table.Td>
                    {r.user ? (
                      <Badge color="blue" variant="light">
                        {r.user.username}
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Sin cuenta vinculada
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color="teal" variant="outline">
                      {r.documentoDesignacion}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{new Date(r.fechaDesignacion).toLocaleDateString('es-BO')}</Table.Td>
                  <Table.Td>
                    <Badge color={r.activo && (!r.user || r.user.activo) ? 'teal' : 'gray'} variant="light">
                      {r.activo && (!r.user || r.user.activo) ? 'ACTIVO' : 'INACTIVO'}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Group gap={6} justify="center">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="cpsTeal"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => navigate('/usuarios')}
                      >
                        Editar
                      </Button>
                      {r.activo && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<IconUserX size={14} />}
                          onClick={() => handleDeactivate(r.id)}
                        >
                          Desactivar
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">No hay responsables ni designaciones registradas para esta unidad.</Text>
            <Button
              mt="md"
              size="xs"
              variant="light"
              color="cpsTeal"
              onClick={() => navigate('/usuarios')}
            >
              Asignar Encargado en Usuarios
            </Button>
          </Box>
        )}
      </Paper>
    </Stack>
  );
};
