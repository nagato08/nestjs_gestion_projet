import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateCompanySettingsDto {
  @ApiProperty({
    example: 'Ma Super Entreprise',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiProperty({
    example: '#3B82F6',
    description: 'Couleur principale en hexadécimal',
    required: false,
  })
  @IsOptional()
  @IsString()
  primaryColor?: string;
}
