import React, { useEffect, useState, useMemo } from 'react';
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
  SimpleGrid,
  ThemeIcon,
  NumberInput,
  Card,
  ActionIcon,
  Tooltip,
  Select,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconScale,
  IconPlus,
  IconCheck,
  IconAlertTriangle,
  IconPrinter,
  IconReceipt2,
  IconCoin,
  IconCash,
  IconEye,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import {
  getArqueos,
  getArqueo,
  getResumenPrevioArqueo,
  createArqueo,
} from '../../services/api';
import {
  ArqueoCaja,
  TipoArqueo,
  EstadoArqueo,
  BilleteoDto,
  ResumenArqueoPrevio,
} from '../../types';
import { formatDateToBO, formatDateTimeToBO } from '../../utils/dateUtils';

export const ArqueosPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, activeUnit, user } = useAuth();
  const [arqueos, setArqueos] = useState<ArqueoCaja[]>([]);
  const [resumenPrevio, setResumenPrevio] = useState<ResumenArqueoPrevio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modales
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [actaModalOpened, { open: openActaModal, close: closeActaModal }] = useDisclosure(false);
  const [selectedArqueo, setSelectedArqueo] = useState<ArqueoCaja | null>(null);

  // Formulario de arqueo
  const [tipoArqueo, setTipoArqueo] = useState<TipoArqueo>('PERIODICO');
  const [observaciones, setObservaciones] = useState('');
  const [billeteo, setBilleteo] = useState<BilleteoDto>({
    b200: 0,
    b100: 0,
    b50: 0,
    b20: 0,
    b10: 0,
    m5: 0,
    m2: 0,
    m1: 0,
    m050: 0,
    m020: 0,
    m010: 0,
  });

  const isFinanciero = user?.rol === 'FINANCIERO';
  const isAdmin = user?.rol === 'ADMINISTRADOR';
  const canAudit = isFinanciero || isAdmin;

  const fetchData = async () => {
    if (!activeUnitId) return;
    setIsLoading(true);
    try {
      const [listRes, prevRes] = await Promise.all([
        getArqueos(activeUnitId, currentGestion),
        getResumenPrevioArqueo(activeUnitId).catch(() => null),
      ]);
      setArqueos(listRes || []);
      setResumenPrevio(prevRes);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'No se pudieron cargar los arqueos.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeUnitId, currentGestion]);

  // Cálculos dinámicos en vivo del billeteo
  const totalBilletes = useMemo(() => {
    return (
      billeteo.b200 * 200 +
      billeteo.b100 * 100 +
      billeteo.b50 * 50 +
      billeteo.b20 * 20 +
      billeteo.b10 * 10
    );
  }, [billeteo]);

  const totalMonedas = useMemo(() => {
    return (
      billeteo.m5 * 5 +
      billeteo.m2 * 2 +
      billeteo.m1 * 1 +
      billeteo.m050 * 0.5 +
      billeteo.m020 * 0.2 +
      billeteo.m010 * 0.1
    );
  }, [billeteo]);

  const totalEfectivoRecontado = totalBilletes + totalMonedas;

  const valesPendientesMonto = resumenPrevio
    ? parseFloat(resumenPrevio.totalValesPendientes || '0')
    : 0;

  const rendicionesTransitoMonto = resumenPrevio
    ? parseFloat(resumenPrevio.totalRendicionesEnTransito || '0')
    : 0;

  const totalGeneralRecontado =
    totalEfectivoRecontado + valesPendientesMonto + rendicionesTransitoMonto;

  const fondoAsignado = resumenPrevio
    ? parseFloat(resumenPrevio.montoAsignadoCaja || '0')
    : 0;

  const diferencia = totalGeneralRecontado - fondoAsignado;

  const estadoArqueo: EstadoArqueo =
    Math.abs(diferencia) < 0.01
      ? 'CONFORME'
      : diferencia > 0
      ? 'SOBRANTE'
      : 'FALTANTE';

  const handleOpenCreateModal = async () => {
    if (!activeUnitId) return;
    try {
      const prev = await getResumenPrevioArqueo(activeUnitId);
      setResumenPrevio(prev);
      setBilleteo({
        b200: 0,
        b100: 0,
        b50: 0,
        b20: 0,
        b10: 0,
        m5: 0,
        m2: 0,
        m1: 0,
        m050: 0,
        m020: 0,
        m010: 0,
      });
      setObservaciones('');
      setTipoArqueo('PERIODICO');
      openCreateModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error de Caja',
        message:
          error.response?.data?.message ||
          'No se puede iniciar el arqueo porque la caja no está formalmente abierta.',
        color: 'red',
      });
    }
  };

  const handleCreateArqueo = async () => {
    setIsSubmitting(true);
    try {
      await createArqueo({
        unidadId: activeUnitId!,
        tipoArqueo,
        billeteo,
        observaciones,
      });
      notifications.show({
        title: 'Arqueo Registrado',
        message: `El arqueo físico fue guardado con resultado: ${estadoArqueo}`,
        color: estadoArqueo === 'CONFORME' ? 'teal' : 'orange',
      });
      closeCreateModal();
      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Error al registrar arqueo',
        message: error.response?.data?.message || 'No se pudo guardar el arqueo.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewActa = async (id: string) => {
    try {
      const arq = await getArqueo(id);
      setSelectedArqueo(arq);
      openActaModal();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: 'No se pudo cargar el acta de arqueo.',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (estado: EstadoArqueo) => {
    switch (estado) {
      case 'CONFORME':
        return <Badge color="teal" variant="filled">CONFORME (0.00)</Badge>;
      case 'FALTANTE':
        return <Badge color="red" variant="filled">FALTANTE</Badge>;
      case 'SOBRANTE':
        return <Badge color="blue" variant="filled">SOBRANTE</Badge>;
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
              Arqueos Físicos de Caja Chica
            </Title>
            <Text size="xs" c="dimmed">
              Reglamento CPS 002/2013 | Fiscalización y conciliación física de efectivo, vales autorizados y descargos
            </Text>
          </Box>
          <Group>
            {canAudit && (
              <Button
                color="cpsTeal"
                leftSection={<IconScale size={16} />}
                onClick={handleOpenCreateModal}
              >
                Ejecutar Nuevo Arqueo de Caja
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Tabla de Arqueos Históricos */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        {isLoading ? (
          <Box py="xl" ta="center">
            <Loader color="cpsTeal" size="md" />
            <Text size="sm" c="dimmed" mt="xs">Cargando arqueos físicos...</Text>
          </Box>
        ) : arqueos.length === 0 ? (
          <Box py="xl" ta="center">
            <ThemeIcon size={48} radius="xl" color="teal" variant="light" mb="sm">
              <IconScale size={24} />
            </ThemeIcon>
            <Text fw={600} c="#1e293b">No existen actas de arqueo registradas en esta gestión</Text>
            <Text size="sm" c="dimmed">
              Los arqueos físicos periódicos o sorpresivos permiten verificar la custodia de los fondos de caja chica.
            </Text>
          </Box>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                <Table.Th style={{ width: 140 }}>Nº Acta</Table.Th>
                <Table.Th style={{ width: 110 }}>Fecha</Table.Th>
                <Table.Th style={{ width: 120 }}>Tipo</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Efectivo Recontado</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Total Arqueado</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'center' }}>Resultado</Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>Diferencia</Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {arqueos.map((arq) => (
                <Table.Tr key={arq.id}>
                  <Table.Td fw={700} c="#007B6D">{arq.numeroArqueo}</Table.Td>
                  <Table.Td style={{ fontSize: '13px' }}>
                    {formatDateToBO(arq.fechaArqueo)}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="outline" color="gray">{arq.tipoArqueo}</Badge>
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    Bs. {parseFloat(arq.totalEfectivoRecontado).toFixed(2)}
                  </Table.Td>
                  <Table.Td ta="right" fw={700}>
                    Bs. {parseFloat(arq.totalGeneralRecontado).toFixed(2)}
                  </Table.Td>
                  <Table.Td ta="center">{getStatusBadge(arq.estado)}</Table.Td>
                  <Table.Td
                    ta="right"
                    fw={700}
                    c={
                      parseFloat(arq.diferencia) === 0
                        ? 'teal'
                        : parseFloat(arq.diferencia) < 0
                        ? 'red'
                        : 'blue'
                    }
                  >
                    {parseFloat(arq.diferencia) > 0 ? '+' : ''}
                    Bs. {parseFloat(arq.diferencia).toFixed(2)}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Tooltip label="Ver Acta Formal de Arqueo">
                      <ActionIcon
                        variant="light"
                        color="teal"
                        onClick={() => handleViewActa(arq.id)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Modal: Nuevo Arqueo con Billeteo y Conciliación en Vivo */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={
          <Group gap="xs">
            <IconScale color="#007B6D" size={22} />
            <Text fw={700} c="#1e293b">
              Planilla de Arqueo Físico y Conciliación de Caja Chica
            </Text>
          </Group>
        }
        size="xl"
      >
        <Stack gap="md">
          {resumenPrevio && (
            <Paper p="sm" withBorder style={{ backgroundColor: '#f8fafc' }}>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                <Box>
                  <Text size="xs" c="dimmed">Fondo Autorizado</Text>
                  <Text size="sm" fw={800} c="#007B6D">
                    Bs. {parseFloat(resumenPrevio.montoAsignadoCaja).toFixed(2)}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Vales Pendientes ({resumenPrevio.cantidadValesPendientes})</Text>
                  <Text size="sm" fw={700}>
                    Bs. {parseFloat(resumenPrevio.totalValesPendientes).toFixed(2)}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Rendiciones en Tránsito ({resumenPrevio.cantidadRendicionesEnTransito})</Text>
                  <Text size="sm" fw={700}>
                    Bs. {parseFloat(resumenPrevio.totalRendicionesEnTransito).toFixed(2)}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Efectivo Requerido en Caja</Text>
                  <Text size="sm" fw={700} c="blue">
                    Bs. {parseFloat(resumenPrevio.efectivoTeoricoRequerido).toFixed(2)}
                  </Text>
                </Box>
              </SimpleGrid>
            </Paper>
          )}

          <Group grow>
            <Select
              label="Tipo de Arqueo"
              data={[
                { value: 'PERIODICO', label: 'Arqueo Periódico / Programado' },
                { value: 'SORPRESIVO', label: 'Arqueo Sorpresivo de Control Interno' },
                { value: 'CIERRE_GESTION', label: 'Arqueo de Cierre de Gestión Fiscal' },
              ]}
              value={tipoArqueo}
              onChange={(val) => setTipoArqueo((val as TipoArqueo) || 'PERIODICO')}
              allowDeselect={false}
            />
          </Group>

          {/* Calculadora de Billeteo */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {/* Billetes */}
            <Card withBorder padding="xs">
              <Text fw={700} size="sm" c="#007B6D" mb="xs">
                Billetes en Moneda Nacional (Total: Bs. {totalBilletes.toFixed(2)})
              </Text>
              <Table withTableBorder style={{ fontSize: '12px' }}>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                    <Table.Th>Corte</Table.Th>
                    <Table.Th style={{ width: 100 }}>Cantidad</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Subtotal (Bs.)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[
                    { key: 'b200', val: 200, label: 'Bs. 200' },
                    { key: 'b100', val: 100, label: 'Bs. 100' },
                    { key: 'b50', val: 50, label: 'Bs. 50' },
                    { key: 'b20', val: 20, label: 'Bs. 20' },
                    { key: 'b10', val: 10, label: 'Bs. 10' },
                  ].map((b) => (
                    <Table.Tr key={b.key}>
                      <Table.Td fw={600}>{b.label}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          min={0}
                          value={billeteo[b.key as keyof BilleteoDto]}
                          onChange={(v) =>
                            setBilleteo({ ...billeteo, [b.key]: Number(v) || 0 })
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {((billeteo[b.key as keyof BilleteoDto] || 0) * b.val).toFixed(2)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>

            {/* Monedas */}
            <Card withBorder padding="xs">
              <Text fw={700} size="sm" c="#007B6D" mb="xs">
                Monedas en Moneda Nacional (Total: Bs. {totalMonedas.toFixed(2)})
              </Text>
              <Table withTableBorder style={{ fontSize: '12px' }}>
                <Table.Thead>
                  <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                    <Table.Th>Corte</Table.Th>
                    <Table.Th style={{ width: 100 }}>Cantidad</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Subtotal (Bs.)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[
                    { key: 'm5', val: 5, label: 'Bs. 5.00' },
                    { key: 'm2', val: 2, label: 'Bs. 2.00' },
                    { key: 'm1', val: 1, label: 'Bs. 1.00' },
                    { key: 'm050', val: 0.5, label: 'Bs. 0.50' },
                    { key: 'm020', val: 0.2, label: 'Bs. 0.20' },
                    { key: 'm010', val: 0.1, label: 'Bs. 0.10' },
                  ].map((m) => (
                    <Table.Tr key={m.key}>
                      <Table.Td fw={600}>{m.label}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          min={0}
                          value={billeteo[m.key as keyof BilleteoDto]}
                          onChange={(v) =>
                            setBilleteo({ ...billeteo, [m.key]: Number(v) || 0 })
                          }
                        />
                      </Table.Td>
                      <Table.Td ta="right" fw={700}>
                        {((billeteo[m.key as keyof BilleteoDto] || 0) * m.val).toFixed(2)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </SimpleGrid>

          {/* Resumen de Conciliación en Vivo */}
          <Paper p="md" withBorder radius="md" style={{ backgroundColor: '#f0fdf4' }}>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Box>
                <Text size="xs" c="dimmed">Total Efectivo Recontado</Text>
                <Text size="md" fw={700} c="#1e293b">
                  Bs. {totalEfectivoRecontado.toFixed(2)}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Total General Arqueado (+Vales +Descargos)</Text>
                <Text size="md" fw={800} c="#007B6D">
                  Bs. {totalGeneralRecontado.toFixed(2)}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Diferencia / Resultado</Text>
                <Group gap="xs" mt={2}>
                  <Text
                    size="md"
                    fw={800}
                    c={
                      Math.abs(diferencia) < 0.01
                        ? 'teal'
                        : diferencia < 0
                        ? 'red'
                        : 'blue'
                    }
                  >
                    {diferencia > 0 ? '+' : ''}
                    Bs. {diferencia.toFixed(2)}
                  </Text>
                  {getStatusBadge(estadoArqueo)}
                </Group>
              </Box>
            </SimpleGrid>
          </Paper>

          {estadoArqueo === 'FALTANTE' && (
            <Alert color="red" icon={<IconAlertTriangle size={18} />}>
              Se ha detectado un <strong>FALTANTE</strong> en caja de Bs. {Math.abs(diferencia).toFixed(2)}. Según el Reglamento 002/2013 de la CPS, el custodio es civil y solidariamente responsable de restituir de inmediato todo faltante no justificado.
            </Alert>
          )}

          <Textarea
            label="Observaciones y Declaraciones del Arqueo"
            placeholder="Se procedió al recuento físico en presencia del custodio formal..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.currentTarget.value)}
            minRows={2}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeCreateModal}>
              Cancelar
            </Button>
            <Button
              color="cpsTeal"
              loading={isSubmitting}
              onClick={handleCreateArqueo}
            >
              Guardar y Emitir Acta de Arqueo
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Acta Formal de Arqueo Físico (Imprimible) */}
      <Modal
        opened={actaModalOpened}
        onClose={closeActaModal}
        title={
          <Group gap="xs">
            <IconScale color="#007B6D" size={20} />
            <Text fw={700} c="#1e293b">
              Acta de Arqueo Físico: {selectedArqueo?.numeroArqueo}
            </Text>
          </Group>
        }
        size="lg"
      >
        {selectedArqueo && (
          <Stack gap="md" id="print-acta-arqueo">
            <Box ta="center" pb="xs" style={{ borderBottom: '2px solid #007B6D' }}>
              <Text fw={800} size="md" c="#007B6D">CAJA PETROLERA DE SALUD</Text>
              <Text fw={700} size="sm">ACTA DE ARQUEO FÍSICO Y CONCILIACIÓN DE CAJA CHICA</Text>
              <Text size="xs" c="dimmed">Conforme a Reglamento Institucional 002/2013</Text>
            </Box>

            <SimpleGrid cols={2} spacing="xs" style={{ fontSize: '13px' }}>
              <Box>
                <Text size="xs" c="dimmed">Unidad Institucional:</Text>
                <Text fw={600}>[{selectedArqueo.unidad?.codigo}] {selectedArqueo.unidad?.nombre}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Gestión Fiscal / Fecha:</Text>
                <Text fw={600}>
                  {selectedArqueo.gestion} | {formatDateTimeToBO(selectedArqueo.fechaArqueo)}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Custodio / Responsable de Caja:</Text>
                <Text fw={600}>{selectedArqueo.custodio?.nombreCompleto}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Auditor / Verificador:</Text>
                <Text fw={600}>{selectedArqueo.auditor?.nombreCompleto}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Tipo de Arqueo:</Text>
                <Badge variant="outline">{selectedArqueo.tipoArqueo}</Badge>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">Estado del Arqueo:</Text>
                {getStatusBadge(selectedArqueo.estado)}
              </Box>
            </SimpleGrid>

            <Divider label="Resumen de Conciliación Física" labelPosition="center" />

            <Table withTableBorder striped>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td fw={500}>1. Total Efectivo en Billetes</Table.Td>
                  <Table.Td ta="right" fw={600}>Bs. {parseFloat(selectedArqueo.totalBilletes).toFixed(2)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>2. Total Efectivo en Monedas</Table.Td>
                  <Table.Td ta="right" fw={600}>Bs. {parseFloat(selectedArqueo.totalMonedas).toFixed(2)}</Table.Td>
                </Table.Tr>
                <Table.Tr style={{ backgroundColor: '#f0fdf4' }}>
                  <Table.Td fw={700}>TOTAL EFECTIVO EN CAJA (1 + 2)</Table.Td>
                  <Table.Td ta="right" fw={800} c="#007B6D">
                    Bs. {parseFloat(selectedArqueo.totalEfectivoRecontado).toFixed(2)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>3. Vales Provisionales Autorizados Pendientes</Table.Td>
                  <Table.Td ta="right" fw={600}>Bs. {parseFloat(selectedArqueo.totalValesPendientes).toFixed(2)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={500}>4. Rendiciones Aprobadas en Tránsito (Sin Reponer)</Table.Td>
                  <Table.Td ta="right" fw={600}>Bs. {parseFloat(selectedArqueo.totalRendicionesSinReponer).toFixed(2)}</Table.Td>
                </Table.Tr>
                <Table.Tr style={{ backgroundColor: '#e2e8f0' }}>
                  <Table.Td fw={800}>TOTAL GENERAL RECONTADO (Efectivo + Vales + Rendiciones)</Table.Td>
                  <Table.Td ta="right" fw={800}>
                    Bs. {parseFloat(selectedArqueo.totalGeneralRecontado).toFixed(2)}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={600}>Fondo Total Autorizado según Libros</Table.Td>
                  <Table.Td ta="right" fw={700}>Bs. {parseFloat(selectedArqueo.saldoSegunLibros).toFixed(2)}</Table.Td>
                </Table.Tr>
                <Table.Tr style={{ backgroundColor: selectedArqueo.estado === 'CONFORME' ? '#dcfce7' : '#fee2e2' }}>
                  <Table.Td fw={800}>DIFERENCIA DETERMINADA</Table.Td>
                  <Table.Td
                    ta="right"
                    fw={800}
                    c={
                      parseFloat(selectedArqueo.diferencia) === 0
                        ? 'teal'
                        : parseFloat(selectedArqueo.diferencia) < 0
                        ? 'red'
                        : 'blue'
                    }
                  >
                    {parseFloat(selectedArqueo.diferencia) > 0 ? '+' : ''}
                    Bs. {parseFloat(selectedArqueo.diferencia).toFixed(2)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>

            {selectedArqueo.observaciones && (
              <Box mt="xs">
                <Text size="xs" fw={700} c="dimmed">Observaciones:</Text>
                <Text size="xs" fs="italic">{selectedArqueo.observaciones}</Text>
              </Box>
            )}

            {/* Firmas */}
            <SimpleGrid cols={2} mt="xl" pt="xl">
              <Box ta="center">
                <Box style={{ borderTop: '1px solid #1e293b', width: '80%', margin: '0 auto', paddingTop: 4 }}>
                  <Text size="xs" fw={700}>{selectedArqueo.custodio?.nombreCompleto}</Text>
                  <Text size="10px" c="dimmed">Custodio / Responsable de Caja Chica</Text>
                </Box>
              </Box>
              <Box ta="center">
                <Box style={{ borderTop: '1px solid #1e293b', width: '80%', margin: '0 auto', paddingTop: 4 }}>
                  <Text size="xs" fw={700}>{selectedArqueo.auditor?.nombreCompleto}</Text>
                  <Text size="10px" c="dimmed">Auditor / Verificador Financiero</Text>
                </Box>
              </Box>
            </SimpleGrid>

            <Group justify="space-between" mt="md">
              <Button
                variant="outline"
                leftSection={<IconPrinter size={16} />}
                onClick={() => window.print()}
              >
                Imprimir Acta de Arqueo
              </Button>
              <Button variant="default" onClick={closeActaModal}>
                Cerrar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};
