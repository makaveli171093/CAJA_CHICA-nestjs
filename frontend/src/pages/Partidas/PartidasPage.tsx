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
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Partida } from '../../types';

export const PartidasPage: React.FC = () => {
  const { user } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [opened, { open, close }] = useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    codigo: '',
    descripcion: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ items: Partida[]; total: number }>(
        `/partidas?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
      );
      setPartidas(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      notifications.show({
        title: 'Error de carga',
        message: err.response?.data?.message || 'Error al obtener partidas.',
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
      await api.post('/partidas', form);
      notifications.show({
        title: 'Partida Registrada',
        message: 'La partida fue agregada al clasificador presupuestario.',
        color: 'teal',
      });
      close();
      setForm({ codigo: '', descripcion: '' });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al registrar',
        message: err.response?.data?.message || 'No se pudo crear la partida.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.delete(`/partidas/${id}`);
      notifications.show({
        title: 'Partida Desactivada',
        message: 'La partida presupuestaria fue marcada como inactiva.',
        color: 'teal',
      });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'No se pudo desactivar la partida.',
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
              Clasificador de Partidas Presupuestarias
            </Title>
            <Text size="xs" c="dimmed">
              Catálogo oficial de partidas de gasto para imputaciones de caja chica
            </Text>
          </Box>
          {isAdmin && (
            <Button color="cpsTeal" leftSection={<IconPlus size={16} />} onClick={open}>
              Nueva Partida
            </Button>
          )}
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group mb="md">
          <TextInput
            placeholder="Buscar por código (ej. 31110) o descripción..."
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
        ) : partidas.length > 0 ? (
          <>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th style={{ width: 140 }}>Código (Texto)</Table.Th>
                  <Table.Th>Descripción Oficial del Objeto de Gasto</Table.Th>
                  <Table.Th style={{ width: 100 }}>Estado</Table.Th>
                  {isAdmin && <Table.Th style={{ width: 100, textAlign: 'center' }}>Acciones</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {partidas.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Badge color="dark" variant="light">
                        {p.codigo}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ fontWeight: 500 }}>{p.descripcion}</Table.Td>
                    <Table.Td>
                      <Badge color={p.activo ? 'teal' : 'gray'} variant="outline">
                        {p.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </Table.Td>
                    {isAdmin && (
                      <Table.Td style={{ textAlign: 'center' }}>
                        {p.activo && (
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => handleDeactivate(p.id)}
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
            <Text c="dimmed">No se encontraron partidas presupuestarias.</Text>
          </Box>
        )}
      </Paper>

      {/* Modal Nueva Partida */}
      <Modal opened={opened} onClose={close} title="Registrar Partida Presupuestaria" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <TextInput
              label="Código Presupuestario (como texto)"
              placeholder="ej. 31110, 39500, 22110"
              required
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value.trim() })}
            />

            <TextInput
              label="Descripción Oficial del Gasto"
              placeholder="ej. Gastos de Escritorio y Papelería"
              required
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={close} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Guardar Partida
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
