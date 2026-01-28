import { Module } from '@nestjs/common';
import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CompanySettingsController],
  providers: [CompanySettingsService, PrismaService],
  exports: [CompanySettingsService],
})
export class CompanySettingsModule {}
