import * as fs from 'fs';
import * as path from 'path';
import { ValePdfService, DatosVale001 } from '../pedidos/services/vale-pdf.service';

async function main() {
  const service = new ValePdfService();

  const datosMuestra: DatosVale001 = {
    numeroVale: 'VALE-001-ADM-ARCE-2026-0001',
    gestion: 2026,
    unidadCodigo: 'ADM-ARCE',
    unidadNombre: 'ADMINISTRACION POLICONSULTORIO ARCE',
    lugar: 'La Paz',
    fechaEmision: '28 de Septiembre de 2026',
    fechaEntrega: new Date().toISOString(),
    numeroPedido: 'PED-045/2026',
    solicitante: {
      nombres: 'María Elena',
      apellidos: 'Mamani Quispe',
      ci: '4892145 LP',
      area: 'Servicio de Odontología y Consulta Externa',
    },
    receptor: {
      nombres: 'Carlos Alberto',
      apellidos: 'Fernández Morales',
      ci: '6123984 LP',
    },
    descripcion: 'Adquisición de insumos odontológicos menores y papel toalla para esterilización de urgencia.',
    motivo: 'Atención prioritaria de pacientes en la semana aniversario y reposición temporal por demora de almacén central.',
    partidaCodigo: '34200',
    partidaDescripcion: 'Productos Químicos y Farmacéuticos',
    monto: '450.00',
    montoLiteral: 'BOLIVIANOS CUATROCIENTOS CINCUENTA 00/100',
    referenciaRepMat: 'REP-MAT-089/2026',
    observaciones: 'Compra autorizada fuera de sistema según Nota Interna DAF N° 124/2026.',
    custodio: {
      nombres: 'Ángel',
      apellidos: 'Linares',
      ci: '5928174 LP',
      cargo: 'Responsable de Caja Chica Arce',
      documentoDesignacion: 'MEMO-DAF-015/2026',
    },
    entregadoPor: {
      nombreCompleto: 'Ángel Linares',
      username: 'alinares',
    },
  };

  console.log('Generando Formulario 001 de muestra con Puppeteer...');
  const pdfBuffer = await service.generatePdf(datosMuestra);

  const outputDir = path.resolve(__dirname, '../../../docs/muestras');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'formulario-001-muestra.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);

  console.log(`PDF Formulario 001 generado con éxito: ${outputPath}`);
  console.log(`Tamaño del archivo: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
}

main().catch((err) => {
  console.error('Error generando PDF de muestra:', err);
  process.exit(1);
});
