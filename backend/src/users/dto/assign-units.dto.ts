import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignUnitsDto {
  @ApiProperty({ description: 'Array con los IDs de las unidades autorizadas para este usuario', type: [String] })
  @IsArray({ message: 'Las unidades deben especificarse como un arreglo de identificadores.' })
  @IsString({ each: true, message: 'Cada identificador de unidad debe ser una cadena de texto.' })
  unitIds: string[];
}
