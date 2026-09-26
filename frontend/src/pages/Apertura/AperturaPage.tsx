import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  TextInput,
  Select,
  Button,
  Badge,
  Alert,
  Loader,
  Box,
  Modal,
  Table,
  Divider,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconAlertCircle,
  IconLockOpen,
  IconLock,
  IconFileText,
  IconAlertTriangle,
  IconBuilding,
  IconUserPlus,
  IconPlus,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CajaApertura, Responsable } from '../../types';

export const AperturaPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, activeUnit, user } = useAuth();
  const [apertura, setApertura] = useState<CajaApertura | null>(null);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user?.rol === 'ADMINISTRADOR';

  // Modal de confirmación sensible
  const [confirmModalOpened, { open: openConfirmModal, close: closeConfirmModal }] =
    useDisclosure(false);

  // Formulario
  const [formData, setFormData] = useState({
    responsableId: '',
    montoAutorizado: '10000.00',
    importeRecibido: '10000.00',
    fechaApertura: new Date().toISOString().split('T')[0],
    docAutorizacion: '',
    compIngreso: '',
  });

  const fetchData = async () => {
    if (!activeUnitId) {
      setApertura(null);
      setResponsables([]);
      return;
    }

    // Limpiar inmediatamente datos anteriores al cambiar de unidad
    setApertura(null);
    setResponsables([]);
    setIsLoading(true);

    try {
      const [aperturaRes, respRes] = await Promise.all([
        api.get<CajaApertura | null>(`/apertura?unidadId=${activeUnitId}&gestion=${currentGestion}`),
        api.get<{ items: Responsable[] }>(`/responsables?unidadId=${activeUnitId}&activo=true`),
      ]);

      setApertura(aperturaRes.data);
      setResponsables(respRes.data.items);

      if (aperturaRes.data) {
        setFormData({
          responsableId: aperturaRes.data.responsableId,
          montoAutorizado: aperturaRes.data.montoAutorizado,
          importeRecibido: aperturaRes.data.importeRecibido,
          fechaApertura: aperturaRes.data.fechaApertura.split('T')[0],
          docAutorizacion: aperturaRes.data.docAutorizacion,
          compIngreso: aperturaRes.data.compIngreso,
        });
      } else {
        // Formulario inicial para nueva apertura
        setFormData({
          responsableId: respRes.data.items[0]?.id || '',
          montoAutorizado: '10000.00',
          importeRecibido: '10000.00',
          fechaApertura: new Date().toISOString().split('T')[0],
          docAutorizacion: '',
          compIngreso: '',
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Error de carga',
        message: err.response?.data?.message || 'Error al obtener datos de apertura.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeUnitId, currentGestion]);

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnitId) {
      notifications.show({
        title: 'Unidad requerida',
        message: 'Debe seleccionar una unidad activa antes de registrar la apertura.',
        color: 'orange',
      });
      return;
    }

    if (!formData.responsableId) {
      notifications.show({
        title: 'Responsable requerido',
        message: 'Debe seleccionar un responsable de caja asignado a esta unidad.',
        color: 'orange',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (apertura && apertura.estado === 'BORRADOR') {
        const res = await api.patch(`/apertura/${apertura.id}`, formData);
        setApertura(res.data);
        notifications.show({
          title: 'Borrador Actualizado',
          message: 'Los datos del borrador de apertura se han guardado con éxito.',
          color: 'teal',
        });
      } else {
        const res = await api.post('/apertura', {
          ...formData,
          unidadId: activeUnitId,
          gestion: currentGestion,
        });
        setApertura(res.data);
        notifications.show({
          title: 'Nueva Apertura Registrada',
          message: 'Se ha creado el registro de apertura en estado BORRADOR. Puede revisarlo antes de confirmar.',
          color: 'teal',
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Error al guardar',
        message: err.response?.data?.message || 'No se pudo guardar la apertura.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmApertura = async () => {
    if (!apertura) return;
    setIsConfirming(true);
    try {
      const res = await api.post(`/apertura/${apertura.id}/confirmar`);
      setApertura(res.data.caja);
      closeConfirmModal();
      notifications.show({
        title: 'Apertura Confirmada Exitosamente',
        message: res.data.message || 'Caja aperturada. Se registró la entrada única de efectivo.',
        color: 'teal',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Error en Confirmación',
        message:
          err.response?.data?.message ||
          'Conflicto al confirmar la apertura. Verifique que no haya sido confirmada previamente.',
        color: 'red',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // Sin unidad seleccionada
  if (!activeUnitId) {
    return (
      <Paper p="xl" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size={56} radius="xl" color="gray" variant="light">
            <IconBuilding size={32} />
          </ThemeIcon>
          <Title order={3} c="#1e293b" ta="center">
            Sin unidad seleccionada
          </Title>
          <Text size="sm" c="dimmed" ta="center" maw={520}>
            Para aperturar o consultar el fondo de caja chica, seleccione una unidad institucional activa en el selector de la barra superior.
          </Text>
          {isAdmin && (
            <Button
              variant="outline"
              color="cpsTeal"
              onClick={() => navigate('/unidades')}
            >
              Gestionar Unidades Institucionales
            </Button>
          )}
        </Stack>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Box p="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Stack align="center">
          <Loader color="cpsTeal" size="lg" />
          <Text size="sm" c="dimmed">
            Consultando estado de apertura de la unidad...
          </Text>
        </Stack>
      </Box>
    );
  }

  const isConfirmed = apertura?.estado === 'ABIERTA';
  const isBorrador = apertura?.estado === 'BORRADOR';
  const hasNoApertura = !apertura;

  return (
    <Stack gap="lg">
      {/* Encabezado con estado */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap">
          <Box>
            <Title order={3} c="#1e293b">
              {hasNoApertura
                ? 'Nueva Apertura de Caja Chica'
                : isBorrador
                ? 'Apertura de Caja Chica (Borrador)'
                : 'Apertura de Caja Chica Confirmada'}
            </Title>
            <Text size="xs" c="dimmed">
              Gestión Fiscal: {currentGestion} | Unidad: [{activeUnit?.codigo}] {activeUnit?.nombre}
            </Text>
          </Box>
          <Badge
            size="lg"
            variant="filled"
            color={isConfirmed ? 'teal' : isBorrador ? 'yellow' : 'gray'}
          >
            ESTADO: {apertura?.estado || 'SIN APERTURA REGISTRADA'}
          </Badge>
        </Group>
      </Paper>

      {/* Alerta de Fondo Confirmado */}
      {isConfirmed && (
        <Alert
          icon={<IconCheck size={18} />}
          title="Fondo de Caja Chica Confirmado y Operativo"
          color="teal"
          radius="md"
        >
          <Text size="sm">
            La caja chica para esta unidad y gestión fue confirmada formalmente. Se ha emitido la entrada única de
            efectivo en el libro diario institucional.
          </Text>
          <Text size="xs" mt={4} fw={500}>
            Por normativa de control interno institucional de la CPS, el importe de fondo confirmado no admite modificaciones
            directas de saldo. Cualquier reposición, descargo o ajuste requerirá operaciones formales posteriores.
          </Text>
        </Alert>
      )}

      {/* Alerta de Borrador Pendiente */}
      {isBorrador && (
        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Apertura Guardada en Estado Borrador"
          color="yellow"
          radius="md"
        >
          <Text size="sm">
            Los datos de la apertura se encuentran guardados temporalmente. Puede modificarlos si es necesario.
            Para que la caja chica sea operativa y se registre el ingreso de efectivo en el libro diario, debe
            proceder con la confirmación definitiva mediante el botón correspondiente.
          </Text>
        </Alert>
      )}

      {/* Alerta si no hay responsables en la unidad */}
      {responsables.length === 0 && !isConfirmed && (
        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Requisito previo pendiente: Sin Responsable Designado"
          color="orange"
          radius="md"
        >
          <Text size="sm">
            La unidad institucional <strong>[{activeUnit?.codigo}] {activeUnit?.nombre}</strong> no cuenta con ningún funcionario activo con designación vigente como Responsable de Caja Chica.
            Por normativa institucional de la Caja Petrolera de Salud, es requisito obligatorio contar con un responsable con cuenta institucional activa y documento formal de designación antes de abrir el fondo.
          </Text>
          <Button
            size="xs"
            color="orange"
            variant="outline"
            leftSection={<IconUserPlus size={14} />}
            mt="xs"
            onClick={() => navigate('/usuarios')}
          >
            Designar Encargado en Usuarios y Unidades &rarr;
          </Button>
        </Alert>
      )}

      {/* Formulario de Registro o Datos Confirmados */}
      <Paper p="lg" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <form onSubmit={handleSaveDraft}>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4} c="#007B6D">
                {isConfirmed
                  ? 'Detalle Formal de la Apertura Confirmada'
                  : isBorrador
                  ? 'Modificar Datos de la Apertura (Borrador)'
                  : 'Formulario de Nueva Apertura de Caja Chica'}
              </Title>
              {hasNoApertura && responsables.length > 0 && (
                <Badge color="blue" variant="light">
                  Listo para registrar
                </Badge>
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Responsable Designado de Caja Chica"
                placeholder={
                  responsables.length === 0
                    ? 'No hay encargados activos con designación para esta unidad'
                    : 'Seleccione al funcionario responsable'
                }
                data={responsables.map((r) => ({
                  value: r.id,
                  label: `${r.nombres} ${r.apellidos} - CI: ${r.carnetIdentidad} (${r.cargo})${
                    r.user ? ` [Usuario: ${r.user.username}]` : ''
                  }`,
                }))}
                value={formData.responsableId}
                onChange={(val) => setFormData({ ...formData, responsableId: val || '' })}
                required
                disabled={isConfirmed || responsables.length === 0}
              />

              <TextInput
                label="Fecha Oficial de Apertura"
                type="date"
                value={formData.fechaApertura}
                onChange={(e) => setFormData({ ...formData, fechaApertura: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Monto Máximo Autorizado del Fondo (Bs.)"
                placeholder="10000.00"
                value={formData.montoAutorizado}
                onChange={(e) => setFormData({ ...formData, montoAutorizado: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Importe Real Recibido en Efectivo (Bs.)"
                placeholder="10000.00"
                value={formData.importeRecibido}
                onChange={(e) => setFormData({ ...formData, importeRecibido: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Documento de Autorización / Resolución Administrativa"
                placeholder="ej. Res. Adm. DAF-045/2026"
                value={formData.docAutorizacion}
                onChange={(e) => setFormData({ ...formData, docAutorizacion: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Comprobante de Ingreso / Cheque Institucional"
                placeholder="ej. CHQ-BUN-458921"
                value={formData.compIngreso}
                onChange={(e) => setFormData({ ...formData, compIngreso: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />
            </SimpleGrid>

            <Divider my="sm" />

            {/* Acciones */}
            {!isConfirmed && (
              <Group justify="flex-end" gap="sm">
                <Button
                  type="submit"
                  color="cpsTeal"
                  loading={isSubmitting}
                  disabled={responsables.length === 0}
                  leftSection={hasNoApertura ? <IconPlus size={16} /> : undefined}
                  variant={isBorrador ? 'outline' : 'filled'}
                >
                  {hasNoApertura ? 'Crear Registro de Apertura' : 'Actualizar Borrador'}
                </Button>

                {isBorrador && (
                  <Button
                    color="cpsTeal"
                    leftSection={<IconCheck size={16} />}
                    onClick={openConfirmModal}
                  >
                    Confirmar Apertura Definitiva
                  </Button>
                )}
              </Group>
            )}
          </Stack>
        </form>
      </Paper>

      {/* Movimientos de Efectivo si la caja está abierta */}
      {isConfirmed && apertura.movimientos && (
        <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
          <Title order={4} mb="md" c="#1e293b">
            Movimientos de Efectivo Registrados en este Fondo
          </Title>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th style={{ width: 140 }}>Fecha</Table.Th>
                <Table.Th style={{ width: 130 }}>Tipo</Table.Th>
                <Table.Th>Descripción</Table.Th>
                <Table.Th style={{ width: 160 }}>Comprobante</Table.Th>
                <Table.Th style={{ width: 160, textAlign: 'right' }}>Importe (Bs.)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {apertura.movimientos.map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td style={{ fontSize: '12px' }}>
                    {new Date(m.fecha).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}
                  </Table.Td>
                  <Table.Td>
                    <Badge color="teal" variant="light">
                      {m.tipo}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ fontWeight: 500 }}>{m.descripcion}</Table.Td>
                  <Table.Td>{m.comprobanteReferencia || '-'}</Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 700, color: '#007B6D' }}>
                    +Bs. {m.monto}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Modal de Confirmación Sensible */}
      <Modal
        opened={confirmModalOpened}
        onClose={closeConfirmModal}
        title={
          <Group gap="xs">
            <IconAlertTriangle color="#d97706" size={22} />
            <Text fw={700} c="#1e293b">
              Confirmar Apertura de Caja Chica
            </Text>
          </Group>
        }
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">
            ¿Está seguro de confirmar formalmente la apertura de Caja Chica para la gestión{' '}
            <strong>{currentGestion}</strong> en la unidad{' '}
            <strong>[{activeUnit?.codigo}] {activeUnit?.nombre}</strong>?
          </Text>
          <Text size="xs" c="dimmed">
            Esta acción generará la entrada única de efectivo por{' '}
            <strong>Bs. {formData.importeRecibido}</strong> y fijará el estado formal como ABIERTA.
            Por control institucional, esta acción es irreversible.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeConfirmModal} disabled={isConfirming}>
              Cancelar
            </Button>
            <Button
              color="cpsTeal"
              onClick={handleConfirmApertura}
              loading={isConfirming}
            >
              Confirmar Apertura Definitiva
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
