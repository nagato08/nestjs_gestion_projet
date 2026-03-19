/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // 1️⃣ Créer un document (métadonnées uniquement)
  @Post()
  @ApiOperation({ summary: 'Créer un nouveau document (métadonnées)' })
  create(@Req() req: any, @Body() createDocumentDto: CreateDocumentDto) {
    return this.documentService.createDocument(req.user.id, createDocumentDto);
  }

  // 2️⃣ Uploader une version d'un document
  @Post(':id/versions')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       file: {
  //         type: 'string',
  //         format: 'binary',
  //       },
  //     },
  //   },
  // })
  @ApiOperation({ summary: "Uploader une nouvelle version d'un document" })
  uploadVersion(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('Aucun fichier fourni');
    }
    return this.documentService.uploadDocumentVersion(id, req.user.id, file);
  }

  // 3️⃣ Récupérer tous les documents d'un projet
  @Get('project/:projectId')
  @ApiOperation({ summary: "Récupérer tous les documents d'un projet" })
  getDocumentsByProject(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    return this.documentService.getDocumentsByProject(projectId, req.user.id);
  }

  // 4️⃣ Récupérer mes documents (tous projets)
  @Get('my-documents')
  @ApiOperation({ summary: 'Récupérer tous mes documents' })
  getMyDocuments(@Req() req: any) {
    return this.documentService.getMyDocuments(req.user.id);
  }

  // 5️⃣ Récupérer un document par ID avec toutes ses versions
  @Get(':id')
  @ApiOperation({ summary: "Récupérer les détails d'un document" })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.documentService.getDocumentById(id, req.user.id);
  }

  // 6️⃣ Mettre à jour un document (nom)
  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un document' })
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentService.updateDocument(
      id,
      req.user.id,
      updateDocumentDto,
    );
  }

  // 7️⃣ Supprimer un document
  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un document' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.documentService.deleteDocument(id, req.user.id);
  }

  // 8️⃣ Récupérer l'historique des versions d'un document
  @Get(':id/versions')
  @ApiOperation({
    summary: "Récupérer l'historique des versions d'un document",
  })
  getVersions(@Param('id') id: string, @Req() req: any) {
    return this.documentService.getDocumentVersions(id, req.user.id);
  }

  // 9️⃣ Récupérer une version spécifique d'un document
  @Get(':id/versions/:version')
  @ApiOperation({ summary: "Récupérer une version spécifique d'un document" })
  getVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: any,
  ) {
    return this.documentService.getDocumentVersion(id, version, req.user.id);
  }

  // 🔟 Créer un commentaire sur un document
  @Post(':id/comments')
  @ApiOperation({ summary: 'Ajouter un commentaire à un document' })
  createComment(
    @Param('id') id: string,
    @Req() req: any,
    @Body() createCommentDto: CreateDocumentCommentDto,
  ) {
    return this.documentService.createDocumentComment(
      id,
      req.user.id,
      createCommentDto,
    );
  }

  // 1️⃣1️⃣ Supprimer un commentaire
  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    return this.documentService.deleteDocumentComment(commentId, req.user.id);
  }
}
