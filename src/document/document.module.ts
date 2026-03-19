import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryService } from '../cloudinary.service';

@Module({
  controllers: [DocumentController],
  providers: [DocumentService, PrismaService, CloudinaryService],
  exports: [DocumentService],
})
export class DocumentModule {}
