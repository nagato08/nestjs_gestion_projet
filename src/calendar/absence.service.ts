import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbsenceStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { DecideAbsenceDto } from './dto/decide-absence.dto';

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
} as const;

/**
 * Disponibilités déclarées : congés, maladie, télétravail, formation.
 *
 * Chacun ne déclare que pour lui-même — il n'existe pas de circuit de
 * validation, l'outil sert à savoir qui est là quand, pas à arbitrer des
 * demandes. Le motif reste privé : l'équipe a besoin de connaître
 * l'indisponibilité, pas sa raison.
 */
@Injectable()
export class AbsenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bornes de journée : une absence déclarée le 10 couvre le 10 en entier.
   *
   * En UTC, et non dans le fuseau du serveur : les dates repartent vers
   * l'agenda sérialisées en `YYYY-MM-DD` par `toISOString`. Sur une machine
   * décalée, un minuit local retomberait la veille une fois converti, et
   * l'absence s'afficherait sur le mauvais jour.
   */
  private parseRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException(
        'La date de fin ne peut pas précéder la date de début',
      );
    }

    return { start, end };
  }

  /**
   * Deux périodes se recouvrent si chacune commence avant que l'autre ne
   * finisse. Sert aussi bien au filtrage par fenêtre d'affichage qu'à la
   * détection de doublons.
   */
  private overlapsWindow(start: Date, end: Date) {
    return { startDate: { lte: end }, endDate: { gte: start } };
  }

  /** Absences de l'utilisateur courant, motif compris. */
  async listMine(userId: string, startDate: string, endDate: string) {
    const { start, end } = this.parseRange(startDate, endDate);

    return this.prisma.absence.findMany({
      where: { userId, ...this.overlapsWindow(start, end) },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Absences des collègues, motif exclu.
   *
   * Les demandes refusées sont écartées : une absence refusée n'est pas une
   * absence, l'afficher laisserait croire que la personne ne sera pas là. Les
   * demandes en attente restent visibles — l'équipe a intérêt à savoir qu'une
   * indisponibilité est probable, avec son statut pour ne pas s'y fier
   * aveuglément.
   *
   * @param userIds Personnes concernées, déterminées par l'appelant selon sa
   * propre règle de visibilité (collègues de projet, ou tout le monde pour un
   * administrateur).
   */
  async listForUsers(userIds: string[], startDate: string, endDate: string) {
    if (userIds.length === 0) return [];

    const { start, end } = this.parseRange(startDate, endDate);

    const absences = await this.prisma.absence.findMany({
      where: {
        userId: { in: userIds },
        status: { not: AbsenceStatus.REJECTED },
        ...this.overlapsWindow(start, end),
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        user: { select: AUTHOR_SELECT },
      },
      orderBy: { startDate: 'asc' },
    });

    return absences;
  }

  /**
   * Demandes en attente de décision, pour ceux qui peuvent trancher.
   *
   * La sienne propre en est exclue : on ne se valide pas soi-même, autant ne
   * pas l'afficher comme actionnable.
   */
  async listPending(approverId: string, approverRole: Role) {
    this.assertCanDecide(approverRole);

    return this.prisma.absence.findMany({
      where: {
        status: AbsenceStatus.PENDING,
        userId: { not: approverId },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        user: { select: AUTHOR_SELECT },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /** Seuls un chef de projet ou un administrateur tranchent une demande. */
  private assertCanDecide(role: Role) {
    if (role !== Role.ADMIN && role !== Role.PROJECT_MANAGER) {
      throw new ForbiddenException(
        'Seul un chef de projet ou un administrateur peut traiter une demande',
      );
    }
  }

  /**
   * Approuve ou refuse une demande.
   *
   * Personne ne valide sa propre demande, quel que soit son rôle : une
   * validation que le demandeur peut s'accorder lui-même ne vaut rien.
   */
  async decide(
    absenceId: string,
    approverId: string,
    approverRole: Role,
    dto: DecideAbsenceDto,
  ) {
    this.assertCanDecide(approverRole);

    const absence = await this.prisma.absence.findUnique({
      where: { id: absenceId },
      select: { id: true, userId: true },
    });
    if (!absence) throw new NotFoundException('Demande introuvable');

    if (absence.userId === approverId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas traiter votre propre demande',
      );
    }

    return this.prisma.absence.update({
      where: { id: absenceId },
      data: {
        status: dto.status,
        approverId,
        decidedAt: new Date(),
        decisionNote: dto.decisionNote,
      },
    });
  }

  async create(userId: string, dto: CreateAbsenceDto) {
    const { start, end } = this.parseRange(dto.startDate, dto.endDate);

    // Une même journée déclarée deux fois donnerait deux pastilles
    // contradictoires sur l'agenda ; mieux vaut refuser que laisser l'équipe
    // deviner laquelle fait foi. Une demande refusée ne bloque rien : elle
    // n'occupe pas la période, on doit pouvoir en redéposer une dessus.
    const conflict = await this.prisma.absence.findFirst({
      where: {
        userId,
        status: { not: AbsenceStatus.REJECTED },
        ...this.overlapsWindow(start, end),
      },
      select: { id: true, startDate: true, endDate: true },
    });
    if (conflict) {
      throw new BadRequestException(
        'Une disponibilité est déjà déclarée sur cette période',
      );
    }

    return this.prisma.absence.create({
      data: {
        userId,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });
  }

  private async findOwn(absenceId: string, userId: string) {
    const absence = await this.prisma.absence.findUnique({
      where: { id: absenceId },
      select: { id: true, userId: true, startDate: true, endDate: true },
    });
    if (!absence) throw new NotFoundException('Disponibilité introuvable');
    if (absence.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que vos propres disponibilités',
      );
    }
    return absence;
  }

  async update(absenceId: string, userId: string, dto: UpdateAbsenceDto) {
    const existing = await this.findOwn(absenceId, userId);

    // Les deux dates se valident ensemble : modifier la seule date de fin
    // doit rester cohérent avec le début déjà enregistré.
    const { start, end } = this.parseRange(
      dto.startDate ?? existing.startDate.toISOString(),
      dto.endDate ?? existing.endDate.toISOString(),
    );

    const conflict = await this.prisma.absence.findFirst({
      where: {
        userId,
        id: { not: absenceId },
        status: { not: AbsenceStatus.REJECTED },
        ...this.overlapsWindow(start, end),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new BadRequestException(
        'Une autre disponibilité est déjà déclarée sur cette période',
      );
    }

    // Toute modification repasse la demande en attente : un accord portait
    // sur des dates précises, il ne peut pas suivre silencieusement un
    // changement de période décidé après coup par le demandeur.
    return this.prisma.absence.update({
      where: { id: absenceId },
      data: {
        status: AbsenceStatus.PENDING,
        approverId: null,
        decidedAt: null,
        decisionNote: null,
        type: dto.type,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });
  }

  async remove(absenceId: string, userId: string) {
    await this.findOwn(absenceId, userId);
    await this.prisma.absence.delete({ where: { id: absenceId } });
    return { message: 'Disponibilité supprimée' };
  }
}
