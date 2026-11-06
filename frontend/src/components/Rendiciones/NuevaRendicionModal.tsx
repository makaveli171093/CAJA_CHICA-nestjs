import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Select,
  TextInput,
  NumberInput,
  Table,
  ActionIcon,
  Paper,
  Divider,
  Alert,
  Badge,
  Grid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconReceipt,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import Decimal from 'decimal.js';
import { api, createRendicion } from '../../services/api';
import { Partida, TipoDocumentoDescargo } from '../../types';
import { DateInputBO } from '../common/DateInputBO';

interface AnticipoPendiente {
  id: string;
  numeroVale: string;
  monto: string;
  fechaEntrega: string;
  pedido: {
    solicitanteNombres: string;
    solicitanteApellidos: string;
    solicitanteCi: string;
    solicitanteArea: string;
    descripcion: string;
    partidaId: string;
  };
}

interface FacturaRow {
  id: string;
  tipoDocumento: TipoDocumentoDescargo;
  numeroDocumento: string;
  nitCiEmisor: string;
  razonSocial: string;
  fechaEmision: string;
  codigoAutorizacion: string;
  codigoControl: string;
  partidaId: string;
  importe: string;
  concepto: string;
}

interface NuevaRendicionModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unidadId: string;
  gestion: number;
}

