/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateDocumentCommentDto } from './dto/create-document-comment.dto';
import { ProjectRole } from '@prisma/client';
import { CloudinaryService } from '../cloudinary.service';
import { NotificationHelperService } from 'src/notification/notification-helper.service';
import {
  PROJECT_ROLE_RANK,
  ProjectAccessService,
} from 'src/common/access/project-access.service';

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
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly projectAccess: ProjectAccessService,
    private readonly notifications: NotificationHelperService,
  ) {}

  /**
   * Déclenche une notification sans jamais faire échouer l'action métier.
   *
   * Un document déposé le reste même si l'annonce échoue : l'erreur est
   * tracée, pas propagée à l'appelant.
   */
  private notifySafely(operation: Promise<unknown>, context: string): void {
    void operation.catch((error: unknown) => {
      this.logger.warn(
        `Notification "${context}" non délivrée : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  /**
   * UTILITAIRE : Consultation du projet — tout membre, VIEWER compris.
   */
  private async verifyProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.projectAccess.requireMember(projectId, userId);
  }

  /**
   * UTILITAIRE : Dépôt / modification de documents — MEMBER minimum.
   */
  private async verifyProjectContributorAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.projectAccess.requireContributor(projectId, userId);
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
      select: { id: true, projectId: true, uploadedBy: true },
    });

    if (!document) {
      throw new NotFoundException('Document introuvable');
    }

    await this.projectAccess.requireMember(document.projectId, userId);

    return document;
  }

  /**
   * UTILITAIRE : Vérifie les permissions de modification/suppression.
   * Peuvent modifier : l'auteur du document (s'il est encore contributeur)
   * et les gestionnaires du projet (propriétaire, ADMIN projet, ADMIN global).
   */
  private async canModifyDocument(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { projectId: true, uploadedBy: true },
    });

    if (!document) {
      return false;
    }

    const role = await this.projectAccess.getEffectiveRole(
      document.projectId,
      userId,
    );
    if (!role) return false;

    // Un gestionnaire du projet peut toujours modifier.
    if (PROJECT_ROLE_RANK[role] >= PROJECT_ROLE_RANK[ProjectRole.ADMIN]) {
      return true;
    }

    // L'auteur peut modifier son document tant qu'il n'est pas rétrogradé VIEWER.
    return (
      document.uploadedBy === userId &&
      PROJECT_ROLE_RANK[role] >= PROJECT_ROLE_RANK[ProjectRole.MEMBER]
    );
  }

  // 1️⃣ Créer un document (sans fichier, juste le métadonnées)
  async createDocument(userId: string, dto: CreateDocumentDto) {
    await this.verifyProjectContributorAccess(dto.projectId, userId);

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

    this.notifySafely(
      this.notifications.notifyDocumentUploaded(document.id),
      `dépôt du document ${document.id}`,
    );

    return document;
  }

  // 2️⃣ Uploader une version d'un document
  async uploadDocumentVersion(
    documentId: string,
    userId: string,
    file: MulterFile,
  ) {
    const { projectId } = await this.verifyDocumentAccess(documentId, userId);
    // Déposer une version est une écriture : VIEWER exclu.
    await this.verifyProjectContributorAccess(projectId, userId);

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

    // Upload réel sur Cloudinary (ou autre fournisseur) à partir du buffer en mémoire
    const uploadResult = await this.cloudinary.uploadDocument(file as any, {
      folder: `${process.env.CLOUDINARY_FOLDER ?? 'gestion-projets/documents'}/${documentId}/v${nextVersion}`,
    });

    const fileUrl = uploadResult.url;

    const version = await this.prisma.documentVersion.create({
      data: {
        version: nextVersion,
        fileUrl,
        fileSize: uploadResult.bytes,
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
    const { projectId } = await this.verifyDocumentAccess(documentId, userId);
    // Commenter est une écriture : VIEWER exclu.
    await this.verifyProjectContributorAccess(projectId, userId);

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

    this.notifySafely(
      this.notifications.notifyDocumentComment(documentId, userId),
      `commentaire sur le document ${documentId}`,
    );

    return comment;
  }

  // 🔟 Supprimer un commentaire
  async deleteDocumentComment(commentId: string, userId: string) {
    const comment = await this.prisma.documentComment.findUnique({
      where: { id: commentId },
      select: {
        userId: true,
        document: { select: { projectId: true } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire introuvable');
    }

    // Vérifier l'accès au document
    await this.verifyProjectContributorAccess(
      comment.document.projectId,
      userId,
    );

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
