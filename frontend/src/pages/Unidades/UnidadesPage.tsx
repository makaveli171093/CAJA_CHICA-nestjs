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
  Switch,
  Alert,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconTrash,
  IconListCheck,
  IconAlertCircle,
  IconCheck,
  IconCoins,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Unit, PartidaHabilitada, PendientePresupuesto } from '../../types';
import { PartidasPresupuestosModal } from '../../components/Presupuestos/PartidasPresupuestosModal';

export const UnidadesPage: React.FC = () => {
  const { user, reloadUnits } = useAuth();
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal Crear Unidad
  const [opened, { open, close }] = useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Partidas y Presupuestos (Completo)
  const [configModalOpened, { open: openConfigModal, close: closeConfigModal }] =
    useDisclosure(false);
  const [configUnit, setConfigUnit] = useState<Unit | null>(null);

  // Modal Partidas Habilitadas
  const [partidasModalOpened, { open: openPartidasModal, close: closePartidasModal }] =
    useDisclosure(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [partidasList, setPartidasList] = useState<PartidaHabilitada[]>([]);
  const [pendientesList, setPendientesList] = useState<PendientePresupuesto[]>([]);
  const [isLoadingPartidas, setIsLoadingPartidas] = useState(false);
  const [partidaSearch, setPartidaSearch] = useState('');
  const [togglingPartidaId, setTogglingPartidaId] = useState<string | null>(null);

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
      const res = await api.post('/unidades', form);
      notifications.show({
        title: 'Unidad Creada',
        message: 'La unidad institucional fue registrada satisfactoriamente.',
        color: 'teal',
      });
      close();
      setForm({ codigo: '', nombre: '', dependencia: '' });
      fetchData();
      await reloadUnits(res.data?.id);
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
      await reloadUnits();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'No se pudo desactivar la unidad.',
        color: 'red',
      });
    }
  };

  // Abrir configuración integral de partidas y presupuestos
  const handleOpenPartidasPresupuestos = (unit: Unit) => {
    setConfigUnit(unit);
    openConfigModal();
  };

  // Abrir gestión rápida de partidas habilitadas
  const handleOpenPartidas = async (unit: Unit) => {
    setSelectedUnit(unit);
    setPartidaSearch('');
    openPartidasModal();
    loadPartidasHabilitadas(unit.id);
  };

  const loadPartidasHabilitadas = async (unitId: string) => {
    setIsLoadingPartidas(true);
    try {
      const [resHabilitadas, resPendientes] = await Promise.all([
        api.get<PartidaHabilitada[]>(`/unidades/${unitId}/partidas-habilitadas`),
        api.get<PendientePresupuesto[]>(`/unidades/${unitId}/partidas-habilitadas/pendientes-presupuesto`),
      ]);
      setPartidasList(resHabilitadas.data);
      setPendientesList(resPendientes.data);
    } catch (err: any) {
      notifications.show({
        title: 'Error al cargar partidas',
        message: err.response?.data?.message || 'No se pudieron cargar las partidas habilitadas.',
        color: 'red',
      });
    } finally {
      setIsLoadingPartidas(false);
    }
  };

  const handleTogglePartida = async (partidaId: string, currentStatus: boolean) => {
    if (!selectedUnit) return;
    setTogglingPartidaId(partidaId);
    try {
      await api.post(`/unidades/${selectedUnit.id}/partidas-habilitadas`, {
        partidaId,
        activo: !currentStatus,
      });

      notifications.show({
        title: !currentStatus ? 'Partida Habilitada' : 'Partida Deshabilitada',
        message: `La partida fue ${!currentStatus ? 'habilitada' : 'deshabilitada'} para ${selectedUnit.codigo}.`,
        color: !currentStatus ? 'teal' : 'orange',
      });

      // Actualizar estado local
      setPartidasList((prev) =>
        prev.map((p) => (p.partidaId === partidaId ? { ...p, habilitado: !currentStatus } : p)),
      );

      // Si se habilitó, remover de pendientes
      if (!currentStatus) {
        setPendientesList((prev) => prev.filter((p) => p.partidaId !== partidaId));
      }
    } catch (err: any) {
      notifications.show({
        title: 'Error al cambiar asignación',
        message: err.response?.data?.message || 'No se pudo actualizar la partida.',
        color: 'red',
      });
    } finally {
      setTogglingPartidaId(null);
    }
  };

  const filteredPartidas = partidasList.filter(
    (p) =>
      p.codigo.toLowerCase().includes(partidaSearch.toLowerCase()) ||
      p.descripcion.toLowerCase().includes(partidaSearch.toLowerCase()),
  );

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
                  <Table.Th style={{ width: 220, textAlign: 'center' }}>Acciones</Table.Th>
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
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap="xs" justify="center">
                        <Button
                          size="xs"
                          variant="filled"
                          color="cpsTeal"
                          leftSection={<IconCoins size={14} />}
                          onClick={() => handleOpenPartidasPresupuestos(u)}
                        >
                          Partidas y presupuestos
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="gray"
                          leftSection={<IconListCheck size={14} />}
                          onClick={() => handleOpenPartidas(u)}
                        >
                          Habilitación rápida
                        </Button>
                        {isAdmin && u.activo && (
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
                      </Group>
                    </Table.Td>
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

      {/* Modal Partidas Habilitadas por Unidad */}
      <Modal
        opened={partidasModalOpened}
        onClose={closePartidasModal}
        title={
          <Box>
            <Title order={4} c="#1e293b">
              Partidas Habilitadas — [{selectedUnit?.codigo}] {selectedUnit?.nombre}
            </Title>
            <Text size="xs" c="dimmed">
              Asignación manual de partidas disponibles para esta unidad institucional
            </Text>
          </Box>
        }
        size="lg"
        centered
      >
        <Stack gap="md">
          {/* Alerta de presupuestos previos pendientes de habilitar */}
          {pendientesList.length > 0 && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Presupuestos registrados pendientes de habilitar"
              color="orange"
              variant="light"
            >
              <Text size="xs" mb="xs">
                Se detectaron partidas con presupuesto asignado que actualmente no se encuentran
                habilitadas para esta unidad. Active la casilla para regularizar su habilitación:
              </Text>
              <Stack gap="xs">
                {pendientesList.map((pen) => (
                  <Group key={pen.partidaId} justify="space-between">
                    <Text size="xs" fw={600}>
                      [{pen.codigo}] {pen.descripcion} (Gestión {pen.gestion}: Bs. {pen.montoRegistrado})
                    </Text>
                    {isAdmin && (
                      <Button
                        size="compact-xs"
                        color="cpsTeal"
                        leftSection={<IconCheck size={12} />}
                        onClick={() => handleTogglePartida(pen.partidaId, false)}
                        loading={togglingPartidaId === pen.partidaId}
                      >
                        Habilitar
                      </Button>
                    )}
                  </Group>
                ))}
              </Stack>
            </Alert>
          )}

          <Group justify="space-between">
            <TextInput
              placeholder="Filtrar por código o descripción..."
              leftSection={<IconSearch size={14} />}
              value={partidaSearch}
              onChange={(e) => setPartidaSearch(e.currentTarget.value)}
              size="xs"
              style={{ flex: 1 }}
            />
            <Badge color="cpsTeal" variant="light">
              {partidasList.filter((p) => p.habilitado).length} de {partidasList.length} habilitadas
            </Badge>
          </Group>

          <Divider />

          {isLoadingPartidas ? (
            <Box p="xl" ta="center">
              <Loader color="cpsTeal" size="sm" />
            </Box>
          ) : filteredPartidas.length > 0 ? (
            <Box style={{ maxHeight: 400, overflowY: 'auto' }}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
                    <Table.Th style={{ width: 110 }}>Partida</Table.Th>
                    <Table.Th>Descripción</Table.Th>
                    <Table.Th style={{ width: 120, textAlign: 'center' }}>Estado</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredPartidas.map((item) => (
                    <Table.Tr key={item.partidaId}>
                      <Table.Td>
                        <Badge color="cpsTeal" variant="outline" size="sm">
                          {item.codigo}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.descripcion}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {isAdmin ? (
                          <Switch
                            checked={item.habilitado}
                            color="cpsTeal"
                            disabled={togglingPartidaId === item.partidaId}
                            onChange={() => handleTogglePartida(item.partidaId, item.habilitado)}
                            label={item.habilitado ? 'Habilitada' : 'Inactiva'}
                            size="sm"
                          />
                        ) : (
                          <Badge color={item.habilitado ? 'teal' : 'gray'} variant="light">
                            {item.habilitado ? 'Habilitada' : 'No disponible'}
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No se encontraron partidas con el criterio especificado.
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closePartidasModal}>
              Cerrar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Integral de Partidas y Presupuestos por Unidad */}
      <PartidasPresupuestosModal
        opened={configModalOpened}
        onClose={closeConfigModal}
        unit={configUnit}
        onSaved={() => {
          fetchData();
          reloadUnits();
        }}
      />
    </Stack>
  );
};
