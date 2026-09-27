import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Table,
  Badge,
  TextInput,
  Select,
  Switch,
  Alert,
  Loader,
  Box,
  Divider,
  Paper,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconCoins,
  IconAlertCircle,
  IconCheck,
  IconBuilding,
  IconCalendar,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Unit, UnidadPartidasPresupuestosResponse } from '../../types';

interface EditablePartidaRow {
  partidaId: string;
  codigo: string;
  descripcion: string;
  originalHabilitado: boolean;
  habilitado: boolean;
  presupuestoId: string | null;
  originalMontoAsignado: string | null; // null = sin asignar
  montoInput: string; // lo que el usuario tipea
  motivoInput: string;
  isDirty: boolean;
}

interface PartidasPresupuestosModalProps {
  opened: boolean;
  onClose: () => void;
  unit: Unit | null;
  initialGestion?: number;
  onSaved?: () => void;
}

export const PartidasPresupuestosModal: React.FC<PartidasPresupuestosModalProps> = ({
  opened,
  onClose,
  unit,
  initialGestion = 2026,
  onSaved,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMINISTRADOR';

  const [gestion, setGestion] = useState<number>(initialGestion);
  const [items, setItems] = useState<EditablePartidaRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterHabilitadas, setFilterHabilitadas] = useState<string>('todas');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialGestion) {
      setGestion(initialGestion);
    }
  }, [initialGestion]);

  const loadData = async () => {
    if (!unit) return;
    setIsLoading(true);
    try {
      const res = await api.get<UnidadPartidasPresupuestosResponse>(
        `/unidades/${unit.id}/partidas-presupuestos?gestion=${gestion}`,
      );

      const rows: EditablePartidaRow[] = res.data.items.map((item) => ({
        partidaId: item.partidaId,
        codigo: item.codigo,
        descripcion: item.descripcion,
        originalHabilitado: item.habilitado,
        habilitado: item.habilitado,
        presupuestoId: item.presupuestoId,
        originalMontoAsignado: item.montoAsignado,
        montoInput: item.montoAsignado !== null ? item.montoAsignado : '',
        motivoInput: '',
        isDirty: false,
      }));

      setItems(rows);
    } catch (err: any) {
      notifications.show({
        title: 'Error de consulta',
        message:
          err.response?.data?.message ||
          'No se pudo cargar la configuración de partidas y presupuestos.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (opened && unit) {
      loadData();
    }
  }, [opened, unit, gestion]);

  const handleToggleHabilitado = (partidaId: string, val: boolean) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.partidaId !== partidaId) return row;
        // Si se deshabilita, descartar cualquier cambio pendiente de monto y motivo
        const newMontoInput = val
          ? row.montoInput
          : row.originalMontoAsignado !== null
          ? row.originalMontoAsignado
          : '';
        const newMotivoInput = val ? row.motivoInput : '';
        const dirty =
          val !== row.originalHabilitado ||
          (val && newMontoInput.trim() !== (row.originalMontoAsignado ?? ''));
        return {
          ...row,
          habilitado: val,
          montoInput: newMontoInput,
          motivoInput: newMotivoInput,
          isDirty: dirty,
        };
      }),
    );
  };

  const handleMontoChange = (partidaId: string, val: string) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.partidaId !== partidaId) return row;
        if (!row.habilitado) return row; // No permitir modificar si no está habilitada
        const dirty =
          row.habilitado !== row.originalHabilitado ||
          val.trim() !== (row.originalMontoAsignado ?? '');
        return {
          ...row,
          montoInput: val,
          isDirty: dirty,
        };
      }),
    );
  };

  const handleMotivoChange = (partidaId: string, val: string) => {
    setItems((prev) =>
      prev.map((row) => (row.partidaId === partidaId ? { ...row, motivoInput: val } : row)),
    );
  };

  // Cálculo en tiempo real del total presupuestado distinguiendo habilitadas de histórico
  const {
    totalHabilitado,
    totalHistoricoDeshabilitado,
    countHabilitadas,
    countConPresupuesto,
    countHistoricas,
    dirtyCount,
  } = useMemo(() => {
    let sumHab = 0;
    let sumDeshab = 0;
    let habCount = 0;
    let conPresCount = 0;
    let histCount = 0;
    let dirty = 0;

    items.forEach((item) => {
      if (item.habilitado) {
        habCount++;
        if (item.montoInput && item.montoInput.trim() !== '') {
          const parsed = parseFloat(item.montoInput);
          if (!isNaN(parsed) && parsed >= 0) {
            sumHab += parsed;
            conPresCount++;
          }
        }
      } else {
        if (item.originalMontoAsignado !== null) {
          const parsed = parseFloat(item.originalMontoAsignado);
          if (!isNaN(parsed) && parsed >= 0) {
            sumDeshab += parsed;
            histCount++;
          }
        }
      }
      if (item.isDirty) dirty++;
    });

    return {
      totalHabilitado: sumHab.toFixed(2),
      totalHistoricoDeshabilitado: sumDeshab.toFixed(2),
      countHabilitadas: habCount,
      countConPresupuesto: conPresCount,
      countHistoricas: histCount,
      dirtyCount: dirty,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.codigo.toLowerCase().includes(search.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (filterHabilitadas === 'habilitadas') return item.habilitado;
      if (filterHabilitadas === 'inactivas') return !item.habilitado;
      if (filterHabilitadas === 'con_presupuesto') return item.montoInput.trim() !== '';
      if (filterHabilitadas === 'sin_presupuesto') return item.montoInput.trim() === '';

      return true;
    });
  }, [items, search, filterHabilitadas]);

  const handleSave = async () => {
    if (!unit) return;

    const dirtyItems = items.filter((i) => i.isDirty);
    if (dirtyItems.length === 0) {
      notifications.show({
        title: 'Sin cambios',
        message: 'No se detectaron modificaciones en las partidas o presupuestos.',
        color: 'blue',
      });
      return;
    }

    // Validar montos de los ítems modificados que queden habilitados
    for (const item of dirtyItems) {
      if (item.habilitado && item.montoInput.trim() !== '') {
        const val = item.montoInput.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(val)) {
          notifications.show({
            title: 'Monto inválido',
            message: `El monto para la partida [${item.codigo}] debe ser un número decimal válido mayor o igual a 0.00 (ej. 5000.00).`,
            color: 'red',
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const payload = dirtyItems.map((item) => {
        if (!item.habilitado) {
          // Deshabilitar partida: no se envía monto para preservar histórico intacto
          return {
            partidaId: item.partidaId,
            habilitado: false,
          };
        }
        const montoTrimmed = item.montoInput.trim();
        return {
          partidaId: item.partidaId,
          habilitado: true,
          montoAsignado: montoTrimmed !== '' ? montoTrimmed : null,
          motivo: item.motivoInput.trim() || undefined,
        };
      });

      await api.post(`/unidades/${unit.id}/partidas-presupuestos`, {
        gestion,
        items: payload,
      });

      notifications.show({
        title: 'Configuración guardada exitosamente',
        message: `Se actualizaron ${dirtyItems.length} partidas y presupuestos para la gestión ${gestion}.`,
        color: 'teal',
      });

      onSaved?.();
      await loadData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al guardar',
        message:
          err.response?.data?.message ||
          'Ocurrió un error al persistir los cambios. Sus datos modificados se conservan en pantalla para corrección.',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCoins size={22} color="#007B6D" />
          <Box>
            <Title order={4} c="#1e293b">
              Partidas y Presupuestos — [{unit?.codigo}] {unit?.nombre}
            </Title>
            <Text size="xs" c="dimmed">
              Habilitación de clasificador institucional y asignación presupuestaria independiente
            </Text>
          </Box>
        </Group>
      }
      size="90%"
      centered
      closeOnClickOutside={dirtyCount === 0}
    >
      <Stack gap="md">
        {/* Barra de control superior */}
        <Paper p="sm" radius="md" withBorder style={{ backgroundColor: '#f8fafc' }}>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Group gap="sm">
              <Select
                label="Gestión Fiscal"
                leftSection={<IconCalendar size={16} color="#007B6D" />}
                data={[
                  { value: '2026', label: 'Gestión 2026' },
                  { value: '2025', label: 'Gestión 2025' },
                  { value: '2027', label: 'Gestión 2027' },
                ]}
                value={gestion.toString()}
                onChange={(val) => val && setGestion(parseInt(val, 10))}
                size="xs"
                w={140}
                allowDeselect={false}
                disabled={isSaving}
              />

              <TextInput
                label="Búsqueda de partida"
                placeholder="Filtrar por código o descripción..."
                leftSection={<IconSearch size={14} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                size="xs"
                w={{ base: 200, sm: 260 }}
              />

              <Select
                label="Filtro de catálogo"
                data={[
                  { value: 'todas', label: 'Todas las partidas' },
                  { value: 'habilitadas', label: 'Solo habilitadas' },
                  { value: 'inactivas', label: 'Solo inactivas' },
                  { value: 'con_presupuesto', label: 'Con presupuesto asignado' },
                  { value: 'sin_presupuesto', label: 'Sin presupuesto asignado' },
                ]}
                value={filterHabilitadas}
                onChange={(val) => val && setFilterHabilitadas(val)}
                size="xs"
                w={190}
                allowDeselect={false}
              />
            </Group>

            {/* Indicadores en tiempo real */}
            <Group gap="xs">
              <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: '#ffffff' }}>
                <Text size="10px" c="dimmed" fw={700}>
                  TOTAL HABILITADO (ACTIVO)
                </Text>
                <Text size="sm" fw={800} c="#007B6D">
                  Bs. {totalHabilitado}
                </Text>
              </Paper>
              {parseFloat(totalHistoricoDeshabilitado) > 0 && (
                <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: '#f8fafc' }}>
                  <Text size="10px" c="dimmed" fw={700}>
                    HISTÓRICO DESHABILITADAS
                  </Text>
                  <Text size="sm" fw={700} c="#64748b">
                    Bs. {totalHistoricoDeshabilitado}
                  </Text>
                </Paper>
              )}
              <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: '#ffffff' }}>
                <Text size="10px" c="dimmed" fw={700}>
                  HABILITADAS
                </Text>
                <Text size="sm" fw={700} c="#1e293b">
                  {countHabilitadas} / {items.length}
                </Text>
              </Paper>
              <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: '#ffffff' }}>
                <Text size="10px" c="dimmed" fw={700}>
                  CON MONTO
                </Text>
                <Text size="sm" fw={700} c="#1e293b">
                  {countConPresupuesto}
                </Text>
              </Paper>
            </Group>
          </Group>
        </Paper>

        {dirtyCount > 0 && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
            py="xs"
          >
            <Text size="xs">
              Tiene <strong>{dirtyCount}</strong> cambios pendientes de guardar. Presione "Guardar Configuración" para aplicar los cambios a la unidad y gestión seleccionada.
            </Text>
          </Alert>
        )}

        {/* Tabla interactiva */}
        {isLoading ? (
          <Box p="xl" ta="center">
            <Loader color="cpsTeal" size="md" />
            <Text size="sm" c="dimmed" mt="xs">
              Cargando catálogo institucional y presupuestos...
            </Text>
          </Box>
        ) : (
          <Box style={{ maxHeight: '52vh', overflowY: 'auto' }}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f1f5f9' }}>
                <Table.Tr>
                  <Table.Th style={{ width: 110 }}>Partida</Table.Th>
                  <Table.Th>Descripción Oficial</Table.Th>
                  <Table.Th style={{ width: 140, textAlign: 'center' }}>
                    Habilitación Unidad
                  </Table.Th>
                  <Table.Th style={{ width: 230 }}>
                    Presupuesto Asignado (Bs.)
                  </Table.Th>
                  <Table.Th style={{ width: 160 }}>Estado / Motivo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isMontoChanged =
                      item.montoInput.trim() !== (item.originalMontoAsignado ?? '');
                    const isHabChanged = item.habilitado !== item.originalHabilitado;

                    return (
                      <Table.Tr
                        key={item.partidaId}
                        style={{
                          backgroundColor: item.isDirty ? '#f0fdf4' : undefined,
                        }}
                      >
                        <Table.Td>
                          <Badge color="cpsTeal" variant="outline" size="sm">
                            {item.codigo}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.descripcion}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          {isAdmin ? (
                            <Switch
                              checked={item.habilitado}
                              onChange={(e) =>
                                handleToggleHabilitado(item.partidaId, e.currentTarget.checked)
                              }
                              color="cpsTeal"
                              size="sm"
                              label={item.habilitado ? 'Habilitada' : 'Inactiva'}
                              disabled={isSaving}
                            />
                          ) : (
                            <Badge color={item.habilitado ? 'teal' : 'gray'} variant="light">
                              {item.habilitado ? 'Habilitada' : 'Inactiva'}
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={4}>
                            <Group gap="xs" wrap="nowrap">
                              <TextInput
                                placeholder={!item.habilitado ? 'Inactiva' : '0.00'}
                                size="xs"
                                value={item.montoInput}
                                onChange={(e) =>
                                  handleMontoChange(item.partidaId, e.currentTarget.value)
                                }
                                disabled={!isAdmin || isSaving || !item.habilitado}
                                style={{ flex: 1 }}
                                rightSection={
                                  item.montoInput.trim() !== '' ? (
                                    <Text size="xs" c="dimmed" pr="xs">
                                      Bs.
                                    </Text>
                                  ) : null
                                }
                              />
                              {isAdmin && (
                                <Tooltip label="Limpiar (dejar sin presupuesto asignado)">
                                  <Button
                                    size="compact-xs"
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => handleMontoChange(item.partidaId, '')}
                                    disabled={
                                      !item.habilitado ||
                                      (!item.montoInput && item.originalMontoAsignado === null)
                                    }
                                  >
                                    ×
                                  </Button>
                                </Tooltip>
                              )}
                            </Group>

                            {/* Distinción clara de estado presupuestario previo */}
                            {!item.habilitado ? (
                              item.originalMontoAsignado !== null ? (
                                <Text size="10px" c="dimmed">
                                  🔒 Histórico conservado: Bs. {item.originalMontoAsignado} (Solo lectura)
                                </Text>
                              ) : (
                                <Text size="10px" c="dimmed">
                                  ⚪ Inactiva para esta unidad (Habilite para asignar)
                                </Text>
                              )
                            ) : item.originalMontoAsignado === null ? (
                              <Text size="10px" c="dimmed">
                                ⚪ Sin presupuesto asignado previo
                              </Text>
                            ) : item.originalMontoAsignado === '0.00' ? (
                              <Text size="10px" c="orange">
                                🟡 Presupuesto previo: Bs. 0.00 (monto cero)
                              </Text>
                            ) : (
                              <Text size="10px" c="#007B6D">
                                🟢 Registrado: Bs. {item.originalMontoAsignado}
                              </Text>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={4}>
                            {!item.habilitado ? (
                              <Badge color="gray" size="xs" variant="outline">
                                {item.originalMontoAsignado !== null ? 'Inactiva (Histórico)' : 'Inactiva'}
                              </Badge>
                            ) : item.isDirty ? (
                              <Badge color="blue" size="xs" variant="filled">
                                Modificado
                              </Badge>
                            ) : item.originalMontoAsignado !== null ? (
                              <Badge color="teal" size="xs" variant="light">
                                Asignado
                              </Badge>
                            ) : (
                              <Badge color="gray" size="xs" variant="outline">
                                Sin asignar
                              </Badge>
                            )}

                            {/* Si modificó el monto de una partida existente, campo de motivo */}
                            {isAdmin &&
                              item.habilitado &&
                              isMontoChanged &&
                              item.originalMontoAsignado !== null &&
                              item.montoInput.trim() !== '' && (
                                <TextInput
                                  placeholder="Motivo del ajuste..."
                                  size="xs"
                                  value={item.motivoInput}
                                  onChange={(e) =>
                                    handleMotivoChange(item.partidaId, e.currentTarget.value)
                                  }
                                  disabled={isSaving}
                                />
                              )}
                          </Stack>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={5} ta="center" py="xl">
                      <Text c="dimmed" size="sm">
                        No se encontraron partidas con el filtro aplicado.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        )}

        <Divider />

        {/* Botones de acción */}
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            * Cada partida y monto es independiente por unidad y gestión fiscal. Deshabilitar una partida no elimina su presupuesto histórico.
          </Text>
          <Group gap="sm">
            <Button variant="default" onClick={onClose} disabled={isSaving}>
              {dirtyCount > 0 ? 'Descartar y Cerrar' : 'Cerrar'}
            </Button>
            {isAdmin && (
              <Button
                color="cpsTeal"
                leftSection={<IconCheck size={16} />}
                onClick={handleSave}
                loading={isSaving}
                disabled={dirtyCount === 0}
              >
                Guardar Configuración ({dirtyCount})
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
