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
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconHistory, IconEdit, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PresupuestoPartida, Partida } from '../../types';

export const PresupuestosPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, user } = useAuth();
  const [presupuestos, setPresupuestos] = useState<PresupuestoPartida[]>([]);
  const [partidasDisponibles, setPartidasDisponibles] = useState<Partida[]>([]);
  const [totalPresupuesto, setTotalPresupuesto] = useState('0.00');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [newModalOpened, { open: openNewModal, close: closeNewModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [historyModalOpened, { open: openHistoryModal, close: closeHistoryModal }] = useDisclosure(false);

  const [selectedItem, setSelectedItem] = useState<PresupuestoPartida | null>(null);

  // Form states
  const [newForm, setNewForm] = useState({ partidaId: '', montoAsignado: '5000.00' });
  const [editForm, setEditForm] = useState({ montoAsignado: '', motivo: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    if (!activeUnitId) return;
    setIsLoading(true);
    try {
      const [resPresupuestos, resPartidas] = await Promise.all([
        api.get<{ items: PresupuestoPartida[]; totalPresupuesto: string }>(
          `/presupuestos?unidadId=${activeUnitId}&gestion=${currentGestion}`,
        ),
        api.get<{ items: Partida[] }>('/partidas?activo=true&limit=100'),
      ]);

      setPresupuestos(resPresupuestos.data.items);
      setTotalPresupuesto(resPresupuestos.data.totalPresupuesto);
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
    if (!activeUnitId) return;

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
        message: 'La partida fue presupuestada satisfactoriamente.',
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
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error de actualización',
        message: err.response?.data?.message || 'No se pudo actualizar el presupuesto.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = user?.rol === 'ADMINISTRADOR';

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap">
          <Box>
            <Title order={3} c="#1e293b">
              Presupuesto por Partida Institucional
            </Title>
            <Text size="xs" c="dimmed">
              Gestión Fiscal: {currentGestion} | Disponibilidad presupuestaria asignada a la unidad
            </Text>
          </Box>

          <Group>
            <Badge size="xl" color="teal" variant="light">
              Total Presupuestado: Bs. {totalPresupuesto}
            </Badge>

            {isAdmin && (
              <Button
                color="cpsTeal"
                leftSection={<IconPlus size={16} />}
                onClick={openNewModal}
              >
                Asignar Partida
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Lista de Partidas Presupuestadas */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : presupuestos.length > 0 ? (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th style={{ width: 120 }}>Código</Table.Th>
                <Table.Th>Descripción de la Partida</Table.Th>
                <Table.Th style={{ width: 170, textAlign: 'right' }}>Presupuesto Asignado</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'center' }}>Historial</Table.Th>
                {isAdmin && <Table.Th style={{ width: 100, textAlign: 'center' }}>Acciones</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {presupuestos.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Badge color="dark" variant="outline">
                      {item.partida?.codigo}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{item.partida?.descripcion}</Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                    Bs. {item.montoAsignado}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="blue"
                      leftSection={<IconHistory size={14} />}
                      onClick={() => {
                        setSelectedItem(item);
                        openHistoryModal();
                      }}
                    >
                      {item.historial?.length || 0} cambios
                    </Button>
                  </Table.Td>
                  {isAdmin && (
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Button
                        size="xs"
                        variant="light"
                        color="cpsTeal"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => {
                          setSelectedItem(item);
                          setEditForm({
                            montoAsignado: item.montoAsignado,
                            motivo: '',
                          });
                          openEditModal();
                        }}
                      >
                        Ajustar
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">No se han registrado asignaciones presupuestarias para esta gestión.</Text>
          </Box>
        )}
      </Paper>

      {/* Modal: Asignar Nueva Partida */}
      <Modal opened={newModalOpened} onClose={closeNewModal} title="Asignar Presupuesto a Partida" centered>
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <Select
              label="Partida Presupuestaria"
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
                Guardar Ajuste
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal: Historial de Modificaciones Presupuestarias */}
      <Modal
        opened={historyModalOpened}
        onClose={closeHistoryModal}
        title={`Historial de Cambios: Partida ${selectedItem?.partida?.codigo}`}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            {selectedItem?.partida?.descripcion} | Trazabilidad completa de modificaciones
          </Text>

          {selectedItem?.historial && selectedItem.historial.length > 0 ? (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th>Fecha / Hora</Table.Th>
                  <Table.Th>Monto Anterior</Table.Th>
                  <Table.Th>Monto Nuevo</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                  <Table.Th>Usuario</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedItem.historial.map((h) => (
                  <Table.Tr key={h.id}>
                    <Table.Td style={{ fontSize: '0.8rem' }}>
                      {new Date(h.fecha).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}
                    </Table.Td>
                    <Table.Td>Bs. {h.montoAnterior}</Table.Td>
                    <Table.Td style={{ fontWeight: 600 }}>Bs. {h.montoNuevo}</Table.Td>
                    <Table.Td style={{ fontSize: '0.85rem' }}>{h.motivo}</Table.Td>
                    <Table.Td style={{ fontSize: '0.8rem' }}>{h.actorUsername || 'SISTEMA'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              No se registran cambios históricos para esta partida.
            </Text>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeHistoryModal}>
              Cerrar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
