/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';
import { Role } from '@prisma/client';

// Type pour les fichiers uploadés via Multer
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
};

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UTILITAIRE : Vérifie que l'utilisateur est membre du projet
   */
  private async verifyProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à ce projet");
    }
  }

  /**
   * UTILITAIRE : Vérifie qu'un document existe et que l'utilisateur a accès au projet
   */
  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<{ id: string; projectId: string; uploadedBy: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: { members: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document introuvable');
    }

    const isMember = document.project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à ce document");
    }

    return {
      id: document.id,
      projectId: document.projectId,
      uploadedBy: document.uploadedBy,
    };
  }

  /**
   * UTILITAIRE : Vérifie les permissions de modification/suppression
   */
  private async canModifyDocument(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: {
            owner: true,
            members: true,
          },
        },
        author: true,
      },
    });

    if (!document) {
      return false;
    }

    // L'auteur peut modifier
    if (document.uploadedBy === userId) {
      return true;
    }

    // Le propriétaire du projet peut modifier
    if (document.project.ownerId === userId) {
      return true;
    }

    // Les admins peuvent modifier
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === Role.ADMIN;
  }

  // 1️⃣ Créer un document (sans fichier, juste le métadonnées)
  async createDocument(userId: string, dto: CreateDocumentDto) {
    await this.verifyProjectAccess(dto.projectId, userId);

    const document = await this.prisma.document.create({
      data: {
        name: dto.name,
        projectId: dto.projectId,
        uploadedBy: userId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
    });

    return document;
  }

  // 2️⃣ Uploader une version d'un document
  async uploadDocumentVersion(
    documentId: string,
    userId: string,
    file: MulterFile,
  ) {
    await this.verifyDocumentAccess(documentId, userId);

    // Récupérer le document pour obtenir le numéro de version actuel
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document introuvable');
    }

    // Calculer le prochain numéro de version
    const nextVersion =
      document.versions.length > 0 ? document.versions[0].version + 1 : 1;

    // TODO: Ici, vous devriez uploader le fichier vers S3, Cloudinary, ou un autre service de stockage
    // Pour l'instant, on simule avec une URL
    // En production, utilisez : const fileUrl = await this.uploadToStorage(file);
    const fileUrl = `/uploads/documents/${documentId}/v${nextVersion}/${file.originalname}`;

    const version = await this.prisma.documentVersion.create({
      data: {
        version: nextVersion,
        fileUrl,
        documentId,
      },
      include: {
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return version;
  }

  // 3️⃣ Récupérer tous les documents d'un projet
  async getDocumentsByProject(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId);

    const documents = await this.prisma.document.findMany({
      where: {
        projectId,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1, // Dernière version
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents;
  }

  // 4️⃣ Récupérer un document par ID avec toutes ses versions
  async getDocumentById(documentId: string, userId: string) {
    await this.verifyDocumentAccess(documentId, userId);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            document: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return document;
  }

  // 5️⃣ Mettre à jour un document (nom uniquement)
  async updateDocument(
    documentId: string,
    userId: string,
    dto: UpdateDocumentDto,
  ) {
    const canModify = await this.canModifyDocument(documentId, userId);

    if (!canModify) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de modifier ce document",
      );
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        name: dto.name,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
    });

    return updatedDocument;
  }

  // 6️⃣ Supprimer un document
  async deleteDocument(documentId: string, userId: string) {
    const canModify = await this.canModifyDocument(documentId, userId);

    if (!canModify) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de supprimer ce document",
      );
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    // TODO: Supprimer aussi les fichiers physiques du stockage

    return {
      message: 'Document supprimé avec succès',
    };
  }

  // 7️⃣ Récupérer l'historique des versions d'un document
  async getDocumentVersions(documentId: string, userId: string) {
    await this.verifyDocumentAccess(documentId, userId);

    const versions = await this.prisma.documentVersion.findMany({
      where: {
        documentId,
      },
      include: {
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    return versions;
  }

  // 8️⃣ Télécharger une version spécifique d'un document
  async getDocumentVersion(
    documentId: string,
    versionNumber: number,
    userId: string,
  ) {
    await this.verifyDocumentAccess(documentId, userId);

    const version = await this.prisma.documentVersion.findFirst({
      where: {
        documentId,
        version: versionNumber,
      },
      include: {
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Version ${versionNumber} introuvable pour ce document`,
      );
    }

    return version;
  }

  // 9️⃣ Créer un commentaire sur un document
  async createDocumentComment(
    documentId: string,
    userId: string,
    dto: CreateDocumentCommentDto,
  ) {
    await this.verifyDocumentAccess(documentId, userId);

    const comment = await this.prisma.documentComment.create({
      data: {
        content: dto.content,
        documentId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
        document: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return comment;
  }

  // 🔟 Supprimer un commentaire
  async deleteDocumentComment(commentId: string, userId: string) {
    const comment = await this.prisma.documentComment.findUnique({
      where: { id: commentId },
      include: {
        document: {
          include: {
            project: {
              include: { members: true },
            },
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire introuvable');
    }

    // Vérifier l'accès au document
    const isMember = comment.document.project.members.some(
      (m) => m.userId === userId,
    );
    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à ce commentaire");
    }

    // Seul l'auteur peut supprimer son commentaire
    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres commentaires',
      );
    }

    await this.prisma.documentComment.delete({
      where: { id: commentId },
    });

    return {
      message: 'Commentaire supprimé avec succès',
    };
  }

  // 1️⃣1️⃣ Récupérer mes documents (tous les projets où je suis membre)
  async getMyDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        project: {
          members: {
            some: {
              userId,
            },
          },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return documents;
  }
}
