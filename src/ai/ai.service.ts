/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma.service';
import { GanttService } from '../planning/gantt.service';
import { PertService } from '../planning/pert.service';
import { TacheService } from '../tache/tache.service';
import {
  AI_ACTION_ASSIGN_TASK,
  AI_ACTION_CREATE_TASK,
  type AiActionType,
  type AssignTaskParams,
  type CreateTaskParams,
} from './dto/execute.dto';

export interface InterpretResult {
  action: AiActionType | null;
  params: CreateTaskParams | AssignTaskParams | null;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ganttService: GanttService,
    private readonly pertService: PertService,
    private readonly tacheService: TacheService,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY non définie : module IA en mode limité');
    }
  }

  private ensureOpenAi(): OpenAI {
    if (!this.openai) {
      throw new BadRequestException(
        'Service IA indisponible (OPENAI_API_KEY manquante).',
      );
    }
    return this.openai;
  }

  /**
   * Construit le contexte projet (tâches, membres) pour le LLM.
   */
  private async getProjectContext(projectId: string) {
    const [project, tasks, members] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, objectives: true, status: true },
      }),
      this.prisma.task.findMany({
        where: { projectId, parentId: null },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assignments: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    if (!project) throw new NotFoundException('Projet introuvable');
    return {
      project: {
        name: project.name,
        objectives: project.objectives,
        status: project.status,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignees: t.assignments.map((a) => a.user),
      })),
      members: members.map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      })),
    };
  }

  /**
   * Interprète un message en langage naturel et retourne une action structurée (sans exécuter).
   */
  async interpret(
    projectId: string,
    message: string,
  ): Promise<InterpretResult> {
    const openai = this.ensureOpenAi();
    const context = await this.getProjectContext(projectId);

    const systemPrompt = `Tu es un assistant de gestion de projet. Tu reçois une demande en langage naturel et tu dois répondre UNIQUEMENT par un JSON valide, sans texte avant ou après, avec la structure suivante selon le type d'action :

Pour CRÉER une tâche : {"action":"create_task","params":{"title":"...","description":"... (optionnel)","priority":"HIGH|MEDIUM|LOW","assigneeId":"id_membre (optionnel)"},"summary":"résumé court","confidence":"high|medium|low"}
Pour ASSIGNER une tâche à quelqu'un : {"action":"assign_task","params":{"taskId":"id_tâche","userId":"id_utilisateur"},"summary":"résumé","confidence":"high|medium|low"}

Règles :
- Utilise UNIQUEMENT les id (taskId, userId) fournis dans le contexte. Pour assigneeId et userId, choisis parmi les membres du projet.
- Si la demande ne correspond à aucune action (create_task, assign_task), répondre : {"action":null,"params":null,"summary":"...","confidence":"low"}
- priority doit être HIGH, MEDIUM ou LOW.
- Réponds uniquement avec le JSON, pas de markdown.`;

    const userContent = `Contexte projet : ${JSON.stringify(context)}\n\nDemande de l'utilisateur : ${message}`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });
    } catch (error: any) {
      if (error.status === 429) {
        throw new BadRequestException(
          'Quota OpenAI dépassé. Vérifiez votre plan de facturation sur https://platform.openai.com.',
        );
      }
      throw error;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return {
        action: null,
        params: null,
        summary: 'Aucune réponse',
        confidence: 'low',
      };
    }

    try {
      const parsed = JSON.parse(raw) as InterpretResult;
      if (!parsed.action) {
        return {
          action: null,
          params: null,
          summary: parsed.summary ?? raw,
          confidence: 'low',
        };
      }
      if (
        parsed.action !== AI_ACTION_CREATE_TASK &&
        parsed.action !== AI_ACTION_ASSIGN_TASK
      ) {
        return {
          action: null,
          params: null,
          summary: parsed.summary ?? raw,
          confidence: 'low',
        };
      }
      return parsed;
    } catch {
      this.logger.warn('Réponse LLM non JSON', raw);
      return { action: null, params: null, summary: raw, confidence: 'low' };
    }
  }

  /**
   * Exécute une action proposée (create_task ou assign_task).
   */
  async execute(
    projectId: string,
    action: AiActionType,
    params: CreateTaskParams | AssignTaskParams,
    userId: string,
  ) {
    if (action === AI_ACTION_CREATE_TASK) {
      const p = params as CreateTaskParams;
      const createDto = {
        projectId,
        title: p.title,
        description: p.description ?? undefined,
        priority: p.priority,
        assignedUserIds: p.assigneeId ? [p.assigneeId] : undefined,
      };
      return this.tacheService.createTask(userId, createDto);
    }
    if (action === AI_ACTION_ASSIGN_TASK) {
      const p = params as AssignTaskParams;
      return this.tacheService.assignUsersToTask(p.taskId, userId, {
        userIds: [p.userId],
      });
    }
    throw new BadRequestException(`Action non supportée : ${action}`);
  }

  /**
   * Interprète puis exécute en un appel (flux "act").
   */
  async act(projectId: string, message: string, userId: string) {
    const result = await this.interpret(projectId, message);
    if (!result.action || !result.params) {
      return {
        executed: false,
        summary: result.summary,
        data: null,
      };
    }
    const data = await this.execute(
      projectId,
      result.action,
      result.params,
      userId,
    );
    return {
      executed: true,
      summary: result.summary,
      action: result.action,
      data,
    };
  }

  /**
   * Interprétation du diagramme de Gantt par l'IA.
   */
  async analyzeGantt(
    projectId: string,
    userId: string,
  ): Promise<{ analysis: string }> {
    const openai = this.ensureOpenAi();
    const ganttData = await this.ganttService.getGanttData(projectId, userId);

    const systemPrompt = `Tu es un expert en planification de projet. On te fournit les données d'un diagramme de Gantt (tâches, dates, durées, dépendances, assignés). Analyse-les et fournis une interprétation concise en français : enchaînements, risques de chevauchement, charge des ressources, et recommandations si besoin. Réponds en JSON : {"analysis":"ton texte d'analyse"}.`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(ganttData) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
    } catch (error: any) {
      if (error.status === 429) {
        throw new BadRequestException(
          'Quota OpenAI dépassé. Vérifiez votre plan de facturation sur https://platform.openai.com.',
        );
      }
      throw error;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { analysis: 'Aucune analyse disponible.' };
    try {
      const parsed = JSON.parse(raw) as { analysis?: string };
      return { analysis: parsed.analysis ?? raw };
    } catch {
      return { analysis: raw };
    }
  }

  /**
   * Interprétation du diagramme PERT (chemin critique, etc.) par l'IA.
   */
  async analyzePert(
    projectId: string,
    userId: string,
  ): Promise<{ analysis: string }> {
    const openai = this.ensureOpenAi();
    const pertData = await this.pertService.getPertData(projectId, userId);

    const systemPrompt = `Tu es un expert en méthode PERT. On te fournit les nœuds (tâches avec temps attendu), les arêtes (dépendances) et le chemin critique. Interprète ces données en français : durée totale, tâches critiques, goulots d'étranglement, et conseils pour réduire la durée du projet si pertinent. Réponds en JSON : {"analysis":"ton texte"}.`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(pertData) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
    } catch (error: any) {
      if (error.status === 429) {
        throw new BadRequestException(
          'Quota OpenAI dépassé. Vérifiez votre plan de facturation sur https://platform.openai.com.',
        );
      }
      throw error;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { analysis: 'Aucune analyse disponible.' };
    try {
      const parsed = JSON.parse(raw) as { analysis?: string };
      return { analysis: parsed.analysis ?? raw };
    } catch {
      return { analysis: raw };
    }
  }

  /**
   * Prévision des retards : analyse des tâches, deadlines et dépendances.
   */
  async predictDelays(projectId: string): Promise<{ prediction: string }> {
    const openai = this.ensureOpenAi();

    const [project, tasks] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, startDate: true, endDate: true, status: true },
      }),
      this.prisma.task.findMany({
        where: { projectId, parentId: null },
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          startDate: true,
          endDate: true,
          blockedBy: { select: { blockingTaskId: true } },
        },
      }),
    ]);

    if (!project) throw new NotFoundException('Projet introuvable');

    const systemPrompt = `Tu es un expert en gestion de projet. On te donne les infos du projet (dates, statut) et la liste des tâches (statut, deadline, dates, dépendances). Identifie les risques de retard : tâches en retard ou proches du retard, chaînes de dépendances critiques, surcharge. Propose des recommandations. Réponds en JSON : {"prediction":"ton texte d'analyse et prévisions"}.`;

    const userContent = JSON.stringify({ project, tasks });

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
    } catch (error: any) {
      if (error.status === 429) {
        throw new BadRequestException(
          'Quota OpenAI dépassé. Vérifiez votre plan de facturation sur https://platform.openai.com.',
        );
      }
      throw error;
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { prediction: 'Aucune prévision disponible.' };
    try {
      const parsed = JSON.parse(raw) as { prediction?: string };
      return { prediction: parsed.prediction ?? raw };
    } catch {
      return { prediction: raw };
    }
  }
}
