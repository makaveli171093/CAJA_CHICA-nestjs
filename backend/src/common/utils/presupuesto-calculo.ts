import Decimal from 'decimal.js';

export interface CalculoDisponibilidadPresupuesto {
  asignado: Decimal;
  comprometidoPendiente: Decimal;
  ejecutado: Decimal;
  disponible: Decimal;
  minimoPermitidoParaAjuste: Decimal;
}

/**
 * REGLA NORMATIVA CPS:
 * Disponible Presupuestario = Asignado - Comprometido Pendiente - Ejecutado
 *
 * LIMITACIÓN Y ALCANCE DOCUMENTADO (FASE 2A):
 * - 'comprometidoPendiente': Suma de anticipos en estado 'PENDIENTE' entregados formalmente con Vale 001.
 * - 'ejecutado': En la presente Fase 2A, los anticipos NO constituyen gasto ejecutado ni gasto documentado.
 *   El gasto ejecutado se registrará formalmente en la Fase 2B a través de los descargos y rendiciones
 *   con facturas aprobadas (Formulario 002). Por consiguiente, en esta etapa ejecutado = Bs 0.00.
 * - 'minimoPermitidoParaAjuste': Comprometido Pendiente + Ejecutado. Ninguna reducción administrativa
 *   de presupuesto puede fijar un monto asignado inferior a este umbral.
 */
export function calcularDisponibilidadPresupuesto(
  asignadoVal: Decimal.Value,
  comprometidoPendienteVal: Decimal.Value,
  ejecutadoVal: Decimal.Value = 0,
): CalculoDisponibilidadPresupuesto {
  const asignado = new Decimal(asignadoVal.toString());
  const comprometidoPendiente = new Decimal(comprometidoPendienteVal.toString());
  const ejecutado = new Decimal(ejecutadoVal.toString());

  const disponible = asignado.minus(comprometidoPendiente).minus(ejecutado);
  const minimoPermitidoParaAjuste = comprometidoPendiente.plus(ejecutado);

  return {
    asignado,
    comprometidoPendiente,
    ejecutado,
    disponible,
    minimoPermitidoParaAjuste,
  };
}
