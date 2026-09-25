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
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CajaApertura, Responsable } from '../../types';

export const AperturaPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, user } = useAuth();
  const [apertura, setApertura] = useState<CajaApertura | null>(null);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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
    if (!activeUnitId) return;
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
        // Reset form
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
    if (!activeUnitId) return;

    setIsSubmitting(true);
    try {
      if (apertura && apertura.estado === 'BORRADOR') {
        // Actualizar
        const res = await api.patch(`/apertura/${apertura.id}`, formData);
        setApertura(res.data);
        notifications.show({
          title: 'Borrador Actualizado',
          message: 'Los datos del borrador de apertura se han guardado con éxito.',
          color: 'teal',
        });
      } else {
        // Crear nuevo
        const res = await api.post('/apertura', {
          ...formData,
          unidadId: activeUnitId,
          gestion: currentGestion,
        });
        setApertura(res.data);
        notifications.show({
          title: 'Apertura Registrada',
          message: 'Se ha creado el registro de apertura en estado BORRADOR.',
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

  if (!activeUnitId) {
    return (
      <Paper p="xl" withBorder>
        <Text c="dimmed">Seleccione una unidad institucional autorizada para gestionar la apertura.</Text>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
        <Loader color="cpsTeal" />
      </Box>
    );
  }

  const isConfirmed = apertura?.estado === 'ABIERTA';

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between">
          <Box>
            <Title order={3} c="#1e293b">
              Apertura del Fondo de Caja Chica
            </Title>
            <Text size="xs" c="dimmed">
              Gestión Fiscal: {currentGestion} | Unidad: {apertura?.unidad?.nombre || 'Unidad Activa'}
            </Text>
          </Box>
          <Badge
            size="lg"
            variant="filled"
            color={
              apertura?.estado === 'ABIERTA'
                ? 'teal'
                : apertura?.estado === 'BORRADOR'
                ? 'yellow'
                : 'gray'
            }
          >
            ESTADO: {apertura?.estado || 'SIN REGISTRO'}
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
            efectivo en el libro diario.
          </Text>
          <Text size="xs" mt={4} fw={500}>
            Por normativa de control interno institucional, el importe de fondo confirmado no admite modificaciones
            directas mediante simples actualizaciones de saldo. Cualquier reposición, descargo o ampliación
            requerirá operaciones específicas posteriores.
          </Text>
        </Alert>
      )}

      {/* Formulario de Registro o Datos Confirmados */}
      <Paper p="lg" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <form onSubmit={handleSaveDraft}>
          <Stack gap="md">
            <Title order={4} c="#007B6D">
              {isConfirmed ? 'Detalle Formal de la Apertura Confirmada' : 'Datos del Registro de Apertura'}
            </Title>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Responsable Designado de Caja Chica"
                placeholder="Seleccione al funcionario responsable"
                data={responsables.map((r) => ({
                  value: r.id,
                  label: `${r.nombres} ${r.apellidos} - CI: ${r.carnetIdentidad} (${r.cargo})`,
                }))}
                value={formData.responsableId}
                onChange={(val) => setFormData({ ...formData, responsableId: val || '' })}
                required
                disabled={isConfirmed}
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
                label="Monto Total Autorizado (Bs.)"
                description="Límite máximo formal del fondo asignado por resolución"
                placeholder="10000.00"
                value={formData.montoAutorizado}
                onChange={(e) => setFormData({ ...formData, montoAutorizado: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Importe Efectivamente Recibido en Efectivo (Bs.)"
                description="Entrada de dinero real que se imputará en la apertura"
                placeholder="10000.00"
                value={formData.importeRecibido}
                onChange={(e) => setFormData({ ...formData, importeRecibido: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Referencia del Documento de Autorización"
                description="Resolución o memorando que autoriza el fondo"
                placeholder="ej. Resolución Administrativa N° 015/2026"
                value={formData.docAutorizacion}
                onChange={(e) => setFormData({ ...formData, docAutorizacion: e.currentTarget.value })}
                required
                disabled={isConfirmed}
              />

              <TextInput
                label="Referencia del Comprobante de Ingreso"
                description="Comprobante de egreso general o cheque entregado"
                placeholder="ej. Comprobante Egreso C-0081 / Cheque N° 99120"
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
                  variant="outline"
                  color="cpsTeal"
                  loading={isSubmitting}
                  disabled={responsables.length === 0}
                >
                  {apertura ? 'Actualizar Borrador' : 'Guardar como Borrador'}
                </Button>

                {apertura && apertura.estado === 'BORRADOR' && (
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

            {responsables.length === 0 && !isConfirmed && (
              <Alert icon={<IconAlertCircle size={16} />} title="Atención" color="orange">
                No hay responsables registrados y activos para esta unidad. Diríjase al módulo de "Responsables de Caja"
                para registrar al funcionario designado antes de aperturar el fondo.
              </Alert>
            )}
          </Stack>
        </form>
      </Paper>

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
            <strong>{currentGestion}</strong>?
          </Text>

          <Paper p="sm" withBorder style={{ backgroundColor: '#f8fafc' }}>
            <Text size="xs" c="dimmed">
              - Monto Autorizado: <strong>Bs. {formData.montoAutorizado}</strong>
            </Text>
            <Text size="xs" c="dimmed">
              - Efectivo Recibido: <strong>Bs. {formData.importeRecibido}</strong>
            </Text>
            <Text size="xs" c="dimmed">
              - Documento: <strong>{formData.docAutorizacion}</strong>
            </Text>
            <Text size="xs" c="dimmed">
              - Comprobante: <strong>{formData.compIngreso}</strong>
            </Text>
          </Paper>

          <Alert color="yellow">
            Esta acción se ejecutará en una transacción atómica inmutable y creará la entrada de efectivo inicial. Una
            vez confirmada, no podrá modificar directamente los importes ingresados.
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeConfirmModal} disabled={isConfirming}>
              Cancelar
            </Button>
            <Button
              color="cpsTeal"
              onClick={handleConfirmApertura}
              loading={isConfirming}
            >
              Sí, Confirmar Apertura
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
