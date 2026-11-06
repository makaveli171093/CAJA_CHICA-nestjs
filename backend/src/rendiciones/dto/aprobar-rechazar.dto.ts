import { IsString, IsOptional, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AprobarRendicionDto {
  @ApiPropertyOptional({ description: 'Observaciones de la aprobación financiera', example: 'Documentación completa verificada conforme a reglamento.' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class RechazarRendicionDto {
  @ApiProperty({ description: 'Motivo del rechazo de la rendición de cuentas', example: 'La factura N° 10482 no cuenta con el sello de cancelado del proveedor.' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio.' })
  motivoRechazo: string;
}

export class DevolverRendicionBorradorDto {
  @ApiProperty({
    description: 'Motivo o justificación de la devolución a borrador para subsanación o corrección de facturas',
    example: 'Devolución para corregir número de NIT en factura de descargo según observación de DAF',
  })
  @IsString({ message: 'El motivo de devolución debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El motivo de devolución es obligatorio.' })
  @MinLength(10, { message: 'El motivo de devolución debe tener al menos 10 caracteres.' })
  motivoDevolucion: string;
}
