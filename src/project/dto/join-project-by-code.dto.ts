import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class JoinProjectByCodeDto {
  @ApiProperty({ example: 'CODE-XYZ-2025' })
  @IsNotEmpty()
  @IsString()
  projectCode: string;
}
