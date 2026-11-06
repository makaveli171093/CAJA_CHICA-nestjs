import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsDecimalString } from '../../common/validators/is-decimal-string.validator';

export class CreatePedidoDto {
  @ApiProperty({ description: 'ID de la unidad institucional' })
  @IsString()
  @IsNotEmpty({ message: 'La unidad institucional es obligatoria.' })
  unidadId: string;

  @ApiProperty({ description: 'Gestión fiscal anual', example: 2026 })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2020, { message: 'La gestión no puede ser anterior a 2020.' })
  @Max(2100, { message: 'La gestión no puede ser posterior a 2100.' })
  gestion: number;

  @ApiProperty({ description: 'ID de la caja de apertura de origen' })
  @IsString()
  @IsNotEmpty({ message: 'La caja de apertura es obligatoria.' })
  cajaAperturaId: string;

  @ApiProperty({ description: 'ID de la partida presupuestaria' })
  @IsString()
  @IsNotEmpty({ message: 'La partida presupuestaria es obligatoria.' })
  partidaId: string;

  @ApiProperty({
    description: 'Referencia del pedido autorizado (código físico externo)',
    example: 'PED-045/2026',
  })
  @IsString()
  @IsNotEmpty({ message: 'La referencia del pedido autorizado es obligatoria.' })
  @MaxLength(100)
  numeroPedido: string;

  @ApiProperty({
    description: 'Fecha de la solicitud en formato YYYY-MM-DD',
    example: '2026-09-28',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de solicitud debe tener formato YYYY-MM-DD.',
  })
  fechaSolicitud: string;

  @ApiPropertyOptional({
    description: 'Lugar de emisión',
    example: 'La Paz',
    default: 'La Paz',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugar?: string;

  @ApiProperty({ description: 'Nombres del solicitante' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres del solicitante son obligatorios.' })
  @MaxLength(150)
  solicitanteNombres: string;

  @ApiProperty({ description: 'Apellidos del solicitante' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos del solicitante son obligatorios.' })
  @MaxLength(150)
  solicitanteApellidos: string;

  @ApiProperty({ description: 'Cédula de identidad del solicitante' })
  @IsString()
  @IsNotEmpty({ message: 'El CI del solicitante es obligatorio.' })
  @MaxLength(30)
  solicitanteCi: string;

  @ApiProperty({ description: 'Área, servicio o departamento solicitante' })
  @IsString()
  @IsNotEmpty({ message: 'El área solicitante es obligatoria.' })
  @MaxLength(150)
  solicitanteArea: string;

  @ApiProperty({ description: 'Descripción detallada del bien o servicio menor' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del bien o servicio es obligatoria.' })
  descripcion: string;

  @ApiProperty({ description: 'Destino o motivo de la adquisición menor' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la adquisición es obligatorio.' })
  motivo: string;

  @ApiProperty({ description: 'Nombres de la persona que recibe el anticipo' })
  @IsString()
  @IsNotEmpty({ message: 'Los nombres del receptor son obligatorios.' })
  @MaxLength(150)
  receptorNombres: string;

  @ApiProperty({ description: 'Apellidos de la persona que recibe el anticipo' })
  @IsString()
  @IsNotEmpty({ message: 'Los apellidos del receptor son obligatorios.' })
  @MaxLength(150)
  receptorApellidos: string;

  @ApiProperty({ description: 'Cédula de identidad de la persona que recibe el anticipo' })
  @IsString()
  @IsNotEmpty({ message: 'El CI del receptor es obligatorio.' })
  @MaxLength(30)
  receptorCi: string;

  @ApiProperty({
    description: 'Monto solicitado/entregado en bolivianos con hasta 2 decimales',
    example: '350.00',
  })
  @IsDecimalString(
    { min: '0.01', maxIntegerDigits: 12, maxDecimalDigits: 2 },
    {
      message:
        'El monto debe ser un número decimal positivo con hasta 2 decimales (ej. "350.00").',
    },
  )
  monto: string;

  @ApiPropertyOptional({
    description: 'Referencia al formulario externo REP-MAT (opcional)',
    example: 'REP-MAT-123/2026',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenciaRepMat?: string;

  @ApiPropertyOptional({ description: 'Observaciones institucionales' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
