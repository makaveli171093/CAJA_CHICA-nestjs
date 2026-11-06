import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AprobarReposicionDto {
  @ApiProperty({ description: 'Observaciones de la aprobación financiera', required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class RechazarReposicionDto {
  @ApiProperty({ description: 'Motivo fundamentado del rechazo' })
  @IsNotEmpty({ message: 'El motivo del rechazo es obligatorio para conocimiento del encargado.' })
  @IsString()
  motivo: string;
}

export class EfectuarReposicionDto {
  @ApiProperty({ description: 'Número de cheque o comprobante de transferencia institucional DAF/SIGEP' })
  @IsNotEmpty({ message: 'El número de comprobante o cheque de reposición es obligatorio.' })
  @IsString()
  comprobantePago: string;

  @ApiProperty({ description: 'Banco de la cuenta origen (ej. Banco Unión)', required: false })
  @IsOptional()
  @IsString()
  bancoOrigen?: string;

  @ApiProperty({ description: 'Observaciones finales de la reposición', required: false })
  @IsOptional()
  @IsString()
  observaciones?: string;
}
