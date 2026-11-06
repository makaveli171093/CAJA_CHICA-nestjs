import { Injectable, Logger } from '@nestjs/common';

export interface DatosVale001 {
  numeroVale: string;
  gestion: number;
  unidadCodigo: string;
  unidadNombre: string;
  lugar: string;
  fechaEmision: string; // Formato legible, ej: "28 de Septiembre de 2026"
  fechaEntrega: string;
  numeroPedido: string;
  solicitante: {
    nombres: string;
    apellidos: string;
    ci: string;
    area: string;
  };
  receptor: {
    nombres: string;
    apellidos: string;
    ci: string;
  };
  descripcion: string;
  motivo: string;
  partidaCodigo: string;
  partidaDescripcion: string;
  monto: string; // ej: "500.00"
  montoLiteral: string; // ej: "BOLIVIANOS QUINIENTOS 00/100"
  referenciaRepMat?: string | null;
  observaciones?: string | null;
  custodio: {
    nombres: string;
    apellidos: string;
    ci: string;
    cargo: string;
    documentoDesignacion: string;
  };
  entregadoPor: {
    nombreCompleto: string;
    username: string;
  };
}

@Injectable()
export class ValePdfService {
  private readonly logger = new Logger(ValePdfService.name);

  private escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  generateHtml(datos: DatosVale001): string {
    const esc = this.escapeHtml.bind(this);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Formulario 001 - Vale Provisional de Caja Chica</title>
  <style>
    @page {
      size: letter portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1a202c;
      margin: 0;
      padding: 0;
      line-height: 1.35;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #007B6D;
      margin-bottom: 12px;
    }
    .header-table td {
      padding: 8px 10px;
      vertical-align: middle;
    }
    .header-logo {
      width: 25%;
      border-right: 1.5px solid #007B6D;
      text-align: center;
    }
    .logo-badge {
      display: inline-block;
      background: #007B6D;
      color: #ffffff;
      font-weight: bold;
      font-size: 14px;
      padding: 6px 12px;
      border-radius: 4px;
      letter-spacing: 1px;
    }
    .header-title {
      width: 50%;
      text-align: center;
      border-right: 1.5px solid #007B6D;
    }
    .header-title h1 {
      margin: 0;
      font-size: 13px;
      font-weight: bold;
      color: #007B6D;
      text-transform: uppercase;
    }
    .header-title h2 {
      margin: 3px 0 0 0;
      font-size: 12px;
      font-weight: bold;
      color: #2d3748;
      text-transform: uppercase;
    }
    .header-title .subtitle {
      font-size: 9.5px;
      color: #4a5568;
      margin-top: 2px;
    }
    .header-meta {
      width: 25%;
      text-align: right;
      font-size: 9.5px;
    }
    .control-number {
      font-size: 12px;
      font-weight: bold;
      color: #c53030;
      margin-top: 2px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .meta-table td {
      padding: 4px 6px;
      border: 1px solid #cbd5e0;
      font-size: 10.5px;
    }
    .meta-label {
      background-color: #f7fafc;
      font-weight: bold;
      color: #2d3748;
      width: 20%;
    }
    .meta-value {
      color: #1a202c;
    }
    .monto-box {
      border: 1.5px solid #007B6D;
      background-color: #f0fdf9;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .monto-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .monto-literal {
      font-size: 10.5px;
      font-weight: bold;
      color: #005d52;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .section-title {
      font-size: 10.5px;
      font-weight: bold;
      color: #007B6D;
      background-color: #e6f8f5;
      padding: 4px 8px;
      border-left: 3px solid #007B6D;
      margin-top: 10px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .content-box {
      border: 1px solid #cbd5e0;
      padding: 8px 10px;
      margin-bottom: 10px;
      border-radius: 3px;
      min-height: 48px;
      background: #ffffff;
      font-size: 10.5px;
    }
    .signatures-container {
      margin-top: 35px;
      width: 100%;
    }
    .signatures-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .signatures-table td {
      border: 1px dashed #a0aec0;
      padding: 10px 6px;
      text-align: center;
      vertical-align: bottom;
      height: 110px;
      width: 25%;
    }
    .signature-line {
      border-top: 1px solid #2d3748;
      margin: 0 8px 4px 8px;
    }
    .signature-title {
      font-size: 9.5px;
      font-weight: bold;
      color: #1a202c;
      text-transform: uppercase;
    }
    .signature-name {
      font-size: 8.5px;
      color: #4a5568;
      margin-top: 2px;
    }
    .signature-ci {
      font-size: 8px;
      color: #718096;
    }
    .footer-notes {
      margin-top: 16px;
      border-top: 1px dotted #cbd5e0;
      padding-top: 6px;
      font-size: 8.5px;
      color: #718096;
      display: flex;
      justify-content: space-between;
    }
    .watermark-notice {
      background: #fffaf0;
      border: 1px solid #feebc8;
      color: #744210;
      padding: 4px 8px;
      font-size: 8.5px;
      border-radius: 3px;
      margin-top: 8px;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- Encabezado Institucional -->
  <table class="header-table">
    <tr>
      <td class="header-logo">
        <div class="logo-badge">C.P.S.</div>
        <div style="font-size: 8px; color: #4a5568; margin-top: 3px; font-weight: bold;">
          CAJA PETROLERA DE SALUD
        </div>
      </td>
      <td class="header-title">
        <h1>SISTEMA INSTITUCIONAL DE CAJA CHICA</h1>
        <h2>VALE PROVISIONAL DE CAJA CHICA</h2>
        <div class="subtitle">FORMULARIO 001 &bull; REGLAMENTO INSTITUCIONAL 002/2013</div>
      </td>
      <td class="header-meta">
        <div><strong>N° DE CONTROL:</strong></div>
        <div class="control-number">${esc(datos.numeroVale)}</div>
        <div style="margin-top: 3px; color: #4a5568;">Gestión Fiscal: <strong>${datos.gestion}</strong></div>
      </td>
    </tr>
  </table>

  <!-- Datos de Unidad, Lugar y Referencias -->
  <table class="meta-table">
    <tr>
      <td class="meta-label">UNIDAD OPERATIVA:</td>
      <td class="meta-value" style="width: 45%;"><strong>[${esc(datos.unidadCodigo)}]</strong> ${esc(datos.unidadNombre)}</td>
      <td class="meta-label" style="width: 15%;">LUGAR Y FECHA:</td>
      <td class="meta-value">${esc(datos.lugar)}, ${esc(datos.fechaEmision)}</td>
    </tr>
    <tr>
      <td class="meta-label">REF. PEDIDO FÍSICO:</td>
      <td class="meta-value"><strong>${esc(datos.numeroPedido)}</strong></td>
      <td class="meta-label">REF. REP-MAT:</td>
      <td class="meta-value">${datos.referenciaRepMat ? esc(datos.referenciaRepMat) : '<em>N/A</em>'}</td>
    </tr>
    <tr>
      <td class="meta-label">PARTIDA PRESUPUESTARIA:</td>
      <td class="meta-value" colspan="3">
        <strong>${esc(datos.partidaCodigo)}</strong> &mdash; ${esc(datos.partidaDescripcion)}
      </td>
    </tr>
  </table>

  <!-- Identificación de Solicitante, Receptor y Custodio -->
  <div class="section-title">1. IDENTIFICACIÓN DEL SOLICITANTE, RECEPTOR Y CUSTODIO</div>
  <table class="meta-table">
    <tr>
      <td class="meta-label">SOLICITANTE:</td>
      <td class="meta-value"><strong>${esc(datos.solicitante.nombres)} ${esc(datos.solicitante.apellidos)}</strong></td>
      <td class="meta-label">CARNET DE IDENTIDAD:</td>
      <td class="meta-value"><strong>${esc(datos.solicitante.ci)}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">ÁREA SOLICITANTE:</td>
      <td class="meta-value" colspan="3">${esc(datos.solicitante.area)}</td>
    </tr>
    <tr>
      <td class="meta-label">RECEPTOR DEL ANTICIPO:</td>
      <td class="meta-value"><strong>${esc(datos.receptor.nombres)} ${esc(datos.receptor.apellidos)}</strong></td>
      <td class="meta-label">CI RECEPTOR:</td>
      <td class="meta-value"><strong>${esc(datos.receptor.ci)}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">CUSTODIO DE CAJA:</td>
      <td class="meta-value" colspan="3">
        ${esc(datos.custodio.nombres)} ${esc(datos.custodio.apellidos)} &bull; CI: ${esc(datos.custodio.ci)} &bull; Cargo: ${esc(datos.custodio.cargo)}
      </td>
    </tr>
  </table>

  <!-- Descripción del Bien o Servicio y Motivo -->
  <div class="section-title">2. DETALLE DEL BIEN O SERVICIO MENOR SOLICITADO</div>
  <div class="content-box">
    <strong>Descripción:</strong> ${esc(datos.descripcion)}<br/>
    <strong style="margin-top: 4px; display: inline-block;">Destino / Justificación:</strong> ${esc(datos.motivo)}
    ${datos.observaciones ? `<br/><strong style="margin-top: 4px; display: inline-block;">Observaciones:</strong> ${esc(datos.observaciones)}` : ''}
  </div>

  <!-- Monto Entregado -->
  <div class="monto-box">
    <div class="monto-row">
      <span style="font-size: 11px; font-weight: bold; color: #007B6D;">MONTO ENTREGADO EN CALIDAD DE ANTICIPO:</span>
      <span style="font-size: 15px; font-weight: bold; color: #005d52;">Bs. ${esc(datos.monto)}</span>
    </div>
    <div class="monto-literal">SON: ${esc(datos.montoLiteral)}</div>
  </div>

  <!-- Espacios de Firmas y Sellos Institucionales -->
  <div class="section-title">3. AUTORIZACIONES INSTITUCIONALES (ESPACIOS DE FIRMA Y SELLO MANUAL)</div>
  <div class="signatures-container">
    <table class="signatures-table">
      <tr>
        <!-- 1. Solicitante -->
        <td>
          <div class="signature-line"></div>
          <div class="signature-title">Solicitante (Firma y sello)</div>
          <div class="signature-name">${esc(datos.solicitante.nombres)} ${esc(datos.solicitante.apellidos)}</div>
          <div class="signature-ci">CI: ${esc(datos.solicitante.ci)}</div>
        </td>

        <!-- 2. VoBo Jefe Inmediato Superior -->
        <td>
          <div class="signature-line"></div>
          <div class="signature-title">VoBo Jefe Inmediato Superior (Firma y sello)</div>
          <div class="signature-name">&nbsp;</div>
          <div class="signature-ci">&nbsp;</div>
        </td>

        <!-- 3. Vo Bo: Jefe Depto. Nacional Administrativo Financiero DNAF -->
        <td>
          <div class="signature-line"></div>
          <div class="signature-title">Vo Bo: Jefe Depto. Nacional Administrativo Financiero DNAF (Firma y sello)</div>
          <div class="signature-name">&nbsp;</div>
          <div class="signature-ci">&nbsp;</div>
        </td>

        <!-- 4. Vo Bo: Director Nal. Administrativo Financiero DAF -->
        <td>
          <div class="signature-line"></div>
          <div class="signature-title">Vo Bo: Director Nal. Administrativo Financiero DAF (Firma y sello)</div>
          <div class="signature-name">&nbsp;</div>
          <div class="signature-ci">&nbsp;</div>
        </td>
      </tr>
    </table>
  </div>

  <div class="watermark-notice">
    <strong>Plazo de rendición:</strong> Según Reglamento CPS 002/2013, los descargos con facturas y documentos de respaldo deben presentarse dentro del plazo máximo referencial de 48 horas tras la recepción del anticipo.<br/>
    <em style="font-size: 8px; color: #975a16;">Formato de emisión provisional &bull; Diagramación sujeta a cotejo final con la plantilla física institucional original.</em>
  </div>

  <!-- Pie de página institucional -->
  <div class="footer-notes">
    <span>Emitido por: ${esc(datos.entregadoPor.nombreCompleto)} (${esc(datos.entregadoPor.username)}) &bull; ${esc(datos.fechaEntrega)}</span>
    <span>Formulario Oficial 001 (Provisional) &bull; Caja Petrolera de Salud &bull; Copia física con valor de comprobante provisional</span>
  </div>

</body>
</html>`;
  }

  async generatePdf(datos: DatosVale001): Promise<Buffer> {
    const html = this.generateHtml(datos);
    let browser: any = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '12mm',
          bottom: '10mm',
          left: '12mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      this.logger.error(`Error generando PDF Formulario 001: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (browser) {
        await browser.close().catch((err) => {
          this.logger.warn(`Error cerrando instancia Puppeteer: ${err.message}`);
        });
      }
    }
  }
}
