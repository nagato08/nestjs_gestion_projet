import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProjectExportService } from './project-export.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, ProjectExportService, PrismaService],
})
export class SearchModule {}
