import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddProjectMemberDto {
  @ApiProperty({ example: 'cuid_user' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
