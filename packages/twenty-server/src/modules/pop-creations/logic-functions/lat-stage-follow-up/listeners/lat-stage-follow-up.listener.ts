import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/common';
import { type DeepPartial } from 'typeorm';

import { ObjectRecordUpdateEvent } from 'src/engine/integrations/event-emitter/interfaces/object-record-update.event.interface';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { LicensorApprovalThreadWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/licensor-approval-thread.workspace-entity';
import { TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';

type LATStage =
  | 'CONCEPT_SUBMIT'
  | 'CONCEPT_REVISIONS'
  | 'RESUBMIT'
  | 'CONCEPT_APPROVED_WITH_COMMENTS'
  | 'CONCEPT_APPROVED'
  | 'PPS_SUBMIT'
  | 'PPS_APPROVED';

@Injectable()
export class LatStageFollowUpListener {
  private readonly logger = new Logger(LatStageFollowUpListener.name);

  // Stages that require follow-up tasks
  private readonly STAGES_REQUIRING_FOLLOWUP: LATStage[] = [
    'CONCEPT_REVISIONS',
    'RESUBMIT',
    'CONCEPT_APPROVED_WITH_COMMENTS',
    'PPS_SUBMIT',
  ];

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @OnEvent('licensorApprovalThread.updated', { async: true })
  async handleLatStageUpdated(
    payload: ObjectRecordUpdateEvent<LicensorApprovalThreadWorkspaceEntity>,
  ): Promise<void> {
    try {
      const { workspaceId, recordId, properties } = payload;
      const { stage: newStage, stage: previousStage } = properties;

      // Only process if stage actually changed
      if (newStage === previousStage) {
        return;
      }

      this.logger.log(
        `LAT ${recordId} stage changed from ${previousStage} to ${newStage} in workspace ${workspaceId}`,
      );

      // Check if new stage requires follow-up
      if (!this.STAGES_REQUIRING_FOLLOWUP.includes(newStage as LATStage)) {
        this.logger.log(
          `Stage ${newStage} does not require follow-up, skipping task creation`,
        );
        return;
      }

      // Create follow-up task
      await this.createFollowUpTask(
        workspaceId,
        recordId,
        newStage as LATStage,
      );
    } catch (error) {
      this.logger.error(
        `Error in lat-stage-follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async createFollowUpTask(
    workspaceId: string,
    latId: string,
    stage: LATStage,
  ): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const taskRepository =
        await this.globalWorkspaceOrmManager.getRepository<TaskWorkspaceEntity>(
          workspaceId,
          'task',
          { shouldBypassPermissionChecks: true },
        );

      // Get the LAT record to link to task
      const latRepository =
        await this.globalWorkspaceOrmManager.getRepository<LicensorApprovalThreadWorkspaceEntity>(
          workspaceId,
          'licensorApprovalThread',
          { shouldBypassPermissionChecks: true },
        );

      const latRecord = await latRepository.findOne({
        where: { id: latId },
      });

      if (!latRecord) {
        this.logger.error(`LAT record ${latId} not found`);
        return;
      }

      // Build task title and description based on stage
      const { title, description } = this.buildTaskContent(stage, latRecord);

      const taskData: DeepPartial<TaskWorkspaceEntity> = {
        title,
        description,
        dueDate: this.calculateFollowUpDate(stage),
        status: 'TODO',
      };

      await taskRepository.save(taskData);

      this.logger.log(
        `Created follow-up task for LAT ${latId} with stage ${stage}`,
      );
    }, authContext);
  }

  private buildTaskContent(
    stage: LATStage,
    latRecord: LicensorApprovalThreadWorkspaceEntity,
  ): { title: string; description: string } {
    const latName = latRecord.name || 'Unnamed LAT';

    const stageContent: Record<
      LATStage,
      { title: string; description: string }
    > = {
      CONCEPT_REVISIONS: {
        title: `Review Concept Revisions - ${latName}`,
        description: `Please review the concept revisions for this LAT. Check the licensor comments and update accordingly.\n\nProgram: ${latRecord.propertyName || 'N/A'}`,
      },
      RESUBMIT: {
        title: `Resubmit to Licensor - ${latName}`,
        description: `This LAT needs to be resubmitted to the licensor. Ensure all feedback has been addressed.\n\nProgram: ${latRecord.propertyName || 'N/A'}`,
      },
      CONCEPT_APPROVED_WITH_COMMENTS: {
        title: `Address Approval Comments - ${latName}`,
        description: `The concept has been approved with comments. Review and address the licensor's feedback before proceeding.\n\nProgram: ${latRecord.propertyName || 'N/A'}`,
      },
      PPS_SUBMIT: {
        title: `Prepare PPS Submission - ${latName}`,
        description: `Prepare the PPS (Product Price Sheet) for submission to the licensor.\n\nProgram: ${latRecord.propertyName || 'N/A'}`,
      },
      CONCEPT_SUBMIT: {
        title: `Submit to Licensor - ${latName}`,
        description: `Submit this LAT to the licensor for review.`,
      },
      CONCEPT_APPROVED: {
        title: `Concept Approved - ${latName}`,
        description: `The concept has been approved. Proceed to the next stage.`,
      },
      PPS_APPROVED: {
        title: `PPS Approved - ${latName}`,
        description: `The PPS has been approved. This LAT is complete.`,
      },
    };

    return stageContent[stage];
  }

  private calculateFollowUpDate(stage: LATStage): Date {
    const now = new Date();

    // Different follow-up deadlines based on stage urgency
    const deadlines: Record<LATStage, number> = {
      CONCEPT_REVISIONS: 7, // 7 days
      RESUBMIT: 3, // 3 days - urgent
      CONCEPT_APPROVED_WITH_COMMENTS: 14, // 14 days
      PPS_SUBMIT: 10, // 10 days
      CONCEPT_SUBMIT: 5,
      CONCEPT_APPROVED: 0,
      PPS_APPROVED: 0,
    };

    const daysToAdd = deadlines[stage];
    const followUpDate = new Date(now);
    followUpDate.setDate(followUpDate.getDate() + daysToAdd);

    return followUpDate;
  }
}
