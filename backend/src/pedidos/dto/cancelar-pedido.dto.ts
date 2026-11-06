import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelarPedidoDto {
  @ApiProperty({
    description: 'Motivo fundamentado de la cancelación del pedido en borrador',
    example: 'Anulado a solicitud del área requirente por cambio de especificación técnica',
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio.' })
  @MaxLength(500)
  motivoCancelacion: string;
}
