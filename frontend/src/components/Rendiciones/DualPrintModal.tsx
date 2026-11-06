import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  SegmentedControl,
  NumberInput,
  Paper,
  Divider,
  Alert,
  Badge,
  Loader,
  Box,
} from '@mantine/core';
import {
  IconPrinter,
  IconAdjustments,
  IconFileText,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { getDatosReporteImpresion } from '../../services/api';
import { DatosReporteImpresionDual } from '../../types';

interface DualPrintModalProps {
  opened: boolean;
  onClose: () => void;
  rendicionId: string | null;
}

export const DualPrintModal: React.FC<DualPrintModalProps> = ({
  opened,
  onClose,
  rendicionId,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<DatosReporteImpresionDual | null>(null);
  const [printMode, setPrintMode] = useState<'preimpreso' | 'hoja_blanca'>('preimpreso');

  // Calibración milimétrica persistente por impresora
  const [offsetX, setOffsetX] = useState<number>(() => {
    return Number(localStorage.getItem('cps_print_offset_x') || 0);
  });
  const [offsetY, setOffsetY] = useState<number>(() => {
    return Number(localStorage.getItem('cps_print_offset_y') || 0);
  });

  useEffect(() => {
    if (opened && rendicionId) {
      cargarDatos(rendicionId);
    } else {
      setData(null);
    }
  }, [opened, rendicionId]);

  const cargarDatos = async (id: string) => {
    setLoading(true);
    try {
      const res = await getDatosReporteImpresion(id);
      setData(res);
    } catch (error) {
      console.error('Error al cargar datos de impresión dual:', error);
    } finally {
      setLoading(false);
    }
  };

  const guardarCalibracion = (newX: number, newY: number) => {
    setOffsetX(newX);
    setOffsetY(newY);
    localStorage.setItem('cps_print_offset_x', String(newX));
    localStorage.setItem('cps_print_offset_y', String(newY));
  };

  const handlePrint = () => {
    window.print();
  };

  if (!opened) return null;

  const r = data?.rendicion;
  const coords = data?.coordenadasPreimpreso;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      title={
        <Group gap="xs">
          <IconPrinter size={22} className="text-[#007B6D]" />
          <Text fw={700} size="md" c="cpsTeal">
            Motor de Impresión Dual — Formulario 002 / 5308
          </Text>
          {r && (
            <Badge variant="filled" color="teal">
              {r.numeroRendicion}
            </Badge>
          )}
        </Group>
      }
      centered
      classNames={{
        body: 'p-4',
      }}
    >
      {loading ? (
        <Stack align="center" py="xl">
          <Loader color="cpsTeal" size="md" />
          <Text size="sm" c="dimmed">
            Cargando y estructurando coordenadas de impresión...
          </Text>
        </Stack>
      ) : !data || !r ? (
        <Alert color="red" icon={<IconAlertCircle />}>
          No se pudieron cargar los datos de la rendición seleccionada.
        </Alert>
      ) : (
        <Stack gap="md">
          {/* Controles de Configuración de Impresión */}
          <Paper p="sm" withBorder radius="md" bg="#f8fafc" className="print:hidden">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  Modalidad de Salida
                </Text>
                <SegmentedControl
                  value={printMode}
                  onChange={(val: any) => setPrintMode(val)}
                  data={[
                    {
                      value: 'preimpreso',
                      label: (
                        <Group gap={4}>
                          <IconFileText size={16} />
                          <span>Sobre Papel Preimpreso (Solo Datos)</span>
                        </Group>
                      ),
                    },
                    {
                      value: 'hoja_blanca',
                      label: (
                        <Group gap={4}>
                          <IconCheck size={16} />
                          <span>Hoja Blanca Completa</span>
                        </Group>
                      ),
                    },
                  ]}
                  color="teal"
                  size="xs"
                />
              </Group>

              {printMode === 'preimpreso' && (
                <>
                  <Divider />
                  <Group align="flex-end" gap="md">
                    <Group gap="xs" align="center">
                      <IconAdjustments size={16} className="text-[#007B6D]" />
                      <Text size="xs" fw={600}>
                        Calibración de Arrastre de Impresora:
                      </Text>
                    </Group>
                    <NumberInput
                      label="Desplazamiento Horizontal (X)"
                      description="+ a la derecha, - a la izquierda (mm)"
                      value={offsetX}
                      onChange={(val) => guardarCalibracion(Number(val) || 0, offsetY)}
                      step={0.5}
                      decimalScale={1}
                      size="xs"
                      w={170}
                    />
                    <NumberInput
                      label="Desplazamiento Vertical (Y)"
                      description="+ hacia abajo, - hacia arriba (mm)"
                      value={offsetY}
                      onChange={(val) => guardarCalibracion(offsetX, Number(val) || 0)}
                      step={0.5}
                      decimalScale={1}
                      size="xs"
                      w={170}
                    />

                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => guardarCalibracion(0, 0)}
                    >
                      Restablecer (0, 0)
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    * El modo preimpreso inyecta únicamente los números, textos y fechas en las coordenadas exactas de la plantilla física sin imprimir recuadros ni logos.
                  </Text>
                </>
              )}
            </Stack>
          </Paper>

          {/* Área de Visualización y Contenedor de Impresión */}
          <Box
            id="dual-printable-area"
            style={{
              position: 'relative',
              width: '215.9mm',
              minHeight: '279.4mm',
              margin: '0 auto',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: printMode === 'hoja_blanca' ? '15mm' : '0',
              overflow: 'hidden',
              fontFamily: "'Inter', sans-serif",
            }}
            className="border border-slate-200 text-slate-800"
          >
            {printMode === 'preimpreso' ? (
              /* MODO 1: SOLO DATOS EN COORDENADAS MILIMÉTRICAS EXACTAS SOBRE HOJA PREIMPRESA */
              <Box
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '279.4mm',
                  transform: `translate(${offsetX}mm, ${offsetY}mm)`,
                }}
              >
                {/* Datos de cabecera */}
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.unidadNombre.topMm}mm`,
                    left: `${coords.unidadNombre.leftMm}mm`,
                    fontSize: '11pt',
                    fontWeight: 600,
                  }}
                >
                  {r.unidad.nombre} ({r.unidad.codigo})
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.gestion.topMm}mm`,
                    left: `${coords.gestion.leftMm}mm`,
                    fontSize: '11pt',
                    fontWeight: 600,
                  }}
                >
                  {r.gestion}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.numeroRendicion.topMm}mm`,
                    left: `${coords.numeroRendicion.leftMm}mm`,
                    fontSize: '11pt',
                    fontWeight: 700,
                  }}
                >
                  {r.numeroRendicion}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.fechaRendicion.topMm}mm`,
                    left: `${coords.fechaRendicion.leftMm}mm`,
                    fontSize: '10pt',
                  }}
                >
                  {r.fechaRendicion}
                </span>

                {/* Solicitante y anticipo */}
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.solicitante.topMm}mm`,
                    left: `${coords.solicitante.leftMm}mm`,
                    fontSize: '10pt',
                  }}
                >
                  {r.solicitante.nombreCompleto} (CI: {r.solicitante.ci})
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.numeroVale.topMm}mm`,
                    left: `${coords.numeroVale.leftMm}mm`,
                    fontSize: '10pt',
                    fontWeight: 600,
                  }}
                >
                  {r.anticipo.numeroVale}
                </span>

                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.montoAnticipoCifras.topMm}mm`,
                    left: `${coords.montoAnticipoCifras.leftMm}mm`,
                    fontSize: '11pt',
                    fontWeight: 700,
                  }}
                >
                  Bs {r.anticipo.monto}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.montoAnticipoLetras.topMm}mm`,
                    left: `${coords.montoAnticipoLetras.leftMm}mm`,
                    fontSize: '9pt',
                    fontWeight: 500,
                  }}
                >
                  {r.anticipo.montoLiteral}
                </span>

                {/* Filas de la tabla de documentos de descargo */}
                {r.documentos.map((doc, idx) => {
                  const filaTop = coords.tablaInicioTopMm + idx * coords.filaAltoMm;
                  return (
                    <React.Fragment key={idx}>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.item.leftMm}mm`,
                          fontSize: '9pt',
                        }}
                      >
                        {doc.item}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.fecha.leftMm}mm`,
                          fontSize: '9pt',
                        }}
                      >
                        {doc.fechaEmision}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.facturaNro.leftMm}mm`,
                          fontSize: '9pt',
                          fontWeight: 600,
                        }}
                      >
                        {doc.numeroDocumento}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.nitCi.leftMm}mm`,
                          fontSize: '9pt',
                        }}
                      >
                        {doc.nitCiEmisor}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.proveedor.leftMm}mm`,
                          fontSize: '9pt',
                          width: `${coords.columnas.proveedor.widthMm}mm`,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.razonSocial}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.partida.leftMm}mm`,
                          fontSize: '9pt',
                          fontWeight: 600,
                        }}
                      >
                        {doc.partidaCodigo}
                      </span>
                      <span
                        style={{
                          position: 'absolute',
                          top: `${filaTop}mm`,
                          left: `${coords.columnas.importe.leftMm}mm`,
                          fontSize: '9pt',
                          fontWeight: 700,
                          textAlign: 'right',
                          width: '25mm',
                        }}
                      >
                        {doc.importe}
                      </span>
                    </React.Fragment>
                  );
                })}

                {/* Totales y Liquidación */}
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.totalDescargado.topMm}mm`,
                    left: `${coords.totalDescargado.leftMm}mm`,
                    fontSize: '11pt',
                    fontWeight: 700,
                    textAlign: 'right',
                    width: '25mm',
                  }}
                >
                  Bs {r.totales.totalDescargado}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.montoSobrante.topMm}mm`,
                    left: `${coords.montoSobrante.leftMm}mm`,
                    fontSize: '10pt',
                    textAlign: 'right',
                    width: '25mm',
                  }}
                >
                  Bs {r.totales.montoSobrante}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.montoDevuelto.topMm}mm`,
                    left: `${coords.montoDevuelto.leftMm}mm`,
                    fontSize: '10pt',
                    fontWeight: 700,
                    textAlign: 'right',
                    width: '25mm',
                  }}
                >
                  Bs {r.totales.montoDevuelto}
                </span>

                {/* Nombres bajo las casillas de firma */}
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.firmaEncargado.topMm}mm`,
                    left: `${coords.firmaEncargado.leftMm}mm`,
                    fontSize: '8pt',
                    textAlign: 'center',
                    width: `${coords.firmaEncargado.widthMm}mm`,
                  }}
                >
                  {r.firmas.encargadoNombre}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.firmaSolicitante.topMm}mm`,
                    left: `${coords.firmaSolicitante.leftMm}mm`,
                    fontSize: '8pt',
                    textAlign: 'center',
                    width: `${coords.firmaSolicitante.widthMm}mm`,
                  }}
                >
                  {r.firmas.solicitanteNombre}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${coords.firmaFinanciero.topMm}mm`,
                    left: `${coords.firmaFinanciero.leftMm}mm`,
                    fontSize: '8pt',
                    textAlign: 'center',
                    width: `${coords.firmaFinanciero.widthMm}mm`,
                  }}
                >
                  {r.firmas.financieroNombre}
                </span>
              </Box>
            ) : (
              /* MODO 2: PLANTILLA COMPLETA PARA HOJA EN BLANCO */
              <Stack gap="sm">
                {/* Encabezado Institucional */}
                <div className="flex justify-between items-start border-b-2 border-[#007B6D] pb-2">
                  <div>
                    <h2 className="text-base font-bold text-[#007B6D] uppercase tracking-wide">
                      Caja Petrolera de Salud
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Dirección Administrativa Financiera — Sistema de Caja Chica
                    </p>
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      {r.unidad.nombre} ({r.unidad.codigo}) — Gestión Fiscal {r.gestion}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-teal-50 border border-teal-200 text-[#007B6D] font-bold text-xs px-2.5 py-1 rounded">
                      FORMULARIO 002 / 5308
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-1">
                      {r.numeroRendicion}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Fecha: {r.fechaRendicionTexto}
                    </p>
                  </div>
                </div>

                {/* Datos del Anticipo y Solicitante */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div>
                    <span className="text-slate-500">Solicitante: </span>
                    <span className="font-semibold text-slate-800">{r.solicitante.nombreCompleto}</span>
                    <br />
                    <span className="text-slate-500">Área / Depto: </span>
                    <span className="text-slate-700">{r.solicitante.area}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Vale de Anticipo: </span>
                    <span className="font-bold text-[#007B6D]">{r.anticipo.numeroVale}</span>
                    <br />
                    <span className="text-slate-500">Monto Anticipado: </span>
                    <span className="font-bold text-slate-900">Bs {r.anticipo.monto}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 text-[11px] text-slate-600 italic">
                    {r.anticipo.montoLiteral}
                  </div>
                </div>

                {/* Tabla de Facturas y Descargos */}
                <div className="mt-1">
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-300 px-1.5 py-1 text-center w-8">#</th>
                        <th className="border border-slate-300 px-1.5 py-1 text-left w-20">Fecha</th>
                        <th className="border border-slate-300 px-1.5 py-1 text-left w-20">N° Factura</th>
                        <th className="border border-slate-300 px-1.5 py-1 text-left w-24">NIT / CI</th>
                        <th className="border border-slate-300 px-1.5 py-1 text-left">Proveedor / Razón Social</th>
                        <th className="border border-slate-300 px-1.5 py-1 text-center w-16">Partida</th>
                        <th className="border border-slate-300 px-1.5 py-1 text-right w-24">Importe (Bs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.documentos.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-1.5 py-1 text-center">{doc.item}</td>
                          <td className="border border-slate-300 px-1.5 py-1">{doc.fechaEmision}</td>
                          <td className="border border-slate-300 px-1.5 py-1 font-semibold">{doc.numeroDocumento}</td>
                          <td className="border border-slate-300 px-1.5 py-1">{doc.nitCiEmisor}</td>
                          <td className="border border-slate-300 px-1.5 py-1">
                            <span className="font-medium text-slate-800">{doc.razonSocial}</span>
                            <p className="text-[10px] text-slate-500 truncate">{doc.concepto}</p>
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-slate-700">
                            {doc.partidaCodigo}
                          </td>
                          <td className="border border-slate-300 px-1.5 py-1 text-right font-bold text-slate-900">
                            {doc.importe}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={6} className="border border-slate-300 px-2 py-1 text-right text-slate-700">
                          TOTAL GASTO DESCARGADO:
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right text-slate-900 text-sm">
                          Bs {r.totales.totalDescargado}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="border border-slate-300 px-2 py-1 text-right text-slate-600">
                          SOBRANTE / SALDO A FAVOR:
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right text-slate-700 font-semibold">
                          Bs {r.totales.montoSobrante}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="border border-slate-300 px-2 py-1 text-right text-[#007B6D] font-bold">
                          EFECTIVO DEVUELTO FÍSICAMENTE A CAJA:
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right text-[#007B6D] font-bold text-sm">
                          Bs {r.totales.montoDevuelto}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Recuadros de Firmas Oficiales */}
                <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-200">
                  <div className="text-center">
                    <div className="h-16 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="text-xs font-bold text-slate-800">{r.firmas.solicitanteNombre}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Solicitante (Firma y Sello)</p>
                  </div>
                  <div className="text-center">
                    <div className="h-16 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="text-xs font-bold text-slate-800">{r.firmas.encargadoNombre}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Custodio / Encargado de Caja</p>
                  </div>
                  <div className="text-center">
                    <div className="h-16 border-b border-dashed border-slate-400 mb-1"></div>
                    <p className="text-xs font-bold text-slate-800">{r.firmas.financieroNombre}</p>
                    <p className="text-[10px] text-slate-500 uppercase">VoBo Aprobación Financiera (DAF)</p>
                  </div>
                </div>
              </Stack>
            )}
          </Box>

          {/* Botones de Acción */}
          <Group justify="flex-end" className="print:hidden pt-2">
            <Button variant="default" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              color="cpsTeal"
              leftSection={<IconPrinter size={18} />}
              onClick={handlePrint}
            >
              Imprimir {printMode === 'preimpreso' ? 'sobre Hoja Preimpresa' : 'Formulario Completo'}
            </Button>
          </Group>
        </Stack>
      )}

      {/* Reglas de impresión CSS para imprimir únicamente el área del formulario */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #dual-printable-area, #dual-printable-area * {
            visibility: visible;
          }
          #dual-printable-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 215.9mm !important;
            height: 279.4mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </Modal>
  );
};
