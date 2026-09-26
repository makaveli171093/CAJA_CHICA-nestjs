import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TogglePartidaUnidadDto {
  @ApiProperty({ description: 'ID de la partida presupuestaria a habilitar o inhabilitar' })
  @IsString()
  @IsNotEmpty({ message: 'El partidaId es obligatorio.' })
  partidaId: string;

  @ApiProperty({ description: 'Estado habilitado (true) o inhabilitado (false)' })
  @IsBoolean()
  activo: boolean;
}
