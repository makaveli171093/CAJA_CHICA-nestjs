import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsEnum,
  Matches,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoDocumentoDescargo } from '@prisma/client';
import { IsDecimalString } from '../../common/validators';

export class CorregirDocumentoDescargoDto {
  @ApiPropertyOptional({ description: 'ID del documento existente (opcional)' })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ enum: TipoDocumentoDescargo, default: TipoDocumentoDescargo.FACTURA_COMPRA })
  @IsEnum(TipoDocumentoDescargo, { message: 'Tipo de documento no válido.' })
  tipoDocumento: TipoDocumentoDescargo;

  @ApiProperty({ description: 'Número de factura, recibo o comprobante', example: '10482' })
  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio.' })
  numeroDocumento: string;

  @ApiProperty({ description: 'NIT o Carnet de Identidad del emisor', example: '1028374029' })
  @IsString()
  @IsNotEmpty({ message: 'El NIT o CI del emisor es obligatorio.' })
  nitCiEmisor: string;

  @ApiProperty({ description: 'Razón social o nombre comercial', example: 'Librería e Imprenta El Saber S.R.L.' })
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria.' })
  razonSocial: string;

  @ApiProperty({ description: 'Fecha de emisión (YYYY-MM-DD)', example: '2026-03-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de emisión debe tener formato YYYY-MM-DD.' })
  fechaEmision: string;

  @ApiPropertyOptional({ description: 'Código o número de autorización' })
  @IsOptional()
  @IsString()
  codigoAutorizacion?: string;

  @ApiPropertyOptional({ description: 'Código de control tributario si corresponde' })
  @IsOptional()
  @IsString()
  codigoControl?: string;

  @ApiProperty({ description: 'ID de la partida presupuestaria que cubre el gasto' })
  @IsUUID('4', { message: 'El ID de la partida debe ser un UUID válido.' })
  partidaId: string;

  @ApiProperty({ description: 'Importe exacto del documento (hasta 2 decimales)', example: '180.50' })
  @IsDecimalString({ min: '0.01' }, { message: 'El importe del documento debe ser un monto numérico positivo con hasta 2 decimales.' })
  importe: string;

  @ApiProperty({ description: 'Concepto o detalle de los bienes/servicios adquiridos' })
  @IsString()
  @IsNotEmpty({ message: 'El concepto o detalle del gasto es obligatorio.' })
  concepto: string;
}

export class CorregirRendicionDto {
  @ApiProperty({
    description: 'Motivo o justificación de la corrección de la rendición (auditable)',
    example: 'Corrección de error en importe de factura y partida presupuestaria',
  })
  @IsString({ message: 'La justificación debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La justificación o motivo de la corrección es obligatoria.' })
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres.' })
  justificacion: string;

  @ApiPropertyOptional({ description: 'Fecha de formulación de la rendición (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de rendición debe tener formato YYYY-MM-DD.' })
  fechaRendicion?: string;

  @ApiPropertyOptional({ description: 'Monto de efectivo sobrante devuelto físicamente a caja' })
  @IsOptional()
  @IsDecimalString({ min: '0.00' }, { message: 'El monto devuelto debe ser un número con hasta 2 decimales.' })
  montoDevuelto?: string;

  @ApiPropertyOptional({ description: 'Observaciones o aclaraciones de la rendición' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ type: [CorregirDocumentoDescargoDto], description: 'Facturas o descargos que respaldan el gasto' })
  @IsOptional()
  @IsArray({ message: 'Debe adjuntar la lista de facturas o documentos de descargo.' })
  @ValidateNested({ each: true })
  @Type(() => CorregirDocumentoDescargoDto)
  documentos?: CorregirDocumentoDescargoDto[];
}

