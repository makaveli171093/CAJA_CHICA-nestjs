import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  TextInput,
  Textarea,
  Button,
  Badge,
  Alert,
  Loader,
  Box,
  Modal,
  Table,
  Checkbox,
  SimpleGrid,
  ThemeIcon,
  Card,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBuildingBank,
  IconPlus,
  IconCheck,
  IconX,
  IconReceipt2,
  IconPrinter,
  IconAlertTriangle,
  IconCoin,
  IconCash,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import {
  getReposiciones,
  getReposicion,
  getRendicionesPendientesReposicion,
  createReposicion,
  aprobarReposicion,
  rechazarReposicion,
  efectuarReposicion,
} from '../../services/api';
import { Reposicion, Rendicion, EstadoReposicion } from '../../types';
import { formatDateToBO, formatDateTimeToBO } from '../../utils/dateUtils';

export const ReposicionesPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, activeUnit, user } = useAuth();
  const [reposiciones, setReposiciones] = useState<Reposicion[]>([]);
  const [rendicionesPendientes, setRendicionesPendientes] = useState<Rendicion[]>([]);
  const [selectedRendicionIds, setSelectedRendicionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modales
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [selectedReposicion, setSelectedReposicion] = useState<Reposicion | null>(null);

  const [approveModalOpened, { open: openApproveModal, close: closeApproveModal }] = useDisclosure(false);
  const [rejectModalOpened, { open: openRejectModal, close: closeRejectModal }] = useDisclosure(false);
  const [efectuarModalOpened, { open: openEfectuarModal, close: closeEfectuarModal }] = useDisclosure(false);

  // Formularios
  const [observacionesSolicitud, setObservacionesSolicitud] = useState('');
  const [observacionesAprobacion, setObservacionesAprobacion] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [efectuarForm, setEfectuarForm] = useState({
    numeroChequeTransferencia: '',
    bancoOrigen: 'BANCO UNIÓN S.A.',
    cuentaBancaria: '1-00000012345678',
    observaciones: '',
  });

  const isFinanciero = user?.rol === 'FINANCIERO';
  const isAdmin = user?.rol === 'ADMINISTRADOR';
  const isEncargado = user?.rol === 'ENCARGADO';
  const canApprove = isFinanciero || isAdmin;
  const canRequest = isEncargado || isAdmin;

  const fetchData = async () => {
    if (!activeUnitId) return;
    setIsLoading(true);
    try {
      const data = await getReposiciones(activeUnitId, currentGestion);
      setReposiciones(data || []);
    } catch (error: any) {
      notifications.show({
        title: 'Error al cargar reposiciones',
        message: error.response?.data?.message || 'No se pudo obtener la lista de reposiciones.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeUnitId, currentGestion]);

  const handleOpenCreateModal = async () => {
    if (!activeUnitId) return;
    try {
      const pendientes = await getRendicionesPendientesReposicion(activeUnitId, currentGestion);
      setRendicionesPendientes(pendientes || []);
      // Pre-seleccionar todas las pendientes por defecto
      setSelectedRendicionIds((pendientes || []).map((r: Rendicion) => r.id));
      setObservacionesSolicitud('');
      openCreateModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error al cargar rendiciones',
        message: error.response?.data?.message || 'No se pudieron consultar las rendiciones pendientes.',
        color: 'red',
      });
    }
  };

  const handleToggleRendicion = (id: string) => {
    setSelectedRendicionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllRendiciones = () => {
    if (selectedRendicionIds.length === rendicionesPendientes.length) {
      setSelectedRendicionIds([]);
    } else {
      setSelectedRendicionIds(rendicionesPendientes.map((r) => r.id));
    }
  };

  const totalSeleccionado = rendicionesPendientes
    .filter((r) => selectedRendicionIds.includes(r.id))
    .reduce((sum, r) => sum + parseFloat(r.totalDescargado || '0'), 0);

  const handleCreateReposicion = async () => {
    if (selectedRendicionIds.length === 0) {
      notifications.show({
        title: 'Selección requerida',
        message: 'Debe seleccionar al menos una rendición aprobada para solicitar la reposición.',
        color: 'orange',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await createReposicion({
        unidadId: activeUnitId!,
        rendicionIds: selectedRendicionIds,
        observaciones: observacionesSolicitud,
      });
      notifications.show({
        title: 'Solicitud Creada',
        message: 'La solicitud de reposición de fondos fue registrada exitosamente.',
        color: 'teal',
      });
      closeCreateModal();
      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Error al crear solicitud',
        message: error.response?.data?.message || 'No se pudo crear la reposición.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const rep = await getReposicion(id);
      setSelectedReposicion(rep);
      openDetailModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'No se pudo cargar el detalle de la reposición.',
        color: 'red',
      });
    }
  };

  const handleAprobar = async () => {
    if (!selectedReposicion) return;
    setIsSubmitting(true);
    try {
      await aprobarReposicion(selectedReposicion.id, observacionesAprobacion);
      notifications.show({
        title: 'Reposición Aprobada',
        message: `La reposición ${selectedReposicion.numeroReposicion} fue aprobada para desembolso.`,
        color: 'teal',
      });
      closeApproveModal();
      setObservacionesAprobacion('');
      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Error al aprobar',
        message: error.response?.data?.message || 'No se pudo aprobar la reposición.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!selectedReposicion || !motivoRechazo.trim()) {
      notifications.show({
        title: 'Motivo requerido',
        message: 'Especifique el motivo formal de rechazo.',
        color: 'orange',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await rechazarReposicion(selectedReposicion.id, motivoRechazo);
      notifications.show({
        title: 'Reposición Rechazada',
        message: `La reposición fue rechazada y las rendiciones fueron liberadas.`,
        color: 'yellow',
      });
      closeRejectModal();
      setMotivoRechazo('');
      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Error al rechazar',
        message: error.response?.data?.message || 'No se pudo rechazar la reposición.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEfectuar = async () => {
    if (!selectedReposicion || !efectuarForm.numeroChequeTransferencia.trim()) {
      notifications.show({
        title: 'Campo Requerido',
        message: 'Indique el número de cheque o transferencia bancaria.',
        color: 'orange',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await efectuarReposicion(selectedReposicion.id, efectuarForm);
      notifications.show({
        title: 'Reposición Efectuada',
        message: `El saldo de efectivo de la Caja Chica fue restaurado exitosamente (+Bs. ${selectedReposicion.montoAprobado || selectedReposicion.montoSolicitado}).`,
        color: 'teal',
      });
      closeEfectuarModal();
      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Error al efectuar desembolso',
        message: error.response?.data?.message || 'No se pudo efectuar el desembolso.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (estado: EstadoReposicion) => {
    switch (estado) {
      case 'SOLICITADA':
        return <Badge color="yellow" variant="light">SOLICITADA</Badge>;
      case 'APROBADA':
        return <Badge color="blue" variant="filled">APROBADA</Badge>;
      case 'EFECTUADA':
        return <Badge color="teal" variant="filled">EFECTUADA / REEMBOLSADA</Badge>;
      case 'RECHAZADA':
        return <Badge color="red" variant="light">RECHAZADA</Badge>;
      default:
        return <Badge color="gray">{estado}</Badge>;
    }
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap" gap="md">
          <Box>
            <Title order={3} c="#1e293b">
              Reposiciones de Fondos (Reembolsos de Caja Chica)
            </Title>
            <Text size="xs" c="dimmed">
              Reglamento CPS 002/2013 | Agrupación de descargos aprobados para reposición de efectivo
            </Text>
          </Box>
          <Group>
            {canRequest && (
              <Button
                color="cpsTeal"
                leftSection={<IconPlus size={16} />}
                onClick={handleOpenCreateModal}
              >
                Nueva Solicitud de Reposición
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Tabla de Reposiciones */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        {isLoading ? (
          <Box py="xl" ta="center">
            <Loader color="cpsTeal" size="md" />
            <Text size="sm" c="dimmed" mt="xs">Cargando reposiciones de fondos...</Text>
          </Box>
        ) : reposiciones.length === 0 ? (
          <Box py="xl" ta="center">
            <ThemeIcon size={48} radius="xl" color="teal" variant="light" mb="sm">
              <IconBuildingBank size={24} />
            </ThemeIcon>
            <Text fw={600} c="#1e293b">No existen solicitudes de reposición registradas</Text>
            <Text size="sm" c="dimmed">
              Las reposiciones permiten consolidar rendiciones aprobadas para restaurar el efectivo de caja chica.
            </Text>
          </Box>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th style={{ width: 140 }}>Nº Reposición</Table.Th>
                <Table.Th style={{ width: 110 }}>Fecha</Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}>Rendiciones</Table.Th>
                <Table.Th style={{ width: 140, textAlign: 'right' }}>Monto Solicitado</Table.Th>
                <Table.Th style={{ width: 150 }}>Estado</Table.Th>
                <Table.Th>Cheque / Transferencia</Table.Th>
                <Table.Th style={{ width: 180, textAlign: 'center' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reposiciones.map((rep) => (
                <Table.Tr key={rep.id}>
                  <Table.Td fw={700} c="#007B6D">{rep.numeroReposicion}</Table.Td>
                  <Table.Td style={{ fontSize: '13px' }}>
                    {formatDateToBO(rep.fechaSolicitud)}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge variant="outline" color="gray">
                      {rep.rendiciones?.length || 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>
                    Bs. {parseFloat(rep.montoSolicitado).toFixed(2)}
                  </Table.Td>
                  <Table.Td>{getStatusBadge(rep.estado)}</Table.Td>
                  <Table.Td style={{ fontSize: '13px' }}>
                    {rep.numeroChequeTransferencia ? (
                      <Text size="xs" fw={500}>
                        {rep.bancoOrigen ? `${rep.bancoOrigen} - ` : ''}Nº {rep.numeroChequeTransferencia}
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="center">
                      <Tooltip label="Ver Detalle y Carátula">
                        <ActionIcon
                          variant="light"
                          color="teal"
                          onClick={() => handleViewDetail(rep.id)}
                        >
                          <IconReceipt2 size={16} />
                        </ActionIcon>
                      </Tooltip>

                      {canApprove && rep.estado === 'SOLICITADA' && (
                        <>
                          <Tooltip label="Aprobar Solicitud">
                            <ActionIcon
                              variant="filled"
                              color="blue"
                              onClick={() => {
                                setSelectedReposicion(rep);
                                openApproveModal();
                              }}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Rechazar Solicitud">
                            <ActionIcon
                              variant="filled"
                              color="red"
                              onClick={() => {
                                setSelectedReposicion(rep);
                                openRejectModal();
                              }}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}

                      {canApprove && rep.estado === 'APROBADA' && (
                        <Tooltip label="Efectuar Desembolso (Restaurar Efectivo)">
                          <Button
                            size="compact-xs"
                            color="teal"
                            leftSection={<IconCash size={14} />}
                            onClick={() => {
                              setSelectedReposicion(rep);
                              openEfectuarModal();
                            }}
                          >
                            Efectuar
                          </Button>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Modal: Crear Reposición */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={
          <Group gap="xs">
            <IconBuildingBank color="#007B6D" size={20} />
            <Text fw={700} c="#1e293b">Nueva Solicitud de Reposición de Fondos</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm">
            Seleccione las rendiciones de cuentas aprobadas que integrarán este reembolso institucional:
          </Text>

          {rendicionesPendientes.length === 0 ? (
            <Alert color="orange" title="Sin Rendiciones Pendientes">
              No existen rendiciones aprobadas pendientes de reposición en la unidad activa. Debe aprobar descargos previamente en el módulo de Rendiciones.
            </Alert>
          ) : (
            <>
              <Group justify="space-between">
                <Button size="xs" variant="subtle" onClick={handleToggleAllRendiciones}>
                  {selectedRendicionIds.length === rendicionesPendientes.length
                    ? 'Deseleccionar Todas'
                    : 'Seleccionar Todas'}
                </Button>
                <Badge size="lg" color="teal">
                  Total a Reponer: Bs. {totalSeleccionado.toFixed(2)}
                </Badge>
              </Group>

              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
                    <Table.Th style={{ width: 40 }}></Table.Th>
                    <Table.Th>Nº Rendición</Table.Th>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Solicitante</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total Descargo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rendicionesPendientes.map((r) => (
                    <Table.Tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleToggleRendicion(r.id)}
                    >
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRendicionIds.includes(r.id)}
                          onChange={() => handleToggleRendicion(r.id)}
                        />
                      </Table.Td>
                      <Table.Td fw={600} c="#007B6D">{r.numeroRendicion}</Table.Td>
                      <Table.Td style={{ fontSize: '12px' }}>
                        {formatDateToBO(r.fechaRendicion)}
                      </Table.Td>
                      <Table.Td style={{ fontSize: '12px' }}>
                        {r.anticipo?.pedido?.solicitanteNombres} {r.anticipo?.pedido?.solicitanteApellidos}
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        Bs. {parseFloat(r.totalDescargado).toFixed(2)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Textarea
                label="Observaciones o Referencia de la Solicitud"
                placeholder="Ej: Reposición de gastos operativos correspondientes a la primera quincena..."
                value={observacionesSolicitud}
                onChange={(e) => setObservacionesSolicitud(e.currentTarget.value)}
                minRows={2}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeCreateModal}>
                  Cancelar
                </Button>
                <Button
                  color="cpsTeal"
                  loading={isSubmitting}
                  disabled={selectedRendicionIds.length === 0}
                  onClick={handleCreateReposicion}
                >
                  Solicitar Reposición (Bs. {totalSeleccionado.toFixed(2)})
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Modal: Detalle / Carátula de Reposición */}
      <Modal
        opened={detailModalOpened}
        onClose={closeDetailModal}
        title={
          <Group gap="xs">
            <IconBuildingBank color="#007B6D" size={20} />
            <Text fw={700} c="#1e293b">
              Carátula de Reposición: {selectedReposicion?.numeroReposicion}
            </Text>
          </Group>
        }
        size="lg"
      >
        {selectedReposicion && (
          <Stack gap="md" id="print-reposicion-caratula">
            <Paper p="sm" withBorder style={{ backgroundColor: '#f8fafc' }}>
              <SimpleGrid cols={2} spacing="xs">
                <Box>
                  <Text size="xs" c="dimmed">Unidad Institucional</Text>
                  <Text size="sm" fw={700}>
                    [{selectedReposicion.unidad?.codigo}] {selectedReposicion.unidad?.nombre}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Gestión Fiscal</Text>
                  <Text size="sm" fw={700}>{selectedReposicion.gestion}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Fecha de Solicitud</Text>
                  <Text size="sm" fw={600}>
                    {formatDateToBO(selectedReposicion.fechaSolicitud)}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Estado</Text>
                  {getStatusBadge(selectedReposicion.estado)}
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Solicitado por</Text>
                  <Text size="sm" fw={500}>{selectedReposicion.solicitante?.nombreCompleto}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Aprobado por</Text>
                  <Text size="sm" fw={500}>{selectedReposicion.aprobador?.nombreCompleto || 'Pendiente'}</Text>
                </Box>
              </SimpleGrid>
            </Paper>

            <Title order={5} c="#1e293b">Rendiciones Incluidas en la Reposición</Title>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th>Nº Rendición</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Solicitante</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Importe Descargado</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedReposicion.rendiciones?.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td fw={600} c="#007B6D">{r.numeroRendicion}</Table.Td>
                    <Table.Td style={{ fontSize: '12px' }}>
                      {formatDateToBO(r.fechaRendicion)}
                    </Table.Td>
                    <Table.Td style={{ fontSize: '12px' }}>
                      {r.anticipo?.pedido?.solicitanteNombres} {r.anticipo?.pedido?.solicitanteApellidos}
                    </Table.Td>
                    <Table.Td ta="right" fw={700}>
                      Bs. {parseFloat(r.totalDescargado).toFixed(2)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between" mt="xs">
              <Text size="sm" fw={600}>Total Reposición Solicitada:</Text>
              <Text size="md" fw={800} c="#007B6D">
                Bs. {parseFloat(selectedReposicion.montoSolicitado).toFixed(2)}
              </Text>
            </Group>

            {selectedReposicion.numeroChequeTransferencia && (
              <Alert color="teal" title="Datos de Desembolso / Pago">
                <Text size="xs">
                  <strong>Documento de Pago:</strong> Nº {selectedReposicion.numeroChequeTransferencia} ({selectedReposicion.bancoOrigen || 'Bancario'})
                </Text>
                <Text size="xs">
                  <strong>Cuenta Origen:</strong> {selectedReposicion.cuentaBancaria || 'Institucional CPS'}
                </Text>
                <Text size="xs">
                  <strong>Fecha de Ingreso a Caja:</strong> {selectedReposicion.fechaEfectuada ? formatDateTimeToBO(selectedReposicion.fechaEfectuada) : '-'}
                </Text>
              </Alert>
            )}

            <Group justify="space-between" mt="md">
              <Button
                variant="outline"
                leftSection={<IconPrinter size={16} />}
                onClick={() => window.print()}
              >
                Imprimir Carátula
              </Button>
              <Button variant="default" onClick={closeDetailModal}>
                Cerrar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal: Aprobar Reposición */}
      <Modal
        opened={approveModalOpened}
        onClose={closeApproveModal}
        title={
          <Group gap="xs">
            <IconCheck color="#2563eb" size={20} />
            <Text fw={700}>Aprobar Reposición: {selectedReposicion?.numeroReposicion}</Text>
          </Group>
        }
      >
        <Stack gap="md">
          <Text size="sm">
            ¿Está conforme con la documentación y descargos presentados por un total de{' '}
            <strong>Bs. {selectedReposicion ? parseFloat(selectedReposicion.montoSolicitado).toFixed(2) : '0.00'}</strong>?
          </Text>
          <Textarea
            label="Observaciones de Aprobación Financiera"
            placeholder="Documentación revisada y conforme a normativa..."
            value={observacionesAprobacion}
            onChange={(e) => setObservacionesAprobacion(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeApproveModal}>Cancelar</Button>
            <Button color="blue" loading={isSubmitting} onClick={handleAprobar}>
              Aprobar para Desembolso
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Rechazar Reposición */}
      <Modal
        opened={rejectModalOpened}
        onClose={closeRejectModal}
        title={
          <Group gap="xs">
            <IconX color="#dc2626" size={20} />
            <Text fw={700}>Rechazar Solicitud de Reposición</Text>
          </Group>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Al rechazar la reposición, las rendiciones quedarán liberadas para que el encargado pueda corregirlas o incluirlas en una nueva solicitud.
          </Text>
          <Textarea
            label="Motivo del Rechazo (Obligatorio)"
            placeholder="Indique los descargos o facturas observadas..."
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeRejectModal}>Cancelar</Button>
            <Button color="red" loading={isSubmitting} onClick={handleRechazar}>
              Rechazar y Liberar Rendiciones
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Efectuar Desembolso e Ingreso a Caja */}
      <Modal
        opened={efectuarModalOpened}
        onClose={closeEfectuarModal}
        title={
          <Group gap="xs">
            <IconCash color="#007B6D" size={22} />
            <Text fw={700}>Efectuar Reposición e Ingreso a Caja</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <Alert color="teal" icon={<IconCoin size={18} />}>
            Esta operación generará un movimiento de efectivo de tipo <strong>REPOSICIÓN</strong> en la Caja Chica por{' '}
            <strong>Bs. {selectedReposicion ? parseFloat(selectedReposicion.montoAprobado || selectedReposicion.montoSolicitado).toFixed(2) : '0.00'}</strong>,
            restaurando el saldo disponible de efectivo.
          </Alert>

          <TextInput
            label="Nº Cheque o Transferencia Bancaria *"
            placeholder="Ej: CHQ-894210 o TRANSF-2026-99"
            value={efectuarForm.numeroChequeTransferencia}
            onChange={(e) => setEfectuarForm({ ...efectuarForm, numeroChequeTransferencia: e.currentTarget.value })}
            required
          />

          <TextInput
            label="Banco de Origen"
            value={efectuarForm.bancoOrigen}
            onChange={(e) => setEfectuarForm({ ...efectuarForm, bancoOrigen: e.currentTarget.value })}
          />

          <TextInput
            label="Cuenta Bancaria Institucional"
            value={efectuarForm.cuentaBancaria}
            onChange={(e) => setEfectuarForm({ ...efectuarForm, cuentaBancaria: e.currentTarget.value })}
          />

          <Textarea
            label="Observaciones adicionales"
            value={efectuarForm.observaciones}
            onChange={(e) => setEfectuarForm({ ...efectuarForm, observaciones: e.currentTarget.value })}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeEfectuarModal}>Cancelar</Button>
            <Button color="cpsTeal" loading={isSubmitting} onClick={handleEfectuar}>
              Confirmar Desembolso e Ingreso
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
