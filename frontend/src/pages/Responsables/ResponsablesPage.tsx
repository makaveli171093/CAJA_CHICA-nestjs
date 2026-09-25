import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Button,
  Table,
  Badge,
  Modal,
  TextInput,
  Loader,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconUserCheck, IconUserX } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Responsable } from '../../types';

export const ResponsablesPage: React.FC = () => {
  const { activeUnitId } = useAuth();
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    carnetIdentidad: '',
    cargo: 'Encargado de Caja Chica',
    documentoDesignacion: '',
    fechaDesignacion: new Date().toISOString().split('T')[0],
  });

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) return;

    setIsSubmitting(true);
    try {
      await api.post('/responsables', {
        ...form,
        unidadId: activeUnitId,
      });

      notifications.show({
        title: 'Responsable Registrado',
        message: 'El funcionario fue registrado exitosamente.',
        color: 'teal',
      });
      close();
      setForm({
        nombres: '',
        apellidos: '',
        carnetIdentidad: '',
        cargo: 'Encargado de Caja Chica',
        documentoDesignacion: '',
        fechaDesignacion: new Date().toISOString().split('T')[0],
      });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al registrar',
        message: err.response?.data?.message || 'No se pudo registrar el responsable.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.delete(`/responsables/${id}`);
      notifications.show({
        title: 'Responsable Desactivado',
        message: 'El responsable fue marcado como inactivo (se conserva en histórico).',
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
              Responsables de Caja Chica
            </Title>
            <Text size="xs" c="dimmed">
              Funcionarios designados formalmente para la custodia y administración de fondos
            </Text>
          </Box>
          <Button
            color="cpsTeal"
            leftSection={<IconPlus size={16} />}
            onClick={open}
            disabled={!activeUnitId}
          >
            Nuevo Responsable
          </Button>
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : responsables.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th>Nombres y Apellidos</Table.Th>
                <Table.Th>Carnet de Identidad</Table.Th>
                <Table.Th>Cargo Institucional</Table.Th>
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
                  <Table.Td>{r.documentoDesignacion}</Table.Td>
                  <Table.Td>{new Date(r.fechaDesignacion).toLocaleDateString('es-BO')}</Table.Td>
                  <Table.Td>
                    <Badge color={r.activo ? 'teal' : 'gray'} variant="light">
                      {r.activo ? 'ACTIVO' : 'INACTIVO'}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
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
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">No hay responsables registrados para esta unidad.</Text>
          </Box>
        )}
      </Paper>

      {/* Modal Nuevo Responsable */}
      <Modal opened={opened} onClose={close} title="Registrar Responsable de Caja" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <TextInput
              label="Nombres"
              placeholder="ej. Carlos Alberto"
              required
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.currentTarget.value })}
            />

            <TextInput
              label="Apellidos"
              placeholder="ej. Mamani Flores"
              required
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.currentTarget.value })}
            />

            <TextInput
              label="Carnet de Identidad (Texto)"
              placeholder="ej. 4892145 LP"
              required
              value={form.carnetIdentidad}
              onChange={(e) => setForm({ ...form, carnetIdentidad: e.currentTarget.value })}
            />

            <TextInput
              label="Cargo Institucional"
              placeholder="ej. Encargado de Caja Chica"
              required
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.currentTarget.value })}
            />

            <TextInput
              label="Referencia del Documento de Designación"
              placeholder="ej. Memorando RRHH N° 045/2026"
              required
              value={form.documentoDesignacion}
              onChange={(e) => setForm({ ...form, documentoDesignacion: e.currentTarget.value })}
            />

            <TextInput
              label="Fecha de Designación"
              type="date"
              required
              value={form.fechaDesignacion}
              onChange={(e) => setForm({ ...form, fechaDesignacion: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={close} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Guardar Responsable
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
