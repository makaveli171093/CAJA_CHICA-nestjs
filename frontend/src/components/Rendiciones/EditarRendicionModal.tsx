import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Select,
  TextInput,
  Textarea,
  Table,
  ActionIcon,
  Paper,
  Divider,
  Alert,
  Badge,
  Grid,
  Loader,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconReceipt,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import Decimal from 'decimal.js';
import { api, getRendicion, corregirRendicion } from '../../services/api';
import { Partida, TipoDocumentoDescargo, Rendicion } from '../../types';
import { DateInputBO } from '../common/DateInputBO';
import { formatDateToBO } from '../../utils/dateUtils';

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

interface EditarRendicionModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rendicionId: string | null;
  unidadId: string;
  gestion: number;
}

export const EditarRendicionModal: React.FC<EditarRendicionModalProps> = ({
  opened,
  onClose,
  onSuccess,
  rendicionId,
  unidadId,
  gestion,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [rendicion, setRendicion] = useState<Rendicion | null>(null);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [justificacion, setJustificacion] = useState<string>('');
  const [fechaRendicion, setFechaRendicion] = useState<string>('');
  const [montoDevuelto, setMontoDevuelto] = useState<string>('0.00');
  const [observaciones, setObservaciones] = useState<string>('');
  const [documentos, setDocumentos] = useState<FacturaRow[]>([]);

  useEffect(() => {
    if (opened && rendicionId && unidadId) {
      cargarDatosRendicion();
    } else if (!opened) {
      setRendicion(null);
      setJustificacion('');
      setDocumentos([]);
      setObservaciones('');
      setMontoDevuelto('0.00');
    }
  }, [opened, rendicionId, unidadId, gestion]);

  const cargarDatosRendicion = async () => {
    if (!rendicionId) return;
    setLoading(true);
    try {
      // Cargar rendición y partidas en paralelo para acelerar la carga
      const [data, partidasRes] = await Promise.all([
        getRendicion(rendicionId) as Promise<Rendicion>,
        api.get(`/unidades/${unidadId}/partidas-habilitadas`).catch((err) => {
          console.warn('Error al cargar /unidades/partidas-habilitadas:', err);
          return { data: [] };
        }),
      ]);

      setRendicion(data);
      setFechaRendicion(data.fechaRendicion ? data.fechaRendicion.slice(0, 10) : '');
      setMontoDevuelto(data.montoDevuelto || '0.00');
      setObservaciones(data.observaciones || '');
      setJustificacion('');

      // Cargar documentos existentes
      if (data.documentos && data.documentos.length > 0) {
        setDocumentos(
          data.documentos.map((d) => ({
            id: d.id,
            tipoDocumento: d.tipoDocumento,
            numeroDocumento: d.numeroDocumento,
            nitCiEmisor: d.nitCiEmisor,
            razonSocial: d.razonSocial,
            fechaEmision: d.fechaEmision.slice(0, 10),
            codigoAutorizacion: d.codigoAutorizacion || '',
            codigoControl: d.codigoControl || '',
            partidaId: d.partidaId,
            importe: d.importe,
            concepto: d.concepto,
          }))
        );
      } else {
        setDocumentos([crearFilaVacia()]);
      }

      // Procesar partidas habilitadas
      let habs: Partida[] = [];
      const items = Array.isArray(partidasRes.data)
        ? partidasRes.data
        : partidasRes.data?.items || [];
      habs = items
        .filter((it: any) => it.habilitado !== false)
        .map((it: any) => ({
          id: it.partidaId || it.id,
          codigo: it.codigo,
          descripcion: it.descripcion,
          activo: true,
        }));

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
          console.error('Error al cargar partidas con presupuesto:', err);
        }
      }
      setPartidas(habs);
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Error de carga',
        message: error.response?.data?.message || 'No se pudieron cargar los datos de la rendición.',
      });
    } finally {
      setLoading(false);
    }
  };

  const crearFilaVacia = (): FacturaRow => {
    const pedido = rendicion?.anticipo?.pedido;
    const defaultPartidaId = (pedido as any)?.partidaId || pedido?.partida?.id || (partidas.length > 0 ? partidas[0].id : '');
    const defaultConcepto = (pedido as any)?.descripcion || '';
    return {
      id: String(Date.now() + Math.random()),
      tipoDocumento: 'FACTURA_COMPRA',
      numeroDocumento: '',
      nitCiEmisor: '',
      razonSocial: '',
      fechaEmision: new Date().toISOString().slice(0, 10),
      codigoAutorizacion: '',
      codigoControl: '',
      partidaId: defaultPartidaId,
      importe: '',
      concepto: defaultConcepto,
    };
  };

  const montoAnticipoDec = rendicion ? new Decimal(rendicion.montoAnticipo) : new Decimal(0);

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
    setDocumentos((prev) => [...prev, crearFilaVacia()]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rendicionId) return;

    if (!justificacion.trim() || justificacion.trim().length < 10) {
      notifications.show({
        color: 'red',
        title: 'Justificación insuficiente',
        message: 'Debe ingresar un justificativo formal obligatorio de al menos 10 caracteres para la auditoría.',
      });
      return;
    }

    if (excedeAnticipo) {
      notifications.show({
        color: 'red',
        title: 'Importe excedido',
        message: `El total descargado (Bs ${totalDescargadoDec.toFixed(2)}) supera el monto anticipado (Bs ${montoAnticipoDec.toFixed(2)}).`,
      });
      return;
    }

    const devueltoNum = Number(montoDevuelto);
    if (isNaN(devueltoNum) || devueltoNum < 0) {
      notifications.show({
        color: 'red',
        title: 'Monto devuelto inválido',
        message: 'El monto de efectivo devuelto no puede ser negativo.',
      });
      return;
    }

    if (new Decimal(devueltoNum).gt(montoSobranteDec)) {
      notifications.show({
        color: 'red',
        title: 'Monto devuelto superior al sobrante',
        message: `El efectivo devuelto (Bs ${devueltoNum.toFixed(2)}) no puede exceder el sobrante real calculado (Bs ${montoSobranteDec.toFixed(2)}).`,
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

    setIsSubmitting(true);
    try {
      await corregirRendicion(rendicionId, {
        justificacion: justificacion.trim(),
        fechaRendicion,
        montoDevuelto: new Decimal(devueltoNum).toFixed(2),
        observaciones: observaciones.trim() || undefined,
        documentos: documentos.map((d) => ({
          tipoDocumento: d.tipoDocumento,
          numeroDocumento: d.numeroDocumento.trim(),
          nitCiEmisor: d.nitCiEmisor.trim(),
          razonSocial: d.razonSocial.trim(),
          fechaEmision: d.fechaEmision,
          codigoAutorizacion: d.codigoAutorizacion?.trim() || undefined,
          codigoControl: d.codigoControl?.trim() || undefined,
          partidaId: d.partidaId,
          importe: new Decimal(d.importe).toFixed(2),
          concepto: d.concepto.trim(),
        })),
      });

      notifications.show({
        color: 'teal',
        icon: <IconCheck size={18} />,
        title: 'Rendición Corregida',
        message: 'Las modificaciones y la justificación fueron asentadas exitosamente en la bitácora de auditoría.',
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      notifications.show({
        color: 'red',
        icon: <IconAlertCircle size={18} />,
        title: 'Error al Corregir Rendición',
        message: error.response?.data?.message || 'Ocurrió un error al guardar las modificaciones.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      title={
        <Group gap="xs">
          <IconEdit size={22} color="#ea580c" />
          <Text fw={700} size="md" c="#1e293b">
            Corregir Rendición de Cuentas [{rendicion?.numeroRendicion || '...'}]
          </Text>
        </Group>
      }
      centered
    >
      {loading ? (
        <Box py="xl" ta="center">
          <Loader color="cpsTeal" size="md" />
          <Text size="sm" c="dimmed" mt="xs">
            Cargando datos de la rendición y partidas...
          </Text>
        </Box>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="orange"
              title="Fase de Pruebas: Edición Total de Rendición Habilitada"
            >
              Conforme a la fase de pruebas, se habilita la edición completa de facturas, fechas, importes, partidas y sobrantes para Administradores y Encargados. Toda rectificación recalcula automáticamente los totales, sincroniza los movimientos de efectivo y se registra con auditoría formal.
            </Alert>

            {/* Justificación obligatoria */}
            <Textarea
              label="Motivo o Justificación Formal de la Corrección *"
              placeholder="Indique la causa del error, informe de respaldo o justificativo formal del cambio en la rendición..."
              minRows={2}
              required
              value={justificacion}
              onChange={(e) => setJustificacion(e.currentTarget.value)}
            />

            {/* Información del Anticipo Vinculado */}
            {rendicion?.anticipo && (
              <Paper p="sm" withBorder radius="md" bg="#f8fafc">
                <Grid align="center">
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Text size="xs" c="dimmed">Vale de Anticipo Vinculado:</Text>
                    <Text fw={700} c="cpsTeal">{rendicion.anticipo.numeroVale}</Text>
                    <Text size="xs" c="dimmed">
                      Monto Anticipado: <strong>Bs {rendicion.montoAnticipo}</strong>
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Text size="xs" c="dimmed">Solicitante del Gasto:</Text>
                    <Text size="xs" fw={600}>
                      {rendicion.anticipo.pedido?.solicitanteNombres || ''} {rendicion.anticipo.pedido?.solicitanteApellidos || ''}
                    </Text>
                    <Text size="xs" c="dimmed">{rendicion.anticipo.pedido?.solicitanteArea || ''}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Text size="xs" c="dimmed">Estado de la Rendición:</Text>
                    <Badge color="orange" variant="light">
                      {rendicion.estado}
                    </Badge>
                  </Grid.Col>
                </Grid>
              </Paper>
            )}

            {/* Fechas y Devolución */}
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <DateInputBO
                  label="Fecha Oficial de Formulación de Rendición *"
                  required
                  value={fechaRendicion}
                  onChange={setFechaRendicion}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Efectivo Devuelto Físicamente a Caja (Bs.) *"
                  required
                  placeholder="0.00"
                  value={montoDevuelto}
                  onChange={(e) => setMontoDevuelto(e.currentTarget.value)}
                />
              </Grid.Col>
            </Grid>

            {/* Documentos de Descargo */}
            <Divider label="Facturas y Documentos de Descargo" labelPosition="left" />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Modifique las facturas existentes, agregue nuevos descargos o retire filas erróneas.
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
                  {documentos.map((doc) => (
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
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={() => eliminarFila(doc.id)}
                          title="Eliminar fila"
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>

            {/* Resumen numérico */}
            <Paper p="sm" withBorder radius="md" bg="#f8fafc">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">Total Facturado Descargado:</Text>
                  <Text size="md" fw={700} c={excedeAnticipo ? 'red' : 'dark'}>
                    Bs {totalDescargadoDec.toFixed(2)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Sobrante Real a Devolver:</Text>
                  <Text size="md" fw={700} c="cpsTeal">
                    Bs {montoSobranteDec.toFixed(2)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Efectivo Devuelto a Caja:</Text>
                  <Text size="md" fw={700} c="blue">
                    Bs {Number(montoDevuelto || 0).toFixed(2)}
                  </Text>
                </div>
              </Group>
            </Paper>

            {/* Observaciones */}
            <Textarea
              label="Observaciones Generales"
              placeholder="Notas aclaratorias adicionales de la rendición..."
              minRows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.currentTarget.value)}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                color="orange"
                leftSection={<IconCheck size={16} />}
                loading={isSubmitting}
              >
                Guardar Corrección de Rendición
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
};
