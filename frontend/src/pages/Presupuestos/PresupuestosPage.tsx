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
  Select,
  Textarea,
  Loader,
  Alert,
  Box,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconHistory,
  IconEdit,
  IconAlertCircle,
  IconBuilding,
  IconListCheck,
  IconCoins,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PresupuestoPartida, Partida } from '../../types';
import { PartidasPresupuestosModal } from '../../components/Presupuestos/PartidasPresupuestosModal';

export const PresupuestosPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, activeUnit, accessibleUnits, setActiveUnitId, user } = useAuth();
  const [presupuestos, setPresupuestos] = useState<PresupuestoPartida[]>([]);
  const [partidasDisponibles, setPartidasDisponibles] = useState<Partida[]>([]);
  const [totalPresupuesto, setTotalPresupuesto] = useState('0.00');
  const [totalPresupuestoDeshabilitado, setTotalPresupuestoDeshabilitado] = useState('0.00');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user?.rol === 'ADMINISTRADOR';

  // Modal Integral de Partidas y Presupuestos
  const [configModalOpened, setConfigModalOpened] = useState(false);

  // Modals
  const [newModalOpened, { open: openNewModal, close: closeNewModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [historyModalOpened, { open: openHistoryModal, close: closeHistoryModal }] =
    useDisclosure(false);

  const [selectedItem, setSelectedItem] = useState<PresupuestoPartida | null>(null);

  // Form states
  const [newForm, setNewForm] = useState({ partidaId: '', montoAsignado: '5000.00' });
  const [editForm, setEditForm] = useState({ montoAsignado: '', motivo: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    if (!activeUnitId) {
      setPresupuestos([]);
      setPartidasDisponibles([]);
      setTotalPresupuesto('0.00');
      setTotalPresupuestoDeshabilitado('0.00');
      return;
    }

    // Limpiar inmediatamente datos anteriores al cambiar de unidad
    setPresupuestos([]);
    setPartidasDisponibles([]);
    setIsLoading(true);

    try {
      const [resPresupuestos, resPartidas] = await Promise.all([
        api.get<{
          items: PresupuestoPartida[];
          totalPresupuesto: string;
          totalPresupuestoHabilitado?: string;
          totalPresupuestoDeshabilitado?: string;
        }>(`/presupuestos?unidadId=${activeUnitId}&gestion=${currentGestion}`),
        api.get<{ items: Partida[] }>(
          `/partidas?activo=true&unidadId=${activeUnitId}&limit=100`,
        ),
      ]);

      setPresupuestos(resPresupuestos.data.items);
      setTotalPresupuesto(
        resPresupuestos.data.totalPresupuestoHabilitado || resPresupuestos.data.totalPresupuesto || '0.00',
      );
      setTotalPresupuestoDeshabilitado(resPresupuestos.data.totalPresupuestoDeshabilitado || '0.00');
      setPartidasDisponibles(resPartidas.data.items);
    } catch (err: any) {
      notifications.show({
        title: 'Error de carga',
        message: err.response?.data?.message || 'Error al obtener presupuestos.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeUnitId, currentGestion]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) {
      notifications.show({
        title: 'Unidad requerida',
        message: 'Debe seleccionar una unidad activa antes de asignar presupuesto.',
        color: 'orange',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/presupuestos', {
        unidadId: activeUnitId,
        gestion: currentGestion,
        partidaId: newForm.partidaId,
        montoAsignado: newForm.montoAsignado,
      });

      notifications.show({
        title: 'Presupuesto Asignado',
        message: 'La partida fue presupuestada satisfactoriamente para esta unidad.',
        color: 'teal',
      });
      closeNewModal();
      setNewForm({ partidaId: '', montoAsignado: '5000.00' });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al registrar',
        message: err.response?.data?.message || 'No se pudo asignar el presupuesto.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await api.patch(`/presupuestos/${selectedItem.id}`, editForm);
      notifications.show({
        title: 'Presupuesto Ajustado',
        message: 'El monto presupuestario y el motivo se registraron en el historial de trazabilidad.',
        color: 'teal',
      });
      closeEditModal();
      setSelectedItem(null);
      setEditForm({ montoAsignado: '', motivo: '' });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al ajustar',
        message: err.response?.data?.message || 'No se pudo actualizar el presupuesto.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (item: PresupuestoPartida) => {
    setSelectedItem(item);
    setEditForm({ montoAsignado: item.montoAsignado, motivo: '' });
    openEditModal();
  };

  const openHistory = (item: PresupuestoPartida) => {
    setSelectedItem(item);
    openHistoryModal();
  };

  // Si no hay unidad activa seleccionada
  if (!activeUnitId) {
    const hasUnits = accessibleUnits.length > 0;
    return (
      <Paper p="xl" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size={56} radius="xl" color="teal" variant="light">
            <IconBuilding size={32} />
          </ThemeIcon>
          <Title order={3} c="#1e293b" ta="center">
            Seleccione una Unidad Institucional
          </Title>
          <Text size="sm" c="dimmed" ta="center" maw={520}>
            {hasUnits
              ? `Seleccione la unidad institucional activa para consultar, registrar o ajustar presupuestos por partida en la gestión ${currentGestion}.`
              : 'No existen unidades institucionales registradas o no tiene unidades asignadas para operar.'}
          </Text>
          {hasUnits ? (
            <Select
              placeholder="Seleccione una unidad institucional..."
              data={accessibleUnits.map((u) => ({
                value: u.id,
                label: `[${u.codigo}] ${u.nombre}`,
              }))}
              value={activeUnitId}
              onChange={(val) => setActiveUnitId(val)}
              size="md"
              w={{ base: 280, sm: 380 }}
              allowDeselect={false}
              comboboxProps={{ shadow: 'md' }}
            />
          ) : isAdmin ? (
            <Button
              variant="outline"
              color="cpsTeal"
              onClick={() => navigate('/unidades')}
            >
              Registrar Unidades Institucionales
            </Button>
          ) : null}
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap">
          <Box>
            <Title order={3} c="#1e293b">
              Presupuesto por Partida — [{activeUnit?.codigo}] {activeUnit?.nombre}
            </Title>
            <Text size="xs" c="dimmed">
              Gestión Fiscal: {currentGestion} | Asignación presupuestaria independiente por unidad institucional
            </Text>
          </Box>
          <Group gap="sm">
            {isAdmin && (
              <Button
                color="cpsTeal"
                variant="filled"
                leftSection={<IconCoins size={16} />}
                onClick={() => setConfigModalOpened(true)}
              >
                Partidas y presupuestos
              </Button>
            )}
            {isAdmin && partidasDisponibles.length > 0 && (
              <Button
                color="cpsTeal"
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openNewModal}
              >
                Asignación Rápida
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Alerta si la unidad no tiene partidas habilitadas */}
      {!isLoading && partidasDisponibles.length === 0 && (
        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Sin partidas habilitadas en esta unidad"
          color="orange"
          variant="light"
        >
          {isAdmin ? (
            <>
              <Text size="sm">
                Esta unidad institucional no cuenta con partidas presupuestarias habilitadas en su catálogo.
                Puede habilitar partidas y asignarles su presupuesto directamente sin salir de este módulo:
              </Text>
              <Button
                size="xs"
                color="orange"
                variant="filled"
                leftSection={<IconCoins size={14} />}
                mt="xs"
                onClick={() => setConfigModalOpened(true)}
              >
                Configurar Partidas y Presupuestos &rarr;
              </Button>
            </>
          ) : (
            <Text size="sm">
              Esta unidad institucional no cuenta con partidas presupuestarias habilitadas en su catálogo.
              Por favor solicite la habilitación y asignación presupuestaria al Administrador del Sistema.
            </Text>
          )}
        </Alert>
      )}

      {/* Resumen Total */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap" gap="md">
          <Group gap="xl">
            <Box>
              <Text size="xs" c="dimmed" fw={700}>
                TOTAL PRESUPUESTO HABILITADO (ACTIVO) GESTIÓN {currentGestion}
              </Text>
              <Title order={2} c="#007B6D" mt={4}>
                Bs. {totalPresupuesto}
              </Title>
            </Box>
            {parseFloat(totalPresupuestoDeshabilitado) > 0 && (
              <Box>
                <Text size="xs" c="dimmed" fw={700}>
                  HISTÓRICO EN PARTIDAS DESHABILITADAS
                </Text>
                <Text size="md" fw={700} c="dimmed" mt={4}>
                  Bs. {totalPresupuestoDeshabilitado}
                </Text>
              </Box>
            )}
          </Group>
          <Group gap="xs">
            <Badge size="lg" color="cpsTeal" variant="light">
              {presupuestos.filter((p) => p.habilitado !== false).length} habilitadas
            </Badge>
            {presupuestos.some((p) => p.habilitado === false) && (
              <Badge size="lg" color="gray" variant="outline">
                {presupuestos.filter((p) => p.habilitado === false).length} deshabilitadas (conservadas)
              </Badge>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Tabla de Presupuestos Asignados */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : presupuestos.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th style={{ width: 130 }}>Código Partida</Table.Th>
                <Table.Th>Descripción Oficial</Table.Th>
                <Table.Th style={{ width: 160, textAlign: 'center' }}>Estado Catálogo</Table.Th>
                <Table.Th style={{ width: 180, textAlign: 'right' }}>Monto Asignado (Bs.)</Table.Th>
                <Table.Th style={{ width: 140, textAlign: 'center' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {presupuestos.map((item) => (
                <Table.Tr
                  key={item.id}
                  style={{
                    backgroundColor: item.habilitado === false ? '#f8fafc' : undefined,
                  }}
                >
                  <Table.Td>
                    <Badge color={item.habilitado === false ? 'gray' : 'cpsTeal'} variant="outline">
                      {item.partida?.codigo}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ fontWeight: 500, color: item.habilitado === false ? '#64748b' : undefined }}>
                    {item.partida?.descripcion}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {item.habilitado === false ? (
                      <Badge color="gray" variant="outline" size="sm">
                        Histórico / Inactiva
                      </Badge>
                    ) : (
                      <Badge color="teal" variant="light" size="sm">
                        Habilitada
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: item.habilitado === false ? '#64748b' : '#007B6D',
                    }}
                  >
                    Bs. {item.montoAsignado}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Group gap="xs" justify="center">
                      {isAdmin && item.habilitado !== false && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="blue"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => openEdit(item)}
                        >
                          Ajustar
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<IconHistory size={14} />}
                        onClick={() => openHistory(item)}
                      >
                        Historial
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">
              No existen presupuestos asignados para esta unidad en la gestión {currentGestion}.
            </Text>
          </Box>
        )}
      </Paper>

      {/* Modal: Asignar Nueva Partida */}
      <Modal opened={newModalOpened} onClose={closeNewModal} title="Asignar Presupuesto a Partida" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <Select
              label="Partida Presupuestaria Habilitada"
              placeholder="Seleccione código y descripción"
              data={partidasDisponibles.map((p) => ({
                value: p.id,
                label: `${p.codigo} - ${p.descripcion}`,
              }))}
              value={newForm.partidaId}
              onChange={(val) => setNewForm({ ...newForm, partidaId: val || '' })}
              required
            />

            <TextInput
              label="Monto Presupuestado Asignado (Bs.)"
              placeholder="5000.00"
              value={newForm.montoAsignado}
              onChange={(e) => setNewForm({ ...newForm, montoAsignado: e.currentTarget.value })}
              required
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeNewModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Asignar Partida
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal: Ajustar Monto Presupuestario */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={`Ajuste Presupuestario: Partida ${selectedItem?.partida?.codigo}`}
        centered
      >
        <form onSubmit={handleUpdate}>
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              Partida: {selectedItem?.partida?.descripcion}
            </Text>

            <TextInput
              label="Nuevo Monto Asignado (Bs.)"
              value={editForm.montoAsignado}
              onChange={(e) => setEditForm({ ...editForm, montoAsignado: e.currentTarget.value })}
              required
            />

            <Textarea
              label="Motivo o Justificación del Cambio (Obligatorio)"
              placeholder="Especifique el memorando, resolución o justificativo de la reasignación presupuestaria"
              minRows={3}
              value={editForm.motivo}
              onChange={(e) => setEditForm({ ...editForm, motivo: e.currentTarget.value })}
              required
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeEditModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Guardar Ajuste con Trazabilidad
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal: Historial de Modificaciones Presupuestarias */}
      <Modal
        opened={historyModalOpened}
        onClose={closeHistoryModal}
        title={`Historial de Trazabilidad: Partida ${selectedItem?.partida?.codigo}`}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Text size="xs" c="dimmed">
            Registro cronológico inmutable de ajustes y motivos normativos exigidos por auditoría.
          </Text>

          {selectedItem?.historial && selectedItem.historial.length > 0 ? (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th style={{ width: 140 }}>Fecha y Hora</Table.Th>
                  <Table.Th style={{ width: 120 }}>Anterior</Table.Th>
                  <Table.Th style={{ width: 120 }}>Nuevo</Table.Th>
                  <Table.Th>Motivo del Cambio</Table.Th>
                  <Table.Th style={{ width: 110 }}>Operador</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedItem.historial.map((h) => (
                  <Table.Tr key={h.id}>
                    <Table.Td style={{ fontSize: '11px' }}>
                      {new Date(h.fecha).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}
                    </Table.Td>
                    <Table.Td style={{ fontWeight: 600 }}>Bs. {h.montoAnterior}</Table.Td>
                    <Table.Td style={{ fontWeight: 700, color: '#007B6D' }}>Bs. {h.montoNuevo}</Table.Td>
                    <Table.Td style={{ fontSize: '12px' }}>{h.motivo}</Table.Td>
                    <Table.Td style={{ fontSize: '11px' }}>
                      <Badge size="xs" variant="light" color="dark">
                        {h.actorUsername || 'SISTEMA'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              Sin registros de modificación.
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeHistoryModal}>
              Cerrar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Integral de Partidas y Presupuestos */}
      <PartidasPresupuestosModal
        opened={configModalOpened}
        onClose={() => setConfigModalOpened(false)}
        unit={activeUnit}
        initialGestion={currentGestion}
        onSaved={fetchData}
      />
    </Stack>
  );
};
