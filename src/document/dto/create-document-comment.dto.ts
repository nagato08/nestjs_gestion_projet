import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDocumentCommentDto {
  @ApiProperty({
    example: 'Ce document nécessite une révision de la section 3',
  })
  @IsNotEmpty()
  @IsString()
  content: string;
}