export const NuevaRendicionModal: React.FC<NuevaRendicionModalProps> = ({
  opened,
  onClose,
  onSuccess,
  unidadId,
  gestion,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [anticipos, setAnticipos] = useState<AnticipoPendiente[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [selectedAnticipoId, setSelectedAnticipoId] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState<string>('');
  const [montoDevuelto, setMontoDevuelto] = useState<string>('0.00');

  const crearFilaInicial = (ant?: AnticipoPendiente | null, fallbackPartidas: Partida[] = []): FacturaRow => ({
    id: String(Date.now() + Math.random()),
    tipoDocumento: 'FACTURA_COMPRA',
    numeroDocumento: '',
    nitCiEmisor: '',
    razonSocial: '',
    fechaEmision: new Date().toISOString().slice(0, 10),
    codigoAutorizacion: '',
    codigoControl: '',
    partidaId: ant?.pedido?.partidaId || (fallbackPartidas.length > 0 ? fallbackPartidas[0].id : ''),
    importe: '',
    concepto: ant?.pedido?.descripcion || '',
  });

  const [documentos, setDocumentos] = useState<FacturaRow[]>([crearFilaInicial(null)]);

  useEffect(() => {
    if (opened && unidadId) {
      cargarAnticiposYPartidas();
    } else if (!opened) {
      setSelectedAnticipoId(null);
      setObservaciones('');
      setMontoDevuelto('0.00');
      setDocumentos([crearFilaInicial(null)]);
    }
  }, [opened, unidadId, gestion]);

  const cargarAnticiposYPartidas = async () => {
    try {
      // Cargar en paralelo pedidos entregados y partidas habilitadas para máxima velocidad
      const [pedidosRes, partidasRes] = await Promise.all([
        api.get('/pedidos', { params: { unidadId, gestion, estado: 'ENTREGADO' } }),
        api.get(`/unidades/${unidadId}/partidas-habilitadas`).catch((err) => {
          console.warn('Error al consultar /unidades/partidas-habilitadas, intentando fallback:', err);
          return { data: [] };
        }),
      ]);

      const listaPedidos = pedidosRes.data || [];
      const pendientes: AnticipoPendiente[] = [];

      for (const p of listaPedidos) {
        if (p.anticipo && p.anticipo.estado === 'PENDIENTE') {
          pendientes.push({
            id: p.anticipo.id,
            numeroVale: p.anticipo.numeroVale,
            monto: p.anticipo.monto,
            fechaEntrega: p.anticipo.fechaEntrega,
            pedido: {
              solicitanteNombres: p.solicitanteNombres,
              solicitanteApellidos: p.solicitanteApellidos,
              solicitanteCi: p.solicitanteCi,
              solicitanteArea: p.solicitanteArea,
              descripcion: p.descripcion,
              partidaId: p.partidaId,
            },
          });
        }
      }
      setAnticipos(pendientes);

      // Procesar partidas habilitadas
      let habs: Partida[] = [];
      const items = Array.isArray(partidasRes.data)
        ? partidasRes.data
        : (partidasRes.data?.items || []);
      habs = items
        .filter((it: any) => it.habilitado !== false)
        .map((it: any) => ({
          id: it.partidaId || it.id,
          codigo: it.codigo,
          descripcion: it.descripcion,
          activo: true,
        }));

      // Fallback a partidas-presupuestos solo si no se encontraron partidas
      if (habs.length === 0) {
        try {
          const presRes = await api.get(`/unidades/${unidadId}/partidas-presupuestos`, {
            params: { gestion },
          });
          const items2 = presRes.data?.items || [];
          habs = items2
            .filter((it: any) => it.habilitado)
            .map((it: any) => ({
              id: it.partidaId || it.id,
              codigo: it.codigo,
              descripcion: it.descripcion,
              activo: true,
            }));
        } catch (err) {
          console.error('Error al cargar partidas con presupuestos:', err);
        }
      }

      setPartidas(habs);

      // Si hay al menos un anticipo, preseleccionar y preparar fila inicial limpia para este anticipo
      if (pendientes.length > 0) {
        const targetAnticipo = pendientes.find((a) => a.id === selectedAnticipoId) || pendientes[0];
        if (!selectedAnticipoId) {
          setSelectedAnticipoId(targetAnticipo.id);
        }
        setDocumentos([crearFilaInicial(targetAnticipo, habs)]);
      } else {
        setDocumentos([crearFilaInicial(null, habs)]);
      }
    } catch (error) {
      console.error('Error al cargar datos previos para rendición:', error);
    }
  };

  const anticipoSeleccionado = anticipos.find((a) => a.id === selectedAnticipoId);
  const montoAnticipoDec = anticipoSeleccionado ? new Decimal(anticipoSeleccionado.monto) : new Decimal(0);

  // Totales en tiempo real
  let totalDescargadoDec = new Decimal(0);
  for (const doc of documentos) {
    if (doc.importe && !isNaN(Number(doc.importe))) {
      totalDescargadoDec = totalDescargadoDec.plus(new Decimal(doc.importe));
    }
  }

  const montoSobranteDec = Decimal.max(0, montoAnticipoDec.minus(totalDescargadoDec));
  const excedeAnticipo = totalDescargadoDec.gt(montoAnticipoDec);

  const agregarFila = () => {
    setDocumentos((prev) => [
      ...prev,
      crearFilaInicial(anticipoSeleccionado, partidas),
    ]);
  };

  const eliminarFila = (id: string) => {
    if (documentos.length === 1) {
      notifications.show({
        color: 'yellow',
        message: 'Debe mantener al menos una fila de documento de descargo.',
      });
      return;
    }
    setDocumentos(documentos.filter((d) => d.id !== id));
  };

  const actualizarFila = (id: string, campo: keyof FacturaRow, valor: any) => {
    setDocumentos(documentos.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  };

  const handleSubmit = async () => {
    if (!selectedAnticipoId) {
      notifications.show({ color: 'red', message: 'Debe seleccionar un anticipo pendiente.' });
      return;
    }

    if (excedeAnticipo) {
      notifications.show({
        color: 'red',
        message: `El total descargado (Bs ${totalDescargadoDec.toFixed(2)}) supera el monto anticipado (Bs ${montoAnticipoDec.toFixed(2)}).`,
      });
      return;
    }

    for (const [idx, d] of documentos.entries()) {
      if (!d.numeroDocumento.trim()) {
        notifications.show({ color: 'red', message: `Fila #${idx + 1}: El número de documento es obligatorio.` });
        return;
      }
      if (!d.nitCiEmisor.trim()) {
        notifications.show({ color: 'red', message: `Fila #${idx + 1}: El NIT o CI del emisor es obligatorio.` });
        return;
      }
      if (!d.razonSocial.trim()) {
        notifications.show({ color: 'red', message: `Fila #${idx + 1}: La razón social es obligatoria.` });
        return;
      }
      if (!d.importe || Number(d.importe) <= 0) {
        notifications.show({ color: 'red', message: `Fila #${idx + 1}: El importe debe ser mayor a 0.` });
        return;
      }
      if (!d.partidaId) {
        notifications.show({ color: 'red', message: `Fila #${idx + 1}: Debe seleccionar una partida presupuestaria.` });
        return;
      }
      if (!d.concepto.trim()) {
        notifications.show({ color: 'red', message: `Fila #${idx + 1}: El concepto del gasto es obligatorio.` });
        return;
      }
    }

    setLoading(true);
    try {
      await createRendicion({
        anticipoId: selectedAnticipoId,
        fechaRendicion: new Date().toISOString().slice(0, 10),
        montoDevuelto: montoDevuelto || '0.00',
        observaciones: observaciones.trim() || undefined,
        documentos: documentos.map((d) => ({
          tipoDocumento: d.tipoDocumento,
          numeroDocumento: d.numeroDocumento,
          nitCiEmisor: d.nitCiEmisor,
          razonSocial: d.razonSocial,
          fechaEmision: d.fechaEmision,
          codigoAutorizacion: d.codigoAutorizacion || undefined,
          codigoControl: d.codigoControl || undefined,
          partidaId: d.partidaId,
          importe: d.importe,
          concepto: d.concepto,
        })),
      });

      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Rendición Creada',
        message: 'La rendición de cuentas fue registrada en estado BORRADOR.',
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        icon: <IconAlertCircle size={18} />,
        title: 'Error al Registrar Rendición',
        message: error.response?.data?.message || 'Ocurrió un error inesperado al registrar los descargos.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      title={
        <Group gap="xs">
          <IconReceipt size={22} className="text-[#007B6D]" />
          <Text fw={700} size="md" c="cpsTeal">
            Formular Rendición de Cuentas con Facturas (Formulario 002 / 5308)
          </Text>
        </Group>
      }
      centered
    >
      <Stack gap="md">
        {/* Selección de Anticipo Pendiente */}
        <Paper p="sm" withBorder radius="md" bg="#f8fafc">
          <Grid align="flex-end">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Seleccionar Anticipo Pendiente a Rendir"
                placeholder="Elija el vale de anticipo..."
                data={anticipos.map((a) => ({
                  value: a.id,
                  label: `${a.numeroVale} — Bs ${a.monto} (${a.pedido.solicitanteNombres} ${a.pedido.solicitanteApellidos})`,
                }))}
                value={selectedAnticipoId}
                onChange={(val) => {
                  setSelectedAnticipoId(val);
                  const ant = anticipos.find((a) => a.id === val);
                  // Al seleccionar o cambiar de anticipo, limpiar los descargos del anticipo previo
                  setDocumentos([crearFilaInicial(ant, partidas)]);
                  setObservaciones('');
                  setMontoDevuelto('0.00');
                }}
                required
                searchable
              />
            </Grid.Col>
            {anticipoSeleccionado && (
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed">Monto Anticipado:</Text>
                    <Text size="lg" fw={700} c="cpsTeal">
                      Bs {anticipoSeleccionado.monto}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Solicitante:</Text>
                    <Text size="xs" fw={600}>
                      {anticipoSeleccionado.pedido.solicitanteNombres} {anticipoSeleccionado.pedido.solicitanteApellidos}
                    </Text>
                    <Text size="xs" c="dimmed">{anticipoSeleccionado.pedido.solicitanteArea}</Text>
                  </div>
                </Group>
              </Grid.Col>
            )}
          </Grid>
        </Paper>

        {anticipos.length === 0 && (
          <Alert color="yellow" icon={<IconAlertCircle />}>
            No se encontraron anticipos en estado PENDIENTE para rendir en esta unidad.
          </Alert>
        )}

        {/* Tabla de Facturas y Documentos de Descargo */}
        <div>
          <Group justify="space-between" mb="xs">
            <Text fw={600} size="sm" c="cpsTeal">
              Documentos de Descargo (Facturas, Recibos Oficiales)
            </Text>
            <Button
              size="xs"
              variant="light"
              color="cpsTeal"
              leftSection={<IconPlus size={14} />}
              onClick={agregarFila}
            >
              Agregar Factura / Documento
            </Button>
          </Group>

          <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs">
              <Table.Thead bg="#f1f5f9">
                <Table.Tr>
                  <Table.Th style={{ width: 130 }}>Tipo</Table.Th>
                  <Table.Th style={{ width: 110 }}>N° Doc.</Table.Th>
                  <Table.Th style={{ width: 120 }}>NIT / CI</Table.Th>
                  <Table.Th style={{ width: 180 }}>Razón Social / Proveedor</Table.Th>
                  <Table.Th style={{ width: 120 }}>Fecha</Table.Th>
                  <Table.Th style={{ width: 240, minWidth: 220 }}>Partida Presupuestaria *</Table.Th>
                  <Table.Th style={{ width: 120 }}>Importe (Bs)</Table.Th>
                  <Table.Th>Concepto / Detalle</Table.Th>
                  <Table.Th style={{ width: 45 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {documentos.map((doc, index) => (
                  <Table.Tr key={doc.id}>
                    <Table.Td>
                      <Select
                        size="xs"
                        data={[
                          { value: 'FACTURA_COMPRA', label: 'Factura Compra' },
                          { value: 'RECIBO_OFICIAL', label: 'Recibo Oficial' },
                          { value: 'OTRO_AUTORIZADO', label: 'Otro Autorizado' },
                        ]}
                        value={doc.tipoDocumento}
                        onChange={(val: any) => actualizarFila(doc.id, 'tipoDocumento', val)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="Ej. 10482"
                        value={doc.numeroDocumento}
                        onChange={(e) => actualizarFila(doc.id, 'numeroDocumento', e.target.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="Ej. 1029384"
                        value={doc.nitCiEmisor}
                        onChange={(e) => actualizarFila(doc.id, 'nitCiEmisor', e.target.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="Nombre comercial"
                        value={doc.razonSocial}
                        onChange={(e) => actualizarFila(doc.id, 'razonSocial', e.target.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <DateInputBO
                        size="xs"
                        value={doc.fechaEmision}
                        onChange={(val) => actualizarFila(doc.id, 'fechaEmision', val)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        placeholder={partidas.length === 0 ? 'Sin partidas...' : 'Seleccionar partida...'}
                        searchable
                        clearable={false}
                        data={partidas.map((p) => ({
                          value: p.id,
                          label: `${p.codigo} - ${p.descripcion}`,
                        }))}
                        value={doc.partidaId}
                        onChange={(val: any) => actualizarFila(doc.id, 'partidaId', val || '')}
                        comboboxProps={{ withinPortal: true, zIndex: 1000 }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="0.00"
                        value={doc.importe}
                        onChange={(e) => actualizarFila(doc.id, 'importe', e.target.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="Detalle del bien o servicio"
                        value={doc.concepto}
                        onChange={(e) => actualizarFila(doc.id, 'concepto', e.target.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        size="sm"
                        onClick={() => eliminarFila(doc.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </div>

        {/* Resumen de Liquidación y Sobrante */}
        <Paper p="sm" withBorder radius="md" bg={excedeAnticipo ? '#fef2f2' : '#f0fdf4'}>
          <Grid align="center">
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Text size="xs" c="dimmed">Total Facturado Descargado:</Text>
              <Text size="lg" fw={700} c={excedeAnticipo ? 'red' : 'dark'}>
                Bs {totalDescargadoDec.toFixed(2)}
              </Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Text size="xs" c="dimmed">Sobrante a Devolver:</Text>
              <Text size="lg" fw={700} c="cpsTeal">
                Bs {montoSobranteDec.toFixed(2)}
              </Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                label="Efectivo Devuelto Físicamente a Caja (Bs)"
                description="Ingreso real devuelto a caja chica"
                value={montoDevuelto}
                onChange={(e) => setMontoDevuelto(e.target.value)}
                size="xs"
              />
            </Grid.Col>
          </Grid>
          {excedeAnticipo && (
            <Text size="xs" c="red" fw={600} mt="xs">
              * El total de facturas supera el monto del anticipo entregado. Reduzca los importes o retire las facturas no autorizadas.
            </Text>
          )}
        </Paper>

        <TextInput
          label="Observaciones Generales"
          placeholder="Notas adicionales para la aprobación financiera..."
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            color="cpsTeal"
            onClick={handleSubmit}
            loading={loading}
            disabled={anticipos.length === 0 || excedeAnticipo}
          >
            Guardar Rendición (Borrador)
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
