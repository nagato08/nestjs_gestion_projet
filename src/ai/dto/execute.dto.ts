import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsString } from 'class-validator';

export const AI_ACTION_CREATE_TASK = 'create_task';
export const AI_ACTION_ASSIGN_TASK = 'assign_task';

export type AiActionType =
  | typeof AI_ACTION_CREATE_TASK
  | typeof AI_ACTION_ASSIGN_TASK;

/** Paramètres pour create_task (validés dans le service) */
export interface CreateTaskParams {
  title: string;
  description?: string;
  priority: string;
  assigneeId?: string;
}

/** Paramètres pour assign_task */
export interface AssignTaskParams {
  taskId: string;
  userId: string;
}

export class ExecuteDto {
  @ApiProperty({ example: 'cuid_project_123' })
  @IsNotEmpty()
  @IsString()
  projectId: string;

  @ApiProperty({ enum: [AI_ACTION_CREATE_TASK, AI_ACTION_ASSIGN_TASK] })
  @IsEnum([AI_ACTION_CREATE_TASK, AI_ACTION_ASSIGN_TASK])
  action: AiActionType;

  @ApiProperty({ description: 'Paramètres selon action' })
  @IsObject()
  params: CreateTaskParams | AssignTaskParams;
}
