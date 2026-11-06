import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Select,
  Button,
  Badge,
  Loader,
  Box,
  Table,
  Tabs,
  Progress,
  SimpleGrid,
  Card,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChartBar,
  IconReceipt2,
  IconClock,
  IconPrinter,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconCheck,
  IconAlertTriangle,
  IconBuilding,
  IconCoin,
  IconCash,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import {
  getReporteEjecucion,
  getKardexCaja,
  getReporteCumplimiento,
} from '../../services/api';
import {
  ReporteEjecucionPresupuestaria,
  KardexCaja,
  ReporteCumplimiento,
} from '../../types';
import { formatDateToBO, formatDateTimeToBO } from '../../utils/dateUtils';

export const ReportesPage: React.FC<{ currentGestion: number }> = ({ currentGestion }) => {
  const { activeUnitId, accessibleUnits, user } = useAuth();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(activeUnitId);
  const [activeTab, setActiveTab] = useState<string | null>('ejecucion');

  const [ejecucionData, setEjecucionData] = useState<ReporteEjecucionPresupuestaria | null>(null);
  const [kardexData, setKardexData] = useState<KardexCaja | null>(null);
  const [cumplimientoData, setCumplimientoData] = useState<ReporteCumplimiento | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeUnitId && !selectedUnitId) {
      setSelectedUnitId(activeUnitId);
    }
  }, [activeUnitId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'ejecucion') {
        const data = await getReporteEjecucion(
          currentGestion,
          selectedUnitId === 'ALL' ? undefined : selectedUnitId || undefined
        );
        setEjecucionData(data);
      } else if (activeTab === 'kardex') {
        if (selectedUnitId && selectedUnitId !== 'ALL') {
          const data = await getKardexCaja(selectedUnitId, currentGestion);
          setKardexData(data);
        } else {
          setKardexData(null);
        }
      } else if (activeTab === 'cumplimiento') {
        const data = await getReporteCumplimiento(
          currentGestion,
          selectedUnitId === 'ALL' ? undefined : selectedUnitId || undefined
        );
        setCumplimientoData(data);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error al generar reporte',
        message: error.response?.data?.message || 'No se pudo obtener la información requerida.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, selectedUnitId, currentGestion]);

  const isGlobalRole = user?.rol === 'GERENCIA' || user?.rol === 'FINANCIERO' || user?.rol === 'ADMINISTRADOR';

  const unitOptions = [
    ...(isGlobalRole ? [{ value: 'ALL', label: '📊 CONSOLIDADO INSTITUCIONAL (Todas las Unidades)' }] : []),
    ...accessibleUnits.map((u) => ({
      value: u.id,
      label: `[${u.codigo}] ${u.nombre}`,
    })),
  ];

  return (
    <Stack gap="lg">
      {/* Header y Filtro Superior */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" wrap="wrap" gap="md">
          <Box>
            <Title order={3} c="#1e293b">
              Centro de Reportes y Auditoría Institucional
            </Title>
            <Text size="xs" c="dimmed">
              Caja Petrolera de Salud | Métricas de gestión, ejecución presupuestaria, kardex y plazos normativos
            </Text>
          </Box>
          <Group>
            <Select
              leftSection={<IconBuilding size={16} color="#007B6D" />}
              data={unitOptions}
              value={selectedUnitId}
              onChange={(val) => setSelectedUnitId(val)}
              allowDeselect={false}
              size="sm"
              w={{ base: 260, sm: 340 }}
            />
            <Button
              variant="outline"
              color="cpsTeal"
              leftSection={<IconPrinter size={16} />}
              onClick={() => window.print()}
            >
              Imprimir
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} color="cpsTeal">
        <Tabs.List>
          <Tabs.Tab value="ejecucion" leftSection={<IconChartBar size={16} />}>
            Ejecución Presupuestaria
          </Tabs.Tab>
          <Tabs.Tab value="kardex" leftSection={<IconReceipt2 size={16} />}>
            Libro Diario / Kardex de Caja
          </Tabs.Tab>
          <Tabs.Tab value="cumplimiento" leftSection={<IconClock size={16} />}>
            Auditoría Plazos (48 Horas Hábiles)
          </Tabs.Tab>
        </Tabs.List>

        {/* ===================== TAB 1: EJECUCIÓN PRESUPUESTARIA ===================== */}
        <Tabs.Panel value="ejecucion" pt="md">
          {isLoading ? (
            <Box py="xl" ta="center">
              <Loader color="cpsTeal" size="md" />
              <Text size="sm" c="dimmed" mt="xs">Calculando ejecución presupuestaria...</Text>
            </Box>
          ) : !ejecucionData ? (
            <Paper p="xl" ta="center" withBorder>
              <Text c="dimmed">Seleccione una unidad para ver la ejecución presupuestaria.</Text>
            </Paper>
          ) : (
            <Stack gap="md">
              {/* KPIs de Ejecución */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>PRESUPUESTO ASIGNADO</Text>
                  <Text size="lg" fw={800} c="#1e293b">
                    Bs. {ejecucionData.totales.asignado.toFixed(2)}
                  </Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>COMPROMETIDO (VALES)</Text>
                  <Text size="lg" fw={800} c="orange">
                    Bs. {ejecucionData.totales.comprometido.toFixed(2)}
                  </Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>EJECUTADO (DESCARGOS)</Text>
                  <Text size="lg" fw={800} c="#007B6D">
                    Bs. {ejecucionData.totales.ejecutado.toFixed(2)}
                  </Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>SALDO DISPONIBLE</Text>
                  <Text size="lg" fw={800} c="teal">
                    Bs. {ejecucionData.totales.disponible.toFixed(2)}
                  </Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>% EJECUCIÓN</Text>
                  <Text size="lg" fw={800} c="#007B6D">
                    {ejecucionData.totales.porcentajeEjecucion.toFixed(1)}%
                  </Text>
                  <Progress
                    value={ejecucionData.totales.porcentajeEjecucion}
                    color="cpsTeal"
                    size="sm"
                    mt="xs"
                  />
                </Card>
              </SimpleGrid>

              {/* Si es consolidado multiunidad, mostrar desglose por unidad */}
              {ejecucionData.unidades && ejecucionData.unidades.length > 0 && (
                <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
                  <Title order={4} mb="sm" c="#1e293b">
                    Consolidado Comparativo por Unidad Institucional
                  </Title>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                        <Table.Th>Unidad</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Asignado</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Comprometido</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Ejecutado</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Disponible</Table.Th>
                        <Table.Th style={{ width: 140 }}>% Ejecución</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {ejecucionData.unidades.map((u) => (
                        <Table.Tr key={u.unidadId}>
                          <Table.Td fw={600}>[{u.codigo}] {u.nombre}</Table.Td>
                          <Table.Td ta="right">Bs. {u.asignado.toFixed(2)}</Table.Td>
                          <Table.Td ta="right" c="orange">Bs. {u.comprometido.toFixed(2)}</Table.Td>
                          <Table.Td ta="right" fw={700} c="#007B6D">Bs. {u.ejecutado.toFixed(2)}</Table.Td>
                          <Table.Td ta="right" c="teal">Bs. {u.disponible.toFixed(2)}</Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Progress value={u.porcentajeEjecucion} color="cpsTeal" size="sm" style={{ flex: 1 }} />
                              <Text size="xs" fw={700}>{u.porcentajeEjecucion.toFixed(0)}%</Text>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}

              {/* Detalle por Partida Presupuestaria */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
                <Title order={4} mb="sm" c="#1e293b">
                  Ejecución Presupuestaria por Partida de Gasto
                </Title>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                      <Table.Th style={{ width: 100 }}>Partida</Table.Th>
                      <Table.Th>Descripción</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Asignado</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Comprometido</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Ejecutado</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Disponible</Table.Th>
                      <Table.Th style={{ width: 140 }}>% Avance</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ejecucionData.partidas.map((p) => (
                      <Table.Tr key={p.partidaId}>
                        <Table.Td fw={700} c="#007B6D">{p.codigo}</Table.Td>
                        <Table.Td>{p.descripcion}</Table.Td>
                        <Table.Td ta="right">Bs. {p.asignado.toFixed(2)}</Table.Td>
                        <Table.Td ta="right" c="orange">Bs. {p.comprometido.toFixed(2)}</Table.Td>
                        <Table.Td ta="right" fw={700} c="#007B6D">Bs. {p.ejecutado.toFixed(2)}</Table.Td>
                        <Table.Td ta="right" c="teal">Bs. {p.disponible.toFixed(2)}</Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Progress value={p.porcentajeEjecucion} color="cpsTeal" size="sm" style={{ flex: 1 }} />
                            <Text size="xs" fw={700}>{p.porcentajeEjecucion.toFixed(0)}%</Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Stack>
          )}
        </Tabs.Panel>

        {/* ===================== TAB 2: LIBRO DIARIO / KARDEX ===================== */}
        <Tabs.Panel value="kardex" pt="md">
          {selectedUnitId === 'ALL' ? (
            <Paper p="xl" ta="center" withBorder>
              <Text c="dimmed">
                El Libro Diario / Kardex de Efectivo se emite por unidad institucional específica. Seleccione una unidad en el selector superior.
              </Text>
            </Paper>
          ) : isLoading ? (
            <Box py="xl" ta="center">
              <Loader color="cpsTeal" size="md" />
              <Text size="sm" c="dimmed" mt="xs">Generando libro diario de caja...</Text>
            </Box>
          ) : !kardexData ? (
            <Paper p="xl" ta="center" withBorder>
              <Text c="dimmed">No existe apertura de caja registrada para esta unidad y gestión.</Text>
            </Paper>
          ) : (
            <Stack gap="md">
              {/* Encabezado del Kardex */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Box>
                    <Text size="xs" c="dimmed">Unidad / Responsable</Text>
                    <Text size="sm" fw={700}>
                      [{kardexData.cajaApertura.unidad.codigo}] {kardexData.cajaApertura.unidad.nombre}
                    </Text>
                    <Text size="xs">{kardexData.cajaApertura.responsable.nombreCompleto}</Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Fondo Asignado de Caja</Text>
                    <Text size="lg" fw={800} c="#007B6D">
                      Bs. {parseFloat(kardexData.cajaApertura.montoAsignado).toFixed(2)}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">Saldo Físico Actual en Efectivo</Text>
                    <Text size="lg" fw={800} c="teal">
                      Bs. {kardexData.resumen.saldoFinal.toFixed(2)}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Paper>

              {/* Movimientos Cronológicos */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
                <Title order={4} mb="sm" c="#1e293b">
                  Libro de Movimientos de Caja Chica (Kardex Cronológico)
                </Title>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                      <Table.Th style={{ width: 140 }}>Fecha</Table.Th>
                      <Table.Th style={{ width: 120 }}>Operación</Table.Th>
                      <Table.Th style={{ width: 150 }}>Comprobante Ref.</Table.Th>
                      <Table.Th>Concepto / Detalle</Table.Th>
                      <Table.Th style={{ width: 120, textAlign: 'right' }}>Ingreso (+)</Table.Th>
                      <Table.Th style={{ width: 120, textAlign: 'right' }}>Egreso (-)</Table.Th>
                      <Table.Th style={{ width: 130, textAlign: 'right' }}>Saldo en Caja</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {kardexData.movimientos.map((m, idx) => (
                      <Table.Tr key={idx}>
                        <Table.Td style={{ fontSize: '12px' }}>
                          {formatDateTimeToBO(m.fecha)}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={
                              m.tipo === 'APERTURA' || m.tipo === 'REPOSICION' || m.tipo === 'DEVOLUCION_SOBRANTE'
                                ? 'teal'
                                : 'orange'
                            }
                          >
                            {m.tipo}
                          </Badge>
                        </Table.Td>
                        <Table.Td fw={600} style={{ fontSize: '12px' }}>{m.documentoRef}</Table.Td>
                        <Table.Td style={{ fontSize: '13px' }}>{m.descripcion}</Table.Td>
                        <Table.Td ta="right" fw={700} c="teal">
                          {m.ingreso > 0 ? `+${m.ingreso.toFixed(2)}` : '-'}
                        </Table.Td>
                        <Table.Td ta="right" fw={700} c="red">
                          {m.egreso > 0 ? `-${m.egreso.toFixed(2)}` : '-'}
                        </Table.Td>
                        <Table.Td ta="right" fw={800} c="#007B6D">
                          Bs. {m.saldo.toFixed(2)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Stack>
          )}
        </Tabs.Panel>

        {/* ===================== TAB 3: AUDITORÍA DE PLAZOS 48 HORAS ===================== */}
        <Tabs.Panel value="cumplimiento" pt="md">
          {isLoading ? (
            <Box py="xl" ta="center">
              <Loader color="cpsTeal" size="md" />
              <Text size="sm" c="dimmed" mt="xs">Auditando cumplimiento normativo de 48 horas hábiles...</Text>
            </Box>
          ) : !cumplimientoData ? (
            <Paper p="xl" ta="center" withBorder>
              <Text c="dimmed">No se encontraron anticipos registrados para auditar.</Text>
            </Paper>
          ) : (
            <Stack gap="md">
              {/* KPIs Cumplimiento */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>TOTAL ANTICIPOS EMITIDOS</Text>
                  <Text size="lg" fw={800} c="#1e293b">{cumplimientoData.totalAnticipos}</Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>RENDIDOS A TIEMPO</Text>
                  <Text size="lg" fw={800} c="teal">{cumplimientoData.totalRendidos}</Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>PENDIENTES EN PLAZO</Text>
                  <Text size="lg" fw={800} c="blue">{cumplimientoData.totalPendientes}</Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>VENCIDOS / EN MORA</Text>
                  <Text size="lg" fw={800} c="red">{cumplimientoData.totalVencidos}</Text>
                </Card>
                <Card withBorder padding="sm">
                  <Text size="xs" c="dimmed" fw={700}>ÍNDICE DE CUMPLIMIENTO</Text>
                  <Text size="lg" fw={800} c="#007B6D">
                    {cumplimientoData.porcentajeCumplimiento.toFixed(1)}%
                  </Text>
                  <Progress
                    value={cumplimientoData.porcentajeCumplimiento}
                    color={cumplimientoData.porcentajeCumplimiento >= 90 ? 'teal' : 'orange'}
                    size="sm"
                    mt="xs"
                  />
                </Card>
              </SimpleGrid>

              {/* Tabla de Fiscalización de Plazos */}
              <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
                <Title order={4} mb="sm" c="#1e293b">
                  Control Normativo de Rendición de Cuentas (Reglamento CPS: 48 Horas Hábiles)
                </Title>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                      <Table.Th style={{ width: 130 }}>Nº Vale</Table.Th>
                      <Table.Th>Solicitante / Cargo</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Monto (Bs.)</Table.Th>
                      <Table.Th>Fecha Entrega</Table.Th>
                      <Table.Th>Fecha Límite 48h</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>Horas Transcurridas</Table.Th>
                      <Table.Th style={{ width: 180, textAlign: 'center' }}>Estado Normativo</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cumplimientoData.items.map((it) => (
                      <Table.Tr key={it.anticipoId}>
                        <Table.Td fw={700} c="#007B6D">{it.numeroVale}</Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={600}>{it.solicitante}</Text>
                          <Text size="10px" c="dimmed">{it.cargo} ({it.area})</Text>
                        </Table.Td>
                        <Table.Td ta="right" fw={700}>Bs. {it.monto.toFixed(2)}</Table.Td>
                        <Table.Td style={{ fontSize: '12px' }}>
                          {formatDateToBO(it.fechaEntrega)}
                        </Table.Td>
                        <Table.Td style={{ fontSize: '12px' }}>
                          {formatDateToBO(it.fechaLimite48h)}
                        </Table.Td>
                        <Table.Td ta="center" fw={600}>
                          {it.horasHabilesTranscurridas} hrs
                        </Table.Td>
                        <Table.Td ta="center">
                          {it.estadoPlazo === 'RENDIDO_A_TIEMPO' && (
                            <Badge color="teal" variant="filled">RENDIDO A TIEMPO</Badge>
                          )}
                          {it.estadoPlazo === 'RENDIDO_FUERA_DE_PLAZO' && (
                            <Badge color="orange" variant="light">RENDIDO FUERA DE PLAZO</Badge>
                          )}
                          {it.estadoPlazo === 'A_TIEMPO' && (
                            <Badge color="blue" variant="light">EN PLAZO ({it.horasHabilesRestantes}h)</Badge>
                          )}
                          {it.estadoPlazo === 'EN_RIESGO' && (
                            <Badge color="yellow" variant="filled">EN RIESGO (&lt;12h)</Badge>
                          )}
                          {it.estadoPlazo === 'VENCIDO' && (
                            <Badge color="red" variant="filled">VENCIDO / OBSERVADO</Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
};
