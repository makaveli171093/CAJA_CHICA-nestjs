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
  Pagination,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSearch, IconBuilding, IconTrash } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Unit } from '../../types';

export const UnidadesPage: React.FC = () => {
  const { user } = useAuth();
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [opened, { open, close }] = useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    dependencia: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ items: Unit[]; total: number }>(
        `/unidades?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
      );
      setUnidades(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      notifications.show({
        title: 'Error de carga',
        message: err.response?.data?.message || 'Error al obtener unidades.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/unidades', form);
      notifications.show({
        title: 'Unidad Creada',
        message: 'La unidad institucional fue registrada satisfactoriamente.',
        color: 'teal',
      });
      close();
      setForm({ codigo: '', nombre: '', dependencia: '' });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al crear',
        message: err.response?.data?.message || 'No se pudo crear la unidad.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.delete(`/unidades/${id}`);
      notifications.show({
        title: 'Unidad Desactivada',
        message: 'La unidad fue marcada como inactiva para preservar el histórico.',
        color: 'teal',
      });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'No se pudo desactivar la unidad.',
        color: 'red',
      });
    }
  };

  const isAdmin = user?.rol === 'ADMINISTRADOR';

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between">
          <Box>
            <Title order={3} c="#1e293b">
              Unidades Institucionales
            </Title>
            <Text size="xs" c="dimmed">
              Catálogo de establecimientos y dependencias de la Caja Petrolera de Salud
            </Text>
          </Box>
          {isAdmin && (
            <Button color="cpsTeal" leftSection={<IconPlus size={16} />} onClick={open}>
              Nueva Unidad
            </Button>
          )}
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group mb="md">
          <TextInput
            placeholder="Buscar por código, nombre o dependencia..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setPage(1);
            }}
            style={{ width: 350 }}
          />
        </Group>

        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : unidades.length > 0 ? (
          <>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th style={{ width: 140 }}>Código Único</Table.Th>
                  <Table.Th>Nombre de la Unidad</Table.Th>
                  <Table.Th>Administración de Dependencia</Table.Th>
                  <Table.Th style={{ width: 100 }}>Estado</Table.Th>
                  {isAdmin && <Table.Th style={{ width: 100, textAlign: 'center' }}>Acciones</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {unidades.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Badge color="cpsTeal" variant="light">
                        {u.codigo}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ fontWeight: 600 }}>{u.nombre}</Table.Td>
                    <Table.Td>{u.dependencia || 'Nivel Central'}</Table.Td>
                    <Table.Td>
                      <Badge color={u.activo ? 'teal' : 'gray'} variant="outline">
                        {u.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td style={{ textAlign: 'center' }}>
                        {u.activo && (
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => handleDeactivate(u.id)}
                          >
                            Desactivar
                          </Button>
                        )}
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="center" mt="md">
              <Pagination total={Math.ceil(total / 10) || 1} value={page} onChange={setPage} color="cpsTeal" />
            </Group>
          </>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">No se encontraron unidades institucionales.</Text>
          </Box>
        )}
      </Paper>

      {/* Modal Nueva Unidad */}
      <Modal opened={opened} onClose={close} title="Registrar Unidad Institucional" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <TextInput
              label="Código Único Institucional"
              placeholder="ej. HPO, LP-ADM, CBBA-ADM"
              required
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value.toUpperCase() })}
            />

            <TextInput
              label="Nombre de la Unidad"
              placeholder="ej. Hospital Petrolero Obrajes"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.currentTarget.value })}
            />

            <TextInput
              label="Administración de Dependencia"
              placeholder="ej. Administración Regional La Paz"
              value={form.dependencia}
              onChange={(e) => setForm({ ...form, dependencia: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={close} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Guardar Unidad
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
