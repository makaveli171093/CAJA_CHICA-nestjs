import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Button,
  Badge,
  Table,
  ActionIcon,
  Modal,
  Textarea,
  Stack,
  Alert,
  Loader,
  Card,
  Grid,
  Select,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconPrinter,
  IconCheck,
  IconX,
  IconSend,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  IconEye,
  IconReceipt,
  IconArrowBackUp,
  IconTrash,
  IconEdit,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import {
  getRendiciones,
  enviarRendicion,
  aprobarRendicion,
  rechazarRendicion,
  devolverRendicionBorrador,
  eliminarRendicion,
} from '../../services/api';
import { Rendicion, Unit } from '../../types';
import { NuevaRendicionModal } from '../../components/Rendiciones/NuevaRendicionModal';
import { DualPrintModal } from '../../components/Rendiciones/DualPrintModal';
import { EditarRendicionModal } from '../../components/Rendiciones/EditarRendicionModal';
import { formatDateToBO } from '../../utils/dateUtils';

interface RendicionesPageProps {
  currentGestion: number;
}

export const RendicionesPage: React.FC<RendicionesPageProps> = ({ currentGestion }) => {
  const { user, activeUnit, accessibleUnits, setActiveUnitId } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([]);

  // Modales
  const [modalNuevaOpened, setModalNuevaOpened] = useState<boolean>(false);
  const [modalDualPrintOpened, setModalDualPrintOpened] = useState<boolean>(false);
  const [selectedRendicionId, setSelectedRendicionId] = useState<string | null>(null);
  const [editingRendicionId, setEditingRendicionId] = useState<string | null>(null);

  // Modal Rechazo
  const [modalRechazoOpened, setModalRechazoOpened] = useState<boolean>(false);
  const [motivoRechazo, setMotivoRechazo] = useState<string>('');
  const [rendicionActionId, setRendicionActionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modal Devolver a Borrador
  const [modalDevolverOpened, setModalDevolverOpened] = useState<boolean>(false);
  const [motivoDevolucion, setMotivoDevolucion] = useState<string>('');

  // Modal Detalle
  const [modalDetalleOpened, setModalDetalleOpened] = useState<boolean>(false);
  const [rendicionDetalle, setRendicionDetalle] = useState<Rendicion | null>(null);

  const isAdmin = user?.rol === 'ADMINISTRADOR';
  const isFinanciero = user?.rol === 'FINANCIERO';
  const isGerencia = user?.rol === 'GERENCIA';
  const isEncargado = user?.rol === 'ENCARGADO';

  const canApprove = isAdmin || isFinanciero || isEncargado;
  const canCreate = isAdmin || isEncargado;

  useEffect(() => {
    if (activeUnit?.id) {
      cargarRendiciones();
    }
  }, [activeUnit?.id, currentGestion]);

  const cargarRendiciones = async () => {
    if (!activeUnit) return;
    setLoading(true);
    try {
      const data = await getRendiciones(activeUnit.id, currentGestion);
      setRendiciones(data || []);

    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error al cargar rendiciones',
        message: error.response?.data?.message || 'No se pudieron recuperar las rendiciones de cuentas.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = async (id: string) => {
    setActionLoading(true);
    try {
      await enviarRendicion(id);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Rendición Enviada',
        message: 'La rendición fue enviada para revisión y aprobación financiera.',
      });
      cargarRendiciones();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error al enviar rendición',
        message: error.response?.data?.message || 'No se pudo enviar la rendición.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAprobar = async (id: string) => {
    if (!window.confirm('¿Está seguro de aprobar definitivamente esta rendición de cuentas? Esta acción consolidará el gasto ejecutado.')) {
      return;
    }
    setActionLoading(true);
    try {
      await aprobarRendicion(id);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Rendición Aprobada',
        message: 'La rendición fue aprobada. Los anticipos fueron liquidados y los sobrantes ingresados.',
      });
      cargarRendiciones();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error al aprobar rendición',
        message: error.response?.data?.message || 'No se pudo aprobar la rendición.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRechazarConfirm = async () => {
    if (!rendicionActionId || !motivoRechazo.trim()) {
      notifications.show({ color: 'red', message: 'Debe especificar el motivo del rechazo.' });
      return;
    }
    setActionLoading(true);
    try {
      await rechazarRendicion(rendicionActionId, motivoRechazo.trim());
      notifications.show({
        color: 'orange',
        icon: <IconAlertCircle size={18} />,
        title: 'Rendición Rechazada',
        message: 'La rendición fue devuelta al encargado con las observaciones registradas.',
      });
      setModalRechazoOpened(false);
      setMotivoRechazo('');
      cargarRendiciones();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error al rechazar rendición',
        message: error.response?.data?.message || 'No se pudo rechazar la rendición.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const abrirModalDevolver = (id: string) => {
    setRendicionActionId(id);
    setMotivoDevolucion('');
    setModalDevolverOpened(true);
  };

  const handleDevolverConfirm = async () => {
    if (!rendicionActionId || motivoDevolucion.trim().length < 10) {
      notifications.show({ color: 'red', message: 'Debe ingresar una justificación de al menos 10 caracteres.' });
      return;
    }
    setActionLoading(true);
    try {
      await devolverRendicionBorrador(rendicionActionId, motivoDevolucion.trim());
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Rendición Devuelta a Borrador',
        message: 'La rendición ha vuelto a estado Borrador para su corrección o reingreso.',
      });
      setModalDevolverOpened(false);
      setMotivoDevolucion('');
      cargarRendiciones();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error al devolver rendición',
        message: error.response?.data?.message || 'No se pudo devolver la rendición a borrador.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEliminar = async (id: string, numeroRendicion: string) => {
    if (!window.confirm(`¿Está seguro de descartar la rendición ${numeroRendicion}? Esta acción eliminará los comprobantes cargados en borrador y liberará el vale de anticipo para registrar una nueva rendición con datos corregidos.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await eliminarRendicion(id);
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Rendición Descartada',
        message: `La rendición ${numeroRendicion} ha sido descartada y el anticipo quedó liberado.`,
      });
      cargarRendiciones();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error al descartar rendición',
        message: error.response?.data?.message || 'No se pudo descartar la rendición.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const abrirImpresionDual = (id: string) => {
    setSelectedRendicionId(id);
    setModalDualPrintOpened(true);
  };

  const verDetalle = (r: Rendicion) => {
    setRendicionDetalle(r);
    setModalDetalleOpened(true);
  };

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'BORRADOR':
        return <Badge color="gray">Borrador</Badge>;
      case 'ENVIADA':
        return <Badge color="blue">Enviada a Revisión</Badge>;
      case 'APROBADA':
        return <Badge color="teal">Aprobada (DAF)</Badge>;
      case 'RECHAZADA':
        return <Badge color="red">Rechazada</Badge>;
      default:
        return <Badge color="gray">{estado}</Badge>;
    }
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        {/* Cabecera y Selector de Unidad */}
        <Paper p="md" radius="md" withBorder className="border-slate-200">
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Group gap="xs">
                <IconReceipt size={26} className="text-[#007B6D]" />
                <Title order={2} c="cpsTeal">
                  Rendición de Cuentas y Descargos
                </Title>
              </Group>
              <Text size="sm" c="dimmed">
                Formulario 002 / Form. 5308 — Liquidación de anticipos, registro de facturas y control de horas hábiles
              </Text>
            </div>

            <Group gap="sm">
              {/* Selector de Unidad para roles de supervisión */}
              {(isAdmin || isFinanciero || isGerencia) && accessibleUnits.length > 1 && (
                <Select
                  size="xs"
                  label="Unidad Institucional"
                  data={accessibleUnits.map((u: Unit) => ({
                    value: u.id,
                    label: `${u.codigo} - ${u.nombre}`,
                  }))}
                  value={activeUnit?.id || ''}
                  onChange={(val) => setActiveUnitId(val)}
                  w={240}
                />
              )}

              <ActionIcon
                variant="light"
                color="cpsTeal"
                size="lg"
                onClick={cargarRendiciones}
                loading={loading}
                title="Actualizar listado"
              >
                <IconRefresh size={18} />
              </ActionIcon>

              {canCreate && (
                <Button
                  color="cpsTeal"
                  leftSection={<IconPlus size={18} />}
                  onClick={() => setModalNuevaOpened(true)}
                  disabled={!activeUnit}
                >
                  Nueva Rendición con Facturas
                </Button>
              )}
            </Group>

          </Group>
        </Paper>

        {/* Banner Informativo de Reglas y Perfiles */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder radius="md" p="sm" bg="#f8fafc">
              <Group gap="xs">
                <IconClock size={20} className="text-[#007B6D]" />
                <Text size="xs" fw={700} tt="uppercase" c="cpsTeal">
                  Regla de Rendición: 48 Horas Hábiles Administrativas (Lunes a Viernes)
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                Conforme a la directiva institucional, el plazo de 48 horas se contabiliza estrictamente en días laborables hábiles (excluyendo sábados y domingos).
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder radius="md" p="sm" bg="#f0fdf4">
              <Text size="xs" fw={700} c="cpsTeal">
                Rol Activo: {user?.rol}
              </Text>
              <Text size="xs" c="dimmed">
                {isGerencia
                  ? 'Modo lectura ejecutiva activado: consulta de reportes y métricas.'
                  : isFinanciero
                  ? 'Facultad de aprobación/rechazo de presupuestos y rendiciones.'
                  : isAdmin
                  ? 'Acceso total operativo y de configuración.'
                  : 'Operador de caja chica en su unidad autorizada.'}
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Tabla de Rendiciones */}
        <Paper withBorder radius="md" p="md">
          {loading ? (
            <Stack align="center" py="xl">
              <Loader color="cpsTeal" size="md" />
              <Text size="sm" c="dimmed">
                Cargando rendiciones de cuentas...
              </Text>
            </Stack>
          ) : rendiciones.length === 0 ? (
            <Alert color="blue" icon={<IconAlertCircle />}>
              No se registran rendiciones de cuentas formuladas para la unidad y gestión seleccionadas.
            </Alert>
          ) : (
            <Table striped highlightOnHover verticalSpacing="sm" fz="sm">
              <Table.Thead bg="#f8fafc">
                <Table.Tr>
                  <Table.Th>N° Rendición</Table.Th>
                  <Table.Th>Vale Anticipo</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Anticipado</Table.Th>
                  <Table.Th>Descargado</Table.Th>
                  <Table.Th>Sobrante Devuelto</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Plazo 48h Hábiles</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rendiciones.map((r) => {
                  const plazo = r.plazo48Horas;
                  return (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Text fw={600} size="xs" c="cpsTeal">
                          {r.numeroRendicion}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {r.documentos.length} documento(s)
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={500}>
                          {r.anticipo?.numeroVale || 'N/A'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{formatDateToBO(r.fechaRendicion)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600}>
                          Bs {r.montoAnticipo}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={700} c="dark">
                          Bs {r.totalDescargado}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="teal" fw={600}>
                          Bs {r.montoDevuelto}
                        </Text>
                      </Table.Td>
                      <Table.Td>{getBadgeEstado(r.estado)}</Table.Td>
                      <Table.Td>
                        {plazo ? (
                          <Tooltip
                            label={`Horas hábiles transcurridas: ${plazo.horasHabilesTranscurridas}h / Restantes: ${plazo.horasHabilesRestantes}h`}
                          >
                            <Badge
                              color={plazo.vencido ? 'red' : plazo.horasHabilesRestantes <= 8 ? 'yellow' : 'teal'}
                              variant="light"
                              size="xs"
                            >
                              {plazo.vencido
                                ? 'Vencido'
                                : `${plazo.horasHabilesRestantes}h hábiles`}
                            </Badge>
                          </Tooltip>
                        ) : (
                          <Text size="xs" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group justify="flex-end" gap="xs">
                          {/* Ver Detalle */}
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => verDetalle(r)}
                            title="Ver facturas y detalle"
                          >
                            <IconEye size={16} />
                          </ActionIcon>

                          {/* Motor de Impresión Dual */}
                          <ActionIcon
                            variant="light"
                            color="cpsTeal"
                            size="sm"
                            onClick={() => abrirImpresionDual(r.id)}
                            title="Imprimir (Preimpreso / Hoja blanca)"
                          >
                            <IconPrinter size={16} />
                          </ActionIcon>

                          {/* Corregir Rendición (Fase de Pruebas: Habilitado para Administrador, Encargado y Financiero) */}
                          {(canCreate || canApprove || isAdmin) && (
                            <Tooltip label="Corregir datos y facturas de la rendición (Fase de Pruebas)">
                              <ActionIcon
                                variant="light"
                                color="orange"
                                size="sm"
                                onClick={() => setEditingRendicionId(r.id)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {/* Enviar a revisión y Descartar borrador (Encargado en BORRADOR o RECHAZADA) */}
                          {canCreate && (r.estado === 'BORRADOR' || r.estado === 'RECHAZADA') && (
                            <>
                              <Tooltip label="Enviar a revisión del Financiero">
                                <ActionIcon
                                  variant="filled"
                                  color="blue"
                                  size="sm"
                                  onClick={() => handleEnviar(r.id)}
                                  loading={actionLoading}
                                >
                                  <IconSend size={15} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Descartar borrador y rehacer">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  onClick={() => handleEliminar(r.id, r.numeroRendicion)}
                                  loading={actionLoading}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </>
                          )}

                          {/* Devolver a Borrador (Encargado o Financiero cuando está ENVIADA) */}
                          {(canCreate || canApprove) && r.estado === 'ENVIADA' && (
                            <Tooltip label="Devolver a Borrador para corrección">
                              <ActionIcon
                                variant="light"
                                color="orange"
                                size="sm"
                                onClick={() => abrirModalDevolver(r.id)}
                                loading={actionLoading}
                              >
                                <IconArrowBackUp size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {/* Aprobar / Rechazar (Encargado, Financiero o Administrador) */}
                          {canApprove && (r.estado === 'ENVIADA' || r.estado === 'BORRADOR') && (
                            <>
                              <Tooltip label="Aprobar rendición (Consolidar gasto)">
                                <ActionIcon
                                  variant="filled"
                                  color="teal"
                                  size="sm"
                                  onClick={() => handleAprobar(r.id)}
                                  loading={actionLoading}
                                >
                                  <IconCheck size={16} />
                                </ActionIcon>
                              </Tooltip>
                              {r.estado === 'ENVIADA' && (
                                <Tooltip label="Rechazar con observaciones">
                                  <ActionIcon
                                    variant="filled"
                                    color="red"
                                    size="sm"
                                    onClick={() => {
                                      setRendicionActionId(r.id);
                                      setModalRechazoOpened(true);
                                    }}
                                    loading={actionLoading}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
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
      </Stack>

      {/* Modal de Nueva Rendición */}
      {activeUnit && (
        <NuevaRendicionModal
          opened={modalNuevaOpened}
          onClose={() => setModalNuevaOpened(false)}
          onSuccess={cargarRendiciones}
          unidadId={activeUnit.id}
          gestion={currentGestion}
        />
      )}


      {/* Modal de Impresión Dual */}
      <DualPrintModal
        opened={modalDualPrintOpened}
        onClose={() => setModalDualPrintOpened(false)}
        rendicionId={selectedRendicionId}
      />

      {/* Modal de Rechazo de Rendición */}
      <Modal
        opened={modalRechazoOpened}
        onClose={() => setModalRechazoOpened(false)}
        title={
          <Group gap="xs">
            <IconAlertCircle size={20} className="text-red-500" />
            <Text fw={700} c="red">
              Rechazar Rendición de Cuentas
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Indique detalladamente las observaciones para que el encargado de caja chica subsane la documentación o importes.
          </Text>
          <Textarea
            label="Motivo del Rechazo"
            placeholder="Ej. La factura N° 10482 no consigna el sello de cancelado del proveedor o el NIT es erróneo..."
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            required
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalRechazoOpened(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleRechazarConfirm} loading={actionLoading}>
              Confirmar Rechazo
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Devolver a Borrador */}
      <Modal
        opened={modalDevolverOpened}
        onClose={() => setModalDevolverOpened(false)}
        title={
          <Group gap="xs">
            <IconArrowBackUp size={20} className="text-amber-600" />
            <Text fw={700} c="orange">
              Devolver Rendición a Borrador
            </Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Esta acción regresará la rendición a estado <strong>Borrador</strong> para permitir la edición de facturas, corrección de importes o rectificación de datos antes de un nuevo envío.
          </Text>
          <Textarea
            label="Justificación del Retorno a Borrador"
            placeholder="Especifique el motivo (ej. Corrección en factura N° 45, error en NIT o partida presupuestaria...)"
            value={motivoDevolucion}
            onChange={(e) => setMotivoDevolucion(e.target.value)}
            required
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalDevolverOpened(false)}>
              Cancelar
            </Button>
            <Button
              color="orange"
              onClick={handleDevolverConfirm}
              loading={actionLoading}
              disabled={motivoDevolucion.trim().length < 10}
            >
              Devolver a Borrador
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Detalle de Facturas */}
      <Modal
        opened={modalDetalleOpened}
        onClose={() => setModalDetalleOpened(false)}
        size="lg"
        title={
          <Text fw={700} c="cpsTeal">
            Detalle de Documentos — {rendicionDetalle?.numeroRendicion}
          </Text>
        }
        centered
      >
        {rendicionDetalle && (
          <Stack gap="sm">
            {rendicionDetalle.motivoRechazo && (
              <Alert color="red" title="Observación de Rechazo">
                {rendicionDetalle.motivoRechazo}
              </Alert>
            )}

            <Table striped withTableBorder fz="xs">
              <Table.Thead bg="#f8fafc">
                <Table.Tr>
                  <Table.Th>N° Doc.</Table.Th>
                  <Table.Th>NIT / CI</Table.Th>
                  <Table.Th>Proveedor</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Partida</Table.Th>
                  <Table.Th>Importe (Bs)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rendicionDetalle.documentos.map((d) => (
                  <Table.Tr key={d.id}>
                    <Table.Td fw={600}>{d.numeroDocumento}</Table.Td>
                    <Table.Td>{d.nitCiEmisor}</Table.Td>
                    <Table.Td>{d.razonSocial}</Table.Td>
                    <Table.Td>{formatDateToBO(d.fechaEmision)}</Table.Td>
                    <Table.Td fw={600}>{d.partida?.codigo || d.partidaId}</Table.Td>
                    <Table.Td fw={700}>Bs {d.importe}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="space-between" pt="xs" className="border-t border-slate-200">
              <Text size="xs" c="dimmed">
                Total Descargado: <strong className="text-slate-900">Bs {rendicionDetalle.totalDescargado}</strong>
              </Text>
              <Text size="xs" c="teal">
                Sobrante Devuelto: <strong className="text-teal-700">Bs {rendicionDetalle.montoDevuelto}</strong>
              </Text>
            </Group>

            <Group justify="flex-end" mt="xs">
              {(canCreate || canApprove || isAdmin) && (
                <Button
                  size="xs"
                  color="orange"
                  variant="light"
                  leftSection={<IconEdit size={14} />}
                  onClick={() => {
                    const id = rendicionDetalle.id;
                    setModalDetalleOpened(false);
                    setEditingRendicionId(id);
                  }}
                >
                  Corregir Datos y Facturas
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal de Edición Integral de Rendición (Fase de Pruebas) */}
      <EditarRendicionModal
        opened={!!editingRendicionId}
        onClose={() => setEditingRendicionId(null)}
        onSuccess={() => {
          setEditingRendicionId(null);
          cargarRendiciones();
        }}
        rendicionId={editingRendicionId}
        unidadId={activeUnit?.id || ''}
        gestion={currentGestion}
      />
    </Container>
  );
};
