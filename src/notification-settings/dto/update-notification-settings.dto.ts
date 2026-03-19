/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Activer/désactiver les notifications par email',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiProperty({
    example: true,
    description: 'Activer/désactiver les notifications en temps réel',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  realtime?: boolean;
}
