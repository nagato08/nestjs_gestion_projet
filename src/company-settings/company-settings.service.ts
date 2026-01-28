/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { Role } from '@prisma/client';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UTILITAIRE : Vérifie que l'utilisateur est admin
   */
  private async verifyAdminAccess(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== Role.ADMIN) {
      throw new NotFoundException('Accès réservé aux administrateurs');
    }
  }

  // 1️⃣ Récupérer les paramètres de l'entreprise
  async getCompanySettings() {
    let settings = await this.prisma.companySettings.findUnique({
      where: { id: 'global' },
    });

    // Si les paramètres n'existent pas, les créer avec des valeurs par défaut
    if (!settings) {
      settings = await this.prisma.companySettings.create({
        data: {
          id: 'global',
          companyName: null,
          logoUrl: null,
          primaryColor: null,
        },
      });
    }

    return settings;
  }

  // 2️⃣ Mettre à jour les paramètres de l'entreprise (Admin uniquement)
  async updateCompanySettings(userId: string, dto: UpdateCompanySettingsDto) {
    await this.verifyAdminAccess(userId);

    // Vérifier si les paramètres existent
    let settings = await this.prisma.companySettings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      // Créer les paramètres s'ils n'existent pas
      settings = await this.prisma.companySettings.create({
        data: {
          id: 'global',
          ...dto,
        },
      });
    } else {
      // Mettre à jour les paramètres existants
      settings = await this.prisma.companySettings.update({
        where: { id: 'global' },
        data: dto,
      });
    }

    return settings;
  }
}
