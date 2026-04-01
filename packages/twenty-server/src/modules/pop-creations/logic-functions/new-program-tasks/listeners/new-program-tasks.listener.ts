import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/common';
import { type DeepPartial } from 'typeorm';

import { ObjectRecordCreateEvent } from 'src/engine/integrations/event-emitter/interfaces/object-record-create.event.interface';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';

type TaskTemplate = {
  title: string;
  description: string;
  dueInDays: number;
};

@Injectable()
export class NewProgramTasksListener {
  private readonly logger = new Logger(NewProgramTasksListener.name);

  // Standard tasks for new Programs
  private readonly TASK_TEMPLATES: TaskTemplate[] = [
    {
      title: 'Submit Concept to Licensor',
      description:
        'Prepare and submit the initial concept to the licensor for review.',
      dueInDays: 7,
    },
    {
      title: 'Review Licensor Feedback',
      description:
        'Review feedback from the licensor and prepare revisions if needed.',
      dueInDays: 14,
    },
    {
      title: 'Submit PPS to Licensor',
      description:
        'Prepare and submit the Product Price Sheet (PPS) to the licensor.',
      dueInDays: 30,
    },
    {
      title: 'Follow up on PPS Approval',
      description: 'Follow up with licensor on PPS approval status.',
      dueInDays: 37,
    },
    {
      title: 'Finalize Production Timeline',
      description: 'Finalize production and delivery timeline with licensor.',
      dueInDays: 45,
    },
    {
      title: 'Send First Shipment',
      description: 'Coordinate and execute first shipment to customer.',
      dueInDays: 60,
    },
  ];

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @OnEvent('opportunity.created', { async: true })
  async handleOpportunityCreated(
    payload: ObjectRecordCreateEvent<OpportunityWorkspaceEntity>,
  ): Promise<void> {
    try {
      const { workspaceId, recordId, properties } = payload;

      this.logger.log(
        `Creating task checklist for new program ${recordId} in workspace ${workspaceId}`,
      );

      // Get the opportunity to link tasks
      await this.createTaskChecklist(workspaceId, recordId, properties);
    } catch (error) {
      this.logger.error(
        `Error in new-program-tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async createTaskChecklist(
    workspaceId: string,
    opportunityId: string,
    properties: Partial<OpportunityWorkspaceEntity>,
  ): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const taskRepository =
        await this.globalWorkspaceOrmManager.getRepository<TaskWorkspaceEntity>(
          workspaceId,
          'task',
          { shouldBypassPermissionChecks: true },
        );

      const now = new Date();
      const programName = properties.name || 'New Program';

      // Create tasks from templates
      for (const template of this.TASK_TEMPLATES) {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + template.dueInDays);

        const taskData: DeepPartial<TaskWorkspaceEntity> = {
          title: `${template.title} - ${programName}`,
          description: `${template.description}\n\nProgram: ${programName}`,
          dueDate,
          status: 'TODO',
          // Link to opportunity if supported
        };

        await taskRepository.save(taskData);
      }

      this.logger.log(
        `Created ${this.TASK_TEMPLATES.length} tasks for program ${programName}`,
      );
    }, authContext);
  }
}
