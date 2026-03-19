/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('company-settings')
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  // 1️⃣ Récupérer les paramètres de l'entreprise (tous les utilisateurs)
  @Get()
  @ApiOperation({ summary: "Récupérer les paramètres de l'entreprise" })
  getCompanySettings() {
    return this.companySettingsService.getCompanySettings();
  }

  // 2️⃣ Mettre à jour les paramètres (Admin uniquement)
  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: "Mettre à jour les paramètres de l'entreprise (Admin uniquement)",
  })
  updateCompanySettings(
    @Req() req: any,
    @Body() updateCompanySettingsDto: UpdateCompanySettingsDto,
  ) {
    return this.companySettingsService.updateCompanySettings(
      req.user.id,
      updateCompanySettingsDto,
    );
  }
}
