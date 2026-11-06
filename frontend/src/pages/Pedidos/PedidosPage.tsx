import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Button,
  Table,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  Grid,
  Alert,
  Loader,
  ActionIcon,
  Tooltip,
  Card,
  Divider,
  Switch,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconX,
  IconReceipt,
  IconPrinter,
  IconAlertCircle,
  IconInfoCircle,
  IconFileText,
  IconCash,
  IconCoin,
  IconBuildingHospital,
  IconClock,
  IconCheck,
  IconShieldCheck,
  IconDownload,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api, downloadValePdf, openValePdfInNewTab, corregirPedido } from '../../services/api';
import {
  Pedido,
  PartidaHabilitada,
  CajaApertura,
  DashboardData,
  EstadoPedido,
} from '../../types';
import { DateInputBO } from '../../components/common/DateInputBO';
import {
  formatDateToBO,
  formatDateTimeToBO,
  getFechaHoyBolivia,
} from '../../utils/dateUtils';

export const PedidosPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, activeUnit, accessibleUnits, setActiveUnitId } = useAuth();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [caja, setCaja] = useState<CajaApertura | null>(null);
  const [partidasHabilitadas, setPartidasHabilitadas] = useState<PartidaHabilitada[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>('');

  // Modales
  const [formModalOpened, { open: openFormModal, close: closeFormModal }] = useDisclosure(false);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [cancelModalOpened, { open: openCancelModal, close: closeCancelModal }] = useDisclosure(false);
  const [deliverModalOpened, { open: openDeliverModal, close: closeDeliverModal }] = useDisclosure(false);
  const [successDeliverModalOpened, { open: openSuccessDeliverModal, close: closeSuccessDeliverModal }] = useDisclosure(false);
  const [corregirModalOpened, { open: openCorregirModal, close: closeCorregirModal }] = useDisclosure(false);

  // Estados de selección
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [deliveredValeInfo, setDeliveredValeInfo] = useState<{ pedidoId: string; numeroVale: string } | null>(null);
  const [fechaEntrega, setFechaEntrega] = useState<string>(getFechaHoyBolivia());
  const [deliveryDateError, setDeliveryDateError] = useState<string | null>(null);

  // Formulario de corrección con justificación
  const [corregirForm, setCorregirForm] = useState({
    justificacion: '',
    partidaId: '',
    monto: '',
    fechaSolicitud: '',
    fechaEntrega: '',
    solicitanteNombres: '',
    solicitanteApellidos: '',
    solicitanteCi: '',
    solicitanteArea: '',
    receptorNombres: '',
    receptorApellidos: '',
    receptorCi: '',
    lugar: '',
    descripcion: '',
    motivo: '',
    referenciaRepMat: '',
    observaciones: '',
  });

  // Formulario nuevo / edición
  const [formData, setFormData] = useState({
    numeroPedido: '',
    fechaSolicitud: getFechaHoyBolivia(),
    lugar: 'La Paz',
    partidaId: '',
    monto: '',
    solicitanteNombres: '',
    solicitanteApellidos: '',
    solicitanteCi: '',
    solicitanteArea: '',
    mismoReceptor: true,
    receptorNombres: '',
    receptorApellidos: '',
    receptorCi: '',
    descripcion: '',
    motivo: '',
    referenciaRepMat: '',
    observaciones: '',
  });

  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  // Carga de datos principales
  const fetchData = useCallback(async () => {
    if (!activeUnitId) {
      setPedidos([]);
      setCaja(null);
      setPartidasHabilitadas([]);
      setDashboardData(null);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Obtener estado de caja y partidas habilitadas
      const [cajaRes, partRes, dashRes] = await Promise.all([
        api.get(`/apertura?unidadId=${activeUnitId}&gestion=${currentGestion}`).catch(() => ({ data: null })),
        api.get(`/unidades/${activeUnitId}/partidas-habilitadas`).catch(() => ({ data: [] })),
        api.get(`/dashboard?unidadId=${activeUnitId}&gestion=${currentGestion}`).catch(() => ({ data: null })),
      ]);

      setCaja(cajaRes.data || null);
      setPartidasHabilitadas(
        Array.isArray(partRes.data) ? partRes.data.filter((p: any) => p.habilitado) : [],
      );
      setDashboardData(dashRes.data || null);

      // 2. Obtener lista de pedidos con filtros
      let url = `/pedidos?unidadId=${activeUnitId}&gestion=${currentGestion}`;
      if (filtroEstado && filtroEstado !== 'TODOS') {
        url += `&estado=${filtroEstado}`;
      }
      if (filtroFechaDesde) {
        url += `&fechaDesde=${filtroFechaDesde}`;
      }
      if (filtroFechaHasta) {
        url += `&fechaHasta=${filtroFechaHasta}`;
      }

      const pedidosRes = await api.get(url);
      setPedidos(Array.isArray(pedidosRes.data) ? pedidosRes.data : []);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al cargar la información de pedidos.');
    } finally {
      setIsLoading(false);
    }
  }, [activeUnitId, currentGestion, filtroEstado, filtroFechaDesde, filtroFechaHasta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sincronizar datos del receptor si el switch está activado
  const handleSolicitanteChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (prev.mismoReceptor) {
        if (field === 'solicitanteNombres') updated.receptorNombres = value;
        if (field === 'solicitanteApellidos') updated.receptorApellidos = value;
        if (field === 'solicitanteCi') updated.receptorCi = value;
      }
      return updated;
    });
  };

  const handleMismoReceptorToggle = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      mismoReceptor: checked,
      receptorNombres: checked ? prev.solicitanteNombres : prev.receptorNombres,
      receptorApellidos: checked ? prev.solicitanteApellidos : prev.receptorApellidos,
      receptorCi: checked ? prev.solicitanteCi : prev.receptorCi,
    }));
  };

  const handleOpenCreateModal = () => {
    if (!caja || caja.estado !== 'ABIERTA') {
      setErrorMsg('No se pueden crear pedidos porque la caja chica no está ABIERTA para esta gestión.');
      return;
    }
    setEditingPedidoId(null);
    setFormErrors([]);
    setFormData({
      numeroPedido: '',
      fechaSolicitud: getFechaHoyBolivia(),
      lugar: 'La Paz',
      partidaId: partidasHabilitadas[0]?.partidaId || '',
      monto: '',
      solicitanteNombres: '',
      solicitanteApellidos: '',
      solicitanteCi: '',
      solicitanteArea: '',
      mismoReceptor: true,
      receptorNombres: '',
      receptorApellidos: '',
      receptorCi: '',
      descripcion: '',
      motivo: '',
      referenciaRepMat: '',
      observaciones: '',
    });
    openFormModal();
  };

  const handleOpenEditModal = (pedido: Pedido) => {
    if (pedido.estado !== 'BORRADOR') {
      setErrorMsg('Solo se pueden modificar pedidos en estado BORRADOR.');
      return;
    }
    setEditingPedidoId(pedido.id);
    setFormErrors([]);
    const esMismo =
      pedido.solicitanteNombres === pedido.receptorNombres &&
      pedido.solicitanteApellidos === pedido.receptorApellidos &&
      pedido.solicitanteCi === pedido.receptorCi;

    setFormData({
      numeroPedido: pedido.numeroPedido,
      fechaSolicitud: pedido.fechaSolicitud.slice(0, 10),
      lugar: pedido.lugar || 'La Paz',
      partidaId: pedido.partidaId,
      monto: pedido.monto,
      solicitanteNombres: pedido.solicitanteNombres,
      solicitanteApellidos: pedido.solicitanteApellidos,
      solicitanteCi: pedido.solicitanteCi,
      solicitanteArea: pedido.solicitanteArea,
      mismoReceptor: esMismo,
      receptorNombres: pedido.receptorNombres,
      receptorApellidos: pedido.receptorApellidos,
      receptorCi: pedido.receptorCi,
      descripcion: pedido.descripcion,
      motivo: pedido.motivo,
      referenciaRepMat: pedido.referenciaRepMat || '',
      observaciones: pedido.observaciones || '',
    });
    openFormModal();
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId || !caja) return;

    setIsSubmitting(true);
    setFormErrors([]);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingPedidoId) {
        // PAYLOAD DE ACTUALIZACIÓN (UpdatePedidoDto)
        // REGLA: Excluir estrictamente unidadId, gestion y cajaAperturaId; enviar únicamente campos admitidos
        const updatePayload = {
          partidaId: formData.partidaId,
          numeroPedido: formData.numeroPedido.trim(),
          fechaSolicitud: formData.fechaSolicitud,
          lugar: formData.lugar.trim(),
          solicitanteNombres: formData.solicitanteNombres.trim(),
          solicitanteApellidos: formData.solicitanteApellidos.trim(),
          solicitanteCi: formData.solicitanteCi.trim(),
          solicitanteArea: formData.solicitanteArea.trim(),
          receptorNombres: formData.receptorNombres.trim(),
          receptorApellidos: formData.receptorApellidos.trim(),
          receptorCi: formData.receptorCi.trim(),
          descripcion: formData.descripcion.trim(),
          motivo: formData.motivo.trim(),
          monto: formData.monto,
          referenciaRepMat: formData.referenciaRepMat?.trim() || undefined,
          observaciones: formData.observaciones?.trim() || undefined,
        };

        await api.patch(`/pedidos/${editingPedidoId}`, updatePayload);
        setSuccessMsg('Borrador de pedido actualizado correctamente.');
      } else {
        // PAYLOAD DE CREACIÓN (CreatePedidoDto)
        // Incluye los identificadores inmutables de contexto
        const createPayload = {
          unidadId: activeUnitId,
          gestion: currentGestion,
          cajaAperturaId: caja.id,
          partidaId: formData.partidaId,
          numeroPedido: formData.numeroPedido.trim(),
          fechaSolicitud: formData.fechaSolicitud,
          lugar: formData.lugar.trim(),
          solicitanteNombres: formData.solicitanteNombres.trim(),
          solicitanteApellidos: formData.solicitanteApellidos.trim(),
          solicitanteCi: formData.solicitanteCi.trim(),
          solicitanteArea: formData.solicitanteArea.trim(),
          receptorNombres: formData.receptorNombres.trim(),
          receptorApellidos: formData.receptorApellidos.trim(),
          receptorCi: formData.receptorCi.trim(),
          descripcion: formData.descripcion.trim(),
          motivo: formData.motivo.trim(),
          monto: formData.monto,
          referenciaRepMat: formData.referenciaRepMat?.trim() || undefined,
          observaciones: formData.observaciones?.trim() || undefined,
        };

        await api.post('/pedidos', createPayload);
        setSuccessMsg('Pedido en borrador registrado con éxito.');
      }

      closeFormModal();
      fetchData();
    } catch (err: any) {
      const raw = err.response?.data?.message;
      const errList = Array.isArray(raw)
        ? raw
        : [raw || 'Error al procesar el guardado del pedido.'];
      setFormErrors(errList);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCorregirModal = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setCorregirForm({
      justificacion: '',
      partidaId: pedido.partidaId,
      monto: pedido.monto,
      fechaSolicitud: pedido.fechaSolicitud.slice(0, 10),
      fechaEntrega: pedido.anticipo ? pedido.anticipo.fechaEntrega.slice(0, 10) : '',
      solicitanteNombres: pedido.solicitanteNombres,
      solicitanteApellidos: pedido.solicitanteApellidos,
      solicitanteCi: pedido.solicitanteCi,
      solicitanteArea: pedido.solicitanteArea,
      receptorNombres: pedido.receptorNombres,
      receptorApellidos: pedido.receptorApellidos,
      receptorCi: pedido.receptorCi,
      lugar: pedido.lugar || 'La Paz',
      descripcion: pedido.descripcion,
      motivo: pedido.motivo,
      referenciaRepMat: pedido.referenciaRepMat || '',
      observaciones: pedido.observaciones || '',
    });
    openCorregirModal();
  };

  const handleConfirmCorregir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPedido) return;

    if (!corregirForm.justificacion.trim() || corregirForm.justificacion.trim().length < 10) {
      notifications.show({
        color: 'red',
        title: 'Justificación insuficiente',
        message: 'Debe ingresar una justificación formal obligatoria de al menos 10 caracteres.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await corregirPedido(selectedPedido.id, corregirForm);
      notifications.show({
        color: 'teal',
        title: 'Datos Corregidos Exitosamente',
        message: 'Las modificaciones y la justificación fueron asentadas en la bitácora de auditoría.',
      });
      closeCorregirModal();
      fetchData();
    } catch (err: any) {
      notifications.show({
        color: 'red',
        title: 'Error al corregir datos',
        message: err.response?.data?.message || 'No se pudo aplicar la corrección.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCancelModal = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setMotivoCancelacion('');
    openCancelModal();
  };

  const handleConfirmCancel = async () => {
    if (!selectedPedido) return;
    if (!motivoCancelacion.trim()) {
      setErrorMsg('Debe ingresar un motivo para cancelar el pedido.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.post(`/pedidos/${selectedPedido.id}/cancelar`, {
        motivoCancelacion: motivoCancelacion.trim(),
      });
      setSuccessMsg('Pedido cancelado con éxito.');
      closeCancelModal();
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al cancelar el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeliverModal = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setFechaEntrega(getFechaHoyBolivia());
    setDeliveryDateError(null);
    openDeliverModal();
  };

  const handleConfirmDelivery = async () => {
    if (!selectedPedido) return;

    const fechaSolStr = selectedPedido.fechaSolicitud.slice(0, 10);
    if (!fechaEntrega) {
      setDeliveryDateError('Debe ingresar la fecha efectiva de entrega.');
      return;
    }
    if (fechaEntrega < fechaSolStr) {
      setDeliveryDateError(
        `La fecha de entrega (${formatDateToBO(fechaEntrega)}) no puede ser anterior a la fecha de solicitud (${formatDateToBO(fechaSolStr)}).`,
      );
      return;
    }

    setIsSubmitting(true);
    setDeliveryDateError(null);
    setErrorMsg(null);

    try {
      const res = await api.post(`/pedidos/${selectedPedido.id}/entregar`, {
        fechaEntrega,
      });
      closeDeliverModal();
      setDeliveredValeInfo({
        pedidoId: selectedPedido.id,
        numeroVale: res.data.numeroVale,
      });
      openSuccessDeliverModal();
      fetchData();
    } catch (err: any) {
      const backendMsg = err.response?.data?.message || 'Error al registrar la entrega de fondos.';
      if (err.response?.status === 409) {
        // En reintento o concurrencia, consultar el estado actual del pedido para recuperar su vale emitido
        try {
          const checkRes = await api.get<Pedido>(`/pedidos/${selectedPedido.id}`);
          if (checkRes.data?.anticipo) {
            closeDeliverModal();
            setDeliveredValeInfo({
              pedidoId: checkRes.data.id,
              numeroVale: checkRes.data.anticipo.numeroVale,
            });
            setSuccessMsg(
              `La entrega de este pedido ya se encontraba registrada previamente (${checkRes.data.anticipo.numeroVale}). Se ha recuperado el vale emitido para su reimpresión.`,
            );
            openSuccessDeliverModal();
            fetchData();
            return;
          }
        } catch (_) {
          // Si falla la consulta, continuar mostrando el mensaje de conflicto normal
        }
      }

      // Conservar abierto el formulario y mostrar el mensaje junto al campo si es de fecha
      if (backendMsg.toLowerCase().includes('fecha')) {
        setDeliveryDateError(backendMsg);
      } else {
        setErrorMsg(backendMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async (pedidoId: string, numeroVale?: string) => {
    try {
      const filename = numeroVale ? `${numeroVale}.pdf` : `vale-001-${pedidoId}.pdf`;
      await downloadValePdf(pedidoId, filename);
    } catch (err: any) {
      setErrorMsg('Error al descargar el archivo PDF del Formulario 001.');
    }
  };

  const handlePrintPdf = async (pedidoId: string) => {
    try {
      await openValePdfInNewTab(pedidoId);
    } catch (err: any) {
      setErrorMsg('Error al abrir la vista de impresión del Formulario 001.');
    }
  };

  // Mapa de presupuesto por partida para mostrar saldo disponible en el selector
  const partidaPresupuestoMap = useMemo(() => {
    const map = new Map<string, { disponible: string; asignado: string; comprometido: string }>();
    if (dashboardData?.presupuestoPorPartida) {
      dashboardData.presupuestoPorPartida.forEach((p) => {
        map.set(p.partidaId, {
          disponible: p.disponible || p.montoAsignado,
          asignado: p.montoAsignado,
          comprometido: p.comprometido || '0.00',
        });
      });
    }
    return map;
  }, [dashboardData]);

  const unitSelectOptions = accessibleUnits.map((u) => ({
    value: u.id,
    label: `${u.codigo} - ${u.nombre}`,
  }));

  const partidaSelectOptions = partidasHabilitadas.map((p) => {
    const pres = partidaPresupuestoMap.get(p.partidaId);
    const labelDispo = pres ? `(Disp: Bs ${pres.disponible})` : '(Sin pres.)';
    return {
      value: p.partidaId,
      label: `${p.codigo} - ${p.descripcion} ${labelDispo}`,
    };
  });

  return (
    <Stack gap="lg" p="md">
      {/* Encabezado y Selector de Unidad */}
      <Paper p="md" shadow="xs" radius="md" style={{ borderLeft: '4px solid #007B6D' }}>
        <Group justify="space-between" wrap="wrap">
          <Box>
            <Title order={2} c="#007B6D">
              Pedidos y Anticipos de Caja Chica
            </Title>
            <Text size="sm" c="dimmed">
              Registro de solicitudes autorizadas, entrega de fondos con Formulario 001 y control de rendición
            </Text>
          </Box>

          <Group>
            {unitSelectOptions.length > 1 && (
              <Select
                leftSection={<IconBuildingHospital size={16} color="#007B6D" />}
                placeholder="Seleccione Unidad"
                data={unitSelectOptions}
                value={activeUnitId}
                onChange={(val) => setActiveUnitId(val)}
                size="sm"
                w={280}
              />
            )}
            <Button
              color="cpsTeal"
              leftSection={<IconPlus size={18} />}
              onClick={handleOpenCreateModal}
              disabled={!caja || caja.estado !== 'ABIERTA'}
            >
              Nuevo Pedido
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Alertas informativas */}
      {errorMsg && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" withCloseButton onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}
      {successMsg && (
        <Alert icon={<IconCheck size={16} />} title="Éxito" color="teal" withCloseButton onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Tarjetas de Saldos y Límites de la Caja Activa */}
      {dashboardData && (
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="xs" p="md" radius="md" withBorder style={{ borderTop: '3px solid #007B6D' }}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700}>
                  EFECTIVO DISPONIBLE
                </Text>
                <IconCash size={20} color="#007B6D" />
              </Group>
              <Text size="xl" fw={800} c="#005d52" mt={4}>
                Bs. {dashboardData.efectivoDisponible}
              </Text>
              <Text size="xs" c="dimmed">
                De Bs. {dashboardData.montoAutorizado} fondo inicial
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="xs" p="md" radius="md" withBorder style={{ borderTop: '3px solid #f59e0b' }}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700}>
                  ANTICIPOS PENDIENTES
                </Text>
                <IconClock size={20} color="#f59e0b" />
              </Group>
              <Text size="xl" fw={800} c="#b45309" mt={4}>
                Bs. {dashboardData.totalAnticiposPendientes || '0.00'}
              </Text>
              <Text size="xs" c="dimmed">
                {dashboardData.cantidadAnticiposPendientes || 0} vales por rendir
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="xs" p="md" radius="md" withBorder style={{ borderTop: '3px solid #3b82f6' }}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700}>
                  PRESUPUESTO DISPONIBLE
                </Text>
                <IconCoin size={20} color="#3b82f6" />
              </Group>
              <Text size="xl" fw={800} c="#1d4ed8" mt={4}>
                Bs. {dashboardData.totalDisponiblePresupuesto || '0.00'}
              </Text>
              <Text size="xs" c="dimmed">
                Comprometido: Bs. {dashboardData.totalComprometido || '0.00'}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="xs" p="md" radius="md" withBorder style={{ borderTop: '3px solid #6366f1' }}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700}>
                  LÍMITE POR VALE (10% POA)
                </Text>
                <IconShieldCheck size={20} color="#6366f1" />
              </Group>
              <Text size="xl" fw={800} c="#4338ca" mt={4}>
                Bs. {dashboardData.limitePorComprobante}
              </Text>
              <Text size="xs" c="dimmed">
                10% Presupuesto POA (Reglamento CPS)
              </Text>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Barra de Filtros */}
      <Paper p="sm" shadow="xs" radius="md" withBorder>
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm" wrap="wrap">
            <Select
              label="Estado"
              data={[
                { value: 'TODOS', label: 'Todos los estados' },
                { value: 'BORRADOR', label: 'Borradores' },
                { value: 'ENTREGADO', label: 'Entregados (Pend. Rendición)' },
                { value: 'CANCELADO', label: 'Cancelados' },
              ]}
              value={filtroEstado}
              onChange={(val) => setFiltroEstado(val || 'TODOS')}
              size="xs"
              w={210}
            />
            <DateInputBO
              label="Fecha Desde"
              placeholder="DD/MM/AAAA"
              size="xs"
              value={filtroFechaDesde}
              onChange={setFiltroFechaDesde}
              clearable
              w={145}
            />
            <DateInputBO
              label="Fecha Hasta"
              placeholder="DD/MM/AAAA"
              size="xs"
              value={filtroFechaHasta}
              onChange={setFiltroFechaHasta}
              clearable
              w={145}
            />
            {(filtroEstado !== 'TODOS' || filtroFechaDesde || filtroFechaHasta) && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                mt={20}
                onClick={() => {
                  setFiltroEstado('TODOS');
                  setFiltroFechaDesde('');
                  setFiltroFechaHasta('');
                }}
              >
                Limpiar Filtros
              </Button>
            )}
          </Group>

          <Text size="xs" c="dimmed">
            {pedidos.length} {pedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
          </Text>
        </Group>
      </Paper>

      {/* Tabla de Pedidos */}
      <Paper p="md" shadow="xs" radius="md" withBorder>
        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader color="cpsTeal" />
            <Text size="sm" c="dimmed">
              Cargando pedidos...
            </Text>
          </Group>
        ) : pedidos.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <IconReceipt size={40} color="#cbd5e1" />
            <Text fw={600} c="dimmed">
              No se encontraron pedidos de caja chica registrados
            </Text>
            {caja?.estado === 'ABIERTA' && (
              <Button
                variant="light"
                color="cpsTeal"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={handleOpenCreateModal}
              >
                Registrar Primer Pedido
              </Button>
            )}
          </Stack>
        ) : (
          <Table striped highlightOnHover verticalSpacing="sm" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ref. / Vale</Table.Th>
                <Table.Th>Fecha Sol.</Table.Th>
                <Table.Th>Solicitante / Área</Table.Th>
                <Table.Th>Receptor del Anticipo</Table.Th>
                <Table.Th>Partida</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Monto (Bs.)</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Estado</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Plazo Rendición</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pedidos.map((p) => {
                const esEntregado = p.estado === 'ENTREGADO';
                const esBorrador = p.estado === 'BORRADOR';
                const esCancelado = p.estado === 'CANCELADO';

                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Text fw={700} size="sm">
                        {p.numeroPedido}
                      </Text>
                      {p.anticipo?.numeroVale && (
                        <Text size="xs" c="teal" fw={600}>
                          {p.anticipo.numeroVale}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td fw={500}>{formatDateToBO(p.fechaSolicitud)}</Table.Td>
                    <Table.Td>
                      <Text fw={600} size="xs">
                        {p.solicitanteNombres} {p.solicitanteApellidos}
                      </Text>
                      <Text size="xs" c="dimmed">
                        CI: {p.solicitanteCi} &bull; {p.solicitanteArea}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500} size="xs">
                        {p.receptorNombres} {p.receptorApellidos}
                      </Text>
                      <Text size="xs" c="dimmed">
                        CI: {p.receptorCi}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} size="xs">
                        {p.partida?.codigo}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {p.partida?.descripcion}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700} c="#007B6D">
                        {p.monto}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {esBorrador && (
                        <Badge color="yellow" variant="light" size="sm">
                          BORRADOR
                        </Badge>
                      )}
                      {esEntregado && (
                        <Badge color="teal" variant="filled" size="sm">
                          PEND. RENDICIÓN
                        </Badge>
                      )}
                      {esCancelado && (
                        <Badge color="red" variant="light" size="sm">
                          CANCELADO
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {esEntregado && p.tiempoRendicion ? (
                        <Tooltip
                          label="Plazo reglamentario referencial: 48 hrs (cómputo hábil vs. corrido pendiente de dictamen CPS)"
                          multiline
                          w={240}
                        >
                          <Badge
                            color={p.tiempoRendicion.horasTranscurridas > 48 ? 'orange' : 'gray'}
                            variant="light"
                            size="xs"
                            leftSection={<IconClock size={10} />}
                          >
                            {p.tiempoRendicion.horasTranscurridas}h transcurridas
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Text size="xs" c="dimmed">
                          &mdash;
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap={4} justify="center">
                        <Tooltip label="Ver detalle completo">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            size="sm"
                            onClick={() => {
                              setSelectedPedido(p);
                              openDetailModal();
                            }}
                          >
                            <IconFileText size={16} />
                          </ActionIcon>
                        </Tooltip>

                        {/* Acciones para BORRADOR */}
                        {esBorrador && (
                          <>
                            <Tooltip label="Registrar entrega y generar Vale 001">
                              <ActionIcon
                                variant="filled"
                                color="cpsTeal"
                                size="sm"
                                onClick={() => handleOpenDeliverModal(p)}
                              >
                                <IconReceipt size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Editar borrador">
                              <ActionIcon
                                variant="subtle"
                                color="yellow"
                                size="sm"
                                onClick={() => handleOpenEditModal(p)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Cancelar borrador">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => handleOpenCancelModal(p)}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}

                        {/* Acciones para ENTREGADO */}
                        {esEntregado && (
                          <>
                            <Tooltip label="Descargar Formulario 001 (PDF)">
                              <ActionIcon
                                variant="light"
                                color="cpsTeal"
                                size="sm"
                                onClick={() => handleDownloadPdf(p.id, p.anticipo?.numeroVale)}
                              >
                                <IconDownload size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Reimprimir / Ver Vale 001">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                size="sm"
                                onClick={() => handlePrintPdf(p.id)}
                              >
                                <IconPrinter size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Corregir datos con justificación formal">
                              <ActionIcon
                                variant="subtle"
                                color="orange"
                                size="sm"
                                onClick={() => handleOpenCorregirModal(p)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Modal Nuevo / Editar Borrador */}
      <Modal
        opened={formModalOpened}
        onClose={closeFormModal}
        title={
          <Group gap="xs">
            <IconReceipt color="#007B6D" size={20} />
            <Text fw={700} c="#007B6D">
              {editingPedidoId ? 'Modificar Pedido (Borrador)' : 'Nuevo Pedido de Caja Chica'}
            </Text>
          </Group>
        }
        size="lg"
      >
        <form onSubmit={handleSubmitForm}>
          <Stack gap="sm">
            {formErrors.length > 0 && (
              <Alert
                color="red"
                title="Corrija los siguientes errores para guardar el pedido:"
                icon={<IconAlertCircle size={16} />}
                withCloseButton
                onClose={() => setFormErrors([])}
              >
                <Stack gap={4}>
                  {formErrors.map((msg, idx) => (
                    <Text key={idx} size="xs" fw={500}>
                      • {msg}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            {editingPedidoId && (
              <Paper p="xs" radius="md" style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Unidad Institucional: <strong>{activeUnit?.codigo} - {activeUnit?.nombre}</strong>
                  </Text>
                  <Text size="xs" c="dimmed">
                    Gestión: <strong>{currentGestion}</strong> (Inmutable)
                  </Text>
                </Group>
              </Paper>
            )}
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Referencia del Pedido Autorizado *"
                  placeholder="Ej. PED-045/2026 o Nota DAF 124"
                  value={formData.numeroPedido}
                  onChange={(e) => setFormData({ ...formData, numeroPedido: e.currentTarget.value })}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <DateInputBO
                  label="Fecha de Solicitud (DD/MM/AAAA) *"
                  description="Formato boliviano"
                  placeholder="DD/MM/AAAA"
                  value={formData.fechaSolicitud}
                  onChange={(val) => setFormData({ ...formData, fechaSolicitud: val })}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 3 }}>
                <TextInput
                  label="Lugar *"
                  value={formData.lugar}
                  onChange={(e) => setFormData({ ...formData, lugar: e.currentTarget.value })}
                  required
                />
              </Grid.Col>
            </Grid>

            <Divider label="1. Datos del Solicitante" labelPosition="left" />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Nombres Solicitante *"
                  value={formData.solicitanteNombres}
                  onChange={(e) => handleSolicitanteChange('solicitanteNombres', e.currentTarget.value)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Apellidos Solicitante *"
                  value={formData.solicitanteApellidos}
                  onChange={(e) => handleSolicitanteChange('solicitanteApellidos', e.currentTarget.value)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="CI Solicitante *"
                  value={formData.solicitanteCi}
                  onChange={(e) => handleSolicitanteChange('solicitanteCi', e.currentTarget.value)}
                  required
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput
                  label="Área o Servicio Requirente *"
                  placeholder="Ej. Servicio de Odontología, Consulta Externa"
                  value={formData.solicitanteArea}
                  onChange={(e) => setFormData({ ...formData, solicitanteArea: e.currentTarget.value })}
                  required
                />
              </Grid.Col>
            </Grid>

            <Divider label="2. Persona que Recibe el Anticipo" labelPosition="left" />
            <Switch
              label="El receptor del anticipo es la misma persona solicitante"
              checked={formData.mismoReceptor}
              onChange={(e) => handleMismoReceptorToggle(e.currentTarget.checked)}
              color="cpsTeal"
              size="sm"
            />
            {!formData.mismoReceptor && (
              <Grid>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    label="Nombres Receptor *"
                    value={formData.receptorNombres}
                    onChange={(e) => setFormData({ ...formData, receptorNombres: e.currentTarget.value })}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    label="Apellidos Receptor *"
                    value={formData.receptorApellidos}
                    onChange={(e) => setFormData({ ...formData, receptorApellidos: e.currentTarget.value })}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <TextInput
                    label="CI Receptor *"
                    value={formData.receptorCi}
                    onChange={(e) => setFormData({ ...formData, receptorCi: e.currentTarget.value })}
                    required
                  />
                </Grid.Col>
              </Grid>
            )}

            <Divider label="3. Partida e Importe" labelPosition="left" />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <Select
                  label="Partida Presupuestaria Habilitada *"
                  data={partidaSelectOptions}
                  value={formData.partidaId}
                  onChange={(val) => setFormData({ ...formData, partidaId: val || '' })}
                  required
                  searchable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Monto Solicitado (Bs.) *"
                  placeholder="0.00"
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: e.currentTarget.value })}
                  required
                />
              </Grid.Col>
            </Grid>

            <Divider label="4. Detalle y Motivo" labelPosition="left" />
            <Textarea
              label="Descripción del Bien o Servicio Menor *"
              placeholder="Detalle los artículos o servicios solicitados..."
              rows={2}
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.currentTarget.value })}
              required
            />
            <Textarea
              label="Destino / Motivo de la Adquisición *"
              placeholder="Justificación de la urgencia o destino de los materiales..."
              rows={2}
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.currentTarget.value })}
              required
            />

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Referencia Formulario REP-MAT (Opcional)"
                  placeholder="Ej. REP-MAT-089/2026"
                  value={formData.referenciaRepMat}
                  onChange={(e) => setFormData({ ...formData, referenciaRepMat: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Observaciones (Opcional)"
                  placeholder="Notas adicionales..."
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.currentTarget.value })}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeFormModal}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                {editingPedidoId ? 'Guardar Cambios' : 'Registrar Borrador'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal Acción Principal: Registrar Entrega y Generar Vale 001 */}
      <Modal
        opened={deliverModalOpened}
        onClose={closeDeliverModal}
        title={
          <Group gap="xs">
            <IconReceipt color="#007B6D" size={22} />
            <Text fw={700} c="#007B6D">
              Registrar Entrega y Generar Vale 001
            </Text>
          </Group>
        }
        size="md"
      >
        {selectedPedido && (
          <Stack gap="md">
            <Alert icon={<IconInfoCircle size={18} />} color="blue" title="Verificación antes de entregar efectivo">
              Revise cuidadosamente el importe y los datos del receptor. Esta acción registrará el egreso contable de caja
              y generará el vale oficial inmutable.
            </Alert>

            {/* Recuadro Destacado con Importe y Receptor */}
            <Paper p="md" radius="md" style={{ backgroundColor: '#f0fdf9', border: '2px solid #007B6D' }}>
              <Stack gap="xs">
                <Group justify="space-between" align="baseline">
                  <Text size="sm" c="dimmed" fw={700}>
                    IMPORTE A ENTREGAR:
                  </Text>
                  <Text size="xl" fw={900} c="#005d52">
                    Bs. {selectedPedido.monto}
                  </Text>
                </Group>
                <Divider />
                <Box>
                  <Text size="xs" c="dimmed" fw={700}>
                    PERSONA QUE RECIBE EL DINERO:
                  </Text>
                  <Text size="md" fw={700} c="#1e293b">
                    {selectedPedido.receptorNombres} {selectedPedido.receptorApellidos}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Cédula de Identidad: <strong>{selectedPedido.receptorCi}</strong>
                  </Text>
                </Box>
                <Divider />
                <Box>
                  <Text size="xs" c="dimmed" fw={700}>
                    PARTIDA PRESUPUESTARIA AFECTADA:
                  </Text>
                  <Text size="sm" fw={600} c="#334155">
                    [{selectedPedido.partida?.codigo}] {selectedPedido.partida?.descripcion}
                  </Text>
                </Box>
              </Stack>
            </Paper>

            {/* Control y Verificación de Fechas (Normativa CPS) */}
            <Paper p="sm" radius="md" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
              <Stack gap="xs">
                <Text size="xs" fw={700} c="#007B6D" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Control de Fechas (Formato Oficial Bolivia: DD/MM/AAAA)
                </Text>
                <Grid align="flex-start">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Box p="xs" style={{ backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <Text size="xs" c="dimmed" fw={600}>
                        Fecha de Solicitud del Pedido:
                      </Text>
                      <Text size="md" fw={700} c="#1e293b">
                        {formatDateToBO(selectedPedido.fechaSolicitud)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Gestión fiscal: {selectedPedido.gestion}
                      </Text>
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInputBO
                      label="Fecha Efectiva de Entrega *"
                      description="Debe ser igual o posterior a la solicitud"
                      placeholder="DD/MM/AAAA"
                      value={fechaEntrega}
                      onChange={(val) => {
                        setFechaEntrega(val);
                        const solStr = selectedPedido.fechaSolicitud.slice(0, 10);
                        if (val && val < solStr) {
                          setDeliveryDateError(
                            `La fecha de entrega (${formatDateToBO(val)}) no puede ser anterior a la fecha de solicitud (${formatDateToBO(solStr)}).`,
                          );
                        } else {
                          setDeliveryDateError(null);
                        }
                      }}
                      error={deliveryDateError}
                      required
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>

            {/* Verificaciones Financieras en Vivo */}
            <Box p="sm" style={{ backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Text size="xs" fw={700} c="dimmed" mb={4}>
                ESTADO DE DISPONIBILIDAD:
              </Text>
              <Group justify="space-between" mb={2}>
                <Text size="xs">Efectivo en caja chica:</Text>
                <Text size="xs" fw={700}>
                  Bs. {dashboardData?.efectivoDisponible || '0.00'}
                </Text>
              </Group>
              <Group justify="space-between" mb={2}>
                <Text size="xs">Presupuesto disp. en partida:</Text>
                <Text size="xs" fw={700}>
                  Bs. {partidaPresupuestoMap.get(selectedPedido.partidaId)?.disponible || '0.00'}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs">Límite por vale (10% POA):</Text>
                <Text size="xs" fw={700}>
                  Bs. {dashboardData?.limitePorComprobante || '0.00'}
                </Text>
              </Group>
            </Box>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeDeliverModal}>
                Cancelar
              </Button>
              <Button
                color="cpsTeal"
                leftSection={<IconCheck size={18} />}
                onClick={handleConfirmDelivery}
                loading={isSubmitting}
              >
                Confirmar Entrega y Generar Vale
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal Éxito de Entrega con descarga de PDF */}
      <Modal
        opened={successDeliverModalOpened}
        onClose={closeSuccessDeliverModal}
        title={
          <Group gap="xs">
            <IconCheck color="#007B6D" size={22} />
            <Text fw={700} c="#007B6D">
              Entrega Registrada Exitosamente
            </Text>
          </Group>
        }
        size="md"
      >
        {deliveredValeInfo && (
          <Stack gap="md" align="center" p="sm">
            <IconReceipt size={48} color="#007B6D" />
            <Text size="sm" ta="center">
              Se registró el egreso de caja y se generó el número de control:
            </Text>
            <Badge size="xl" color="cpsTeal" variant="filled">
              {deliveredValeInfo.numeroVale}
            </Badge>
            <Text size="xs" c="dimmed" ta="center">
              El vale provisional Formulario 001 está habilitado para descarga o impresión inmediata.
            </Text>

            <Group justify="center" mt="md">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconPrinter size={16} />}
                onClick={() => handlePrintPdf(deliveredValeInfo.pedidoId)}
              >
                Abrir / Imprimir Vale
              </Button>
              <Button
                color="cpsTeal"
                leftSection={<IconDownload size={16} />}
                onClick={() => handleDownloadPdf(deliveredValeInfo.pedidoId, deliveredValeInfo.numeroVale)}
              >
                Descargar PDF
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal Cancelar Borrador */}
      <Modal
        opened={cancelModalOpened}
        onClose={closeCancelModal}
        title={
          <Group gap="xs">
            <IconX color="#ef4444" size={20} />
            <Text fw={700} c="#ef4444">
              Cancelar Pedido en Borrador
            </Text>
          </Group>
        }
      >
        {selectedPedido && (
          <Stack gap="sm">
            <Text size="sm">
              ¿Está seguro de cancelar el pedido <strong>{selectedPedido.numeroPedido}</strong> por un monto de{' '}
              <strong>Bs. {selectedPedido.monto}</strong>?
            </Text>
            <Textarea
              label="Motivo Fundamentado de la Cancelación *"
              placeholder="Indique la justificación para anular este borrador..."
              rows={3}
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.currentTarget.value)}
              required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCancelModal}>
                Volver
              </Button>
              <Button color="red" onClick={handleConfirmCancel} loading={isSubmitting}>
                Confirmar Cancelación
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal Detalle Completo */}
      <Modal
        opened={detailModalOpened}
        onClose={closeDetailModal}
        title={
          <Group gap="xs">
            <IconFileText color="#007B6D" size={20} />
            <Text fw={700} c="#007B6D">
              Detalle del Pedido de Caja Chica
            </Text>
          </Group>
        }
        size="lg"
      >
        {selectedPedido && (
          <Stack gap="md">
            <Paper p="sm" radius="md" withBorder style={{ backgroundColor: '#f8fafc' }}>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    REFERENCIA PEDIDO:
                  </Text>
                  <Text size="sm" fw={700}>
                    {selectedPedido.numeroPedido}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    ESTADO ACTUAL:
                  </Text>
                  <Badge
                    color={
                      selectedPedido.estado === 'ENTREGADO'
                        ? 'teal'
                        : selectedPedido.estado === 'BORRADOR'
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {selectedPedido.estado}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    FECHA SOLICITUD:
                  </Text>
                  <Text size="sm" fw={600}>{formatDateToBO(selectedPedido.fechaSolicitud)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">
                    LUGAR:
                  </Text>
                  <Text size="sm">{selectedPedido.lugar}</Text>
                </Grid.Col>
              </Grid>
            </Paper>

            <Divider label="Solicitante y Receptor" labelPosition="left" />
            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  SOLICITANTE:
                </Text>
                <Text size="sm" fw={600}>
                  {selectedPedido.solicitanteNombres} {selectedPedido.solicitanteApellidos}
                </Text>
                <Text size="xs" c="dimmed">
                  CI: {selectedPedido.solicitanteCi}
                </Text>
                <Text size="xs" c="dimmed">
                  Área: {selectedPedido.solicitanteArea}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  RECEPTOR DEL ANTICIPO:
                </Text>
                <Text size="sm" fw={600}>
                  {selectedPedido.receptorNombres} {selectedPedido.receptorApellidos}
                </Text>
                <Text size="xs" c="dimmed">
                  CI: {selectedPedido.receptorCi}
                </Text>
              </Grid.Col>
            </Grid>

            <Divider label="Partida e Importe" labelPosition="left" />
            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  PARTIDA PRESUPUESTARIA:
                </Text>
                <Text size="sm" fw={600}>
                  [{selectedPedido.partida?.codigo}] {selectedPedido.partida?.descripcion}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">
                  MONTO:
                </Text>
                <Text size="md" fw={800} c="#007B6D">
                  Bs. {selectedPedido.monto}
                </Text>
              </Grid.Col>
            </Grid>

            <Divider label="Detalle del Gasto" labelPosition="left" />
            <Box>
              <Text size="xs" c="dimmed">
                DESCRIPCIÓN DEL BIEN O SERVICIO:
              </Text>
              <Text size="sm">{selectedPedido.descripcion}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">
                DESTINO / MOTIVO:
              </Text>
              <Text size="sm">{selectedPedido.motivo}</Text>
            </Box>
            {selectedPedido.referenciaRepMat && (
              <Box>
                <Text size="xs" c="dimmed">
                  REFERENCIA REP-MAT EXTERNO:
                </Text>
                <Text size="sm">{selectedPedido.referenciaRepMat}</Text>
              </Box>
            )}
            {selectedPedido.observaciones && (
              <Box>
                <Text size="xs" c="dimmed">
                  OBSERVACIONES:
                </Text>
                <Text size="sm">{selectedPedido.observaciones}</Text>
              </Box>
            )}

            {/* Datos del Anticipo si ya fue entregado */}
            {selectedPedido.anticipo && (
              <>
                <Divider label="Constancia de Anticipo (Vale 001)" labelPosition="left" color="teal" />
                <Paper p="sm" radius="md" style={{ backgroundColor: '#f0fdf9', border: '1px solid #007B6D' }}>
                  <Grid>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        NÚMERO DE CONTROL VALE:
                      </Text>
                      <Text size="sm" fw={700} c="#007B6D">
                        {selectedPedido.anticipo.numeroVale}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        FECHA Y HORA DE ENTREGA:
                      </Text>
                      <Text size="sm" fw={600}>
                        {formatDateTimeToBO(selectedPedido.anticipo.fechaEntrega)}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        ENTREGADO POR:
                      </Text>
                      <Text size="sm">
                        {selectedPedido.anticipo.entregadoPor?.nombreCompleto ||
                          selectedPedido.anticipo.entregadoPor?.username}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">
                        PLAZO REFERENCIAL:
                      </Text>
                      <Text size="sm">48 horas reglamentarias</Text>
                    </Grid.Col>
                  </Grid>

                  <Group justify="flex-end" mt="sm">
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={<IconPrinter size={14} />}
                      onClick={() => handlePrintPdf(selectedPedido.id)}
                    >
                      Imprimir Vale 001
                    </Button>
                    <Button
                      size="xs"
                      color="cpsTeal"
                      leftSection={<IconDownload size={14} />}
                      onClick={() =>
                        handleDownloadPdf(selectedPedido.id, selectedPedido.anticipo?.numeroVale)
                      }
                    >
                      Descargar PDF
                    </Button>
                  </Group>
                </Paper>
              </>
            )}

            {selectedPedido.estado === 'CANCELADO' && selectedPedido.motivoCancelacion && (
              <Alert icon={<IconX size={16} />} color="red" title="Motivo de Cancelación">
                {selectedPedido.motivoCancelacion}
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeDetailModal}>
                Cerrar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal Corregir Datos de Pedido con Justificación */}
      <Modal
        opened={corregirModalOpened}
        onClose={closeCorregirModal}
        title={
          <Group gap="xs">
            <IconEdit color="#ea580c" size={20} />
            <Text fw={700} c="#1e293b">
              Corregir Datos del Pedido [{selectedPedido?.numeroPedido}]
            </Text>
          </Group>
        }
        size="lg"
      >
        <form onSubmit={handleConfirmCorregir}>
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="blue" title="Fase de Pruebas: Edición de Fechas y Montos Habilitada">
              Conforme a la fase de pruebas, se habilita la rectificación de montos y fechas de pedidos y anticipos para Administradores y Encargados. Toda modificación actualizará el movimiento de efectivo y el vale correspondiente, registrándose en la bitácora de auditoría.
            </Alert>

            <Textarea
              label="Motivo o Justificación Formal de la Corrección *"
              placeholder="Indique la causa del error, memorando de respaldo o justificativo formal del cambio..."
              minRows={2}
              required
              value={corregirForm.justificacion}
              onChange={(e) => setCorregirForm({ ...corregirForm, justificacion: e.currentTarget.value })}
            />

            <Divider label="1. Partida, Importe y Fechas (Fase de Pruebas)" labelPosition="left" />
            <Grid>
              <Grid.Col span={12}>
                <Select
                  label="Partida Presupuestaria *"
                  required
                  searchable
                  data={partidaSelectOptions}
                  value={corregirForm.partidaId}
                  onChange={(val) => setCorregirForm({ ...corregirForm, partidaId: val || '' })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: selectedPedido?.anticipo ? 4 : 6 }}>
                <TextInput
                  label="Monto del Pedido / Anticipo (Bs.) *"
                  required
                  placeholder="0.00"
                  value={corregirForm.monto}
                  onChange={(e) => setCorregirForm({ ...corregirForm, monto: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: selectedPedido?.anticipo ? 4 : 6 }}>
                <DateInputBO
                  label="Fecha Solicitud del Pedido *"
                  required
                  value={corregirForm.fechaSolicitud}
                  onChange={(val) => setCorregirForm({ ...corregirForm, fechaSolicitud: val })}
                />
              </Grid.Col>
              {selectedPedido?.anticipo && (
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <DateInputBO
                    label="Fecha Entrega de Anticipo *"
                    required
                    value={corregirForm.fechaEntrega}
                    onChange={(val) => setCorregirForm({ ...corregirForm, fechaEntrega: val })}
                  />
                </Grid.Col>
              )}
            </Grid>

            <Divider label="2. Datos del Solicitante" labelPosition="left" />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Nombres Solicitante *"
                  required
                  value={corregirForm.solicitanteNombres}
                  onChange={(e) => setCorregirForm({ ...corregirForm, solicitanteNombres: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Apellidos Solicitante *"
                  required
                  value={corregirForm.solicitanteApellidos}
                  onChange={(e) => setCorregirForm({ ...corregirForm, solicitanteApellidos: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="CI Solicitante *"
                  required
                  value={corregirForm.solicitanteCi}
                  onChange={(e) => setCorregirForm({ ...corregirForm, solicitanteCi: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Área o Servicio Requirente *"
                  required
                  value={corregirForm.solicitanteArea}
                  onChange={(e) => setCorregirForm({ ...corregirForm, solicitanteArea: e.currentTarget.value })}
                />
              </Grid.Col>
            </Grid>

            <Divider label="3. Datos del Receptor del Efectivo" labelPosition="left" />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Nombres Receptor *"
                  required
                  value={corregirForm.receptorNombres}
                  onChange={(e) => setCorregirForm({ ...corregirForm, receptorNombres: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="Apellidos Receptor *"
                  required
                  value={corregirForm.receptorApellidos}
                  onChange={(e) => setCorregirForm({ ...corregirForm, receptorApellidos: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput
                  label="CI Receptor *"
                  required
                  value={corregirForm.receptorCi}
                  onChange={(e) => setCorregirForm({ ...corregirForm, receptorCi: e.currentTarget.value })}
                />
              </Grid.Col>
            </Grid>

            <Divider label="4. Concepto y Destino" labelPosition="left" />
            <Textarea
              label="Descripción del Bien o Servicio *"
              required
              minRows={2}
              value={corregirForm.descripcion}
              onChange={(e) => setCorregirForm({ ...corregirForm, descripcion: e.currentTarget.value })}
            />
            <Textarea
              label="Destino o Justificación del Gasto *"
              required
              minRows={2}
              value={corregirForm.motivo}
              onChange={(e) => setCorregirForm({ ...corregirForm, motivo: e.currentTarget.value })}
            />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Referencia REP-MAT Externa"
                  value={corregirForm.referenciaRepMat}
                  onChange={(e) => setCorregirForm({ ...corregirForm, referenciaRepMat: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Lugar de Emisión"
                  value={corregirForm.lugar}
                  onChange={(e) => setCorregirForm({ ...corregirForm, lugar: e.currentTarget.value })}
                />
              </Grid.Col>
            </Grid>
            <TextInput
              label="Observaciones Adicionales"
              value={corregirForm.observaciones}
              onChange={(e) => setCorregirForm({ ...corregirForm, observaciones: e.currentTarget.value })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCorregirModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button color="orange" type="submit" loading={isSubmitting}>
                Guardar Corrección con Auditoría
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
