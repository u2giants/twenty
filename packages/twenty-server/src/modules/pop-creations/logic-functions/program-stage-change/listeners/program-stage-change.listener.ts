import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/common';
import { type DeepPartial } from 'typeorm';

import { ObjectRecordUpdateEvent } from 'src/engine/integrations/event-emitter/interfaces/object-record-update.event.interface';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { LicensorApprovalThreadWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/licensor-approval-thread.workspace-entity';

type OpportunityStage =
  | 'NEW'
  | 'PROSPECTING'
  | 'QUALIFICATION'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

@Injectable()
export class ProgramStageChangeListener {
  private readonly logger = new Logger(ProgramStageChangeListener.name);

  // Stages that should auto-create LAT
  private readonly LAT_TRIGGER_STAGES: OpportunityStage[] = [
    'PROPOSAL',
    'NEGOTIATION',
  ];

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @OnEvent('opportunity.updated', { async: true })
  async handleOpportunityStageUpdated(
    payload: ObjectRecordUpdateEvent<OpportunityWorkspaceEntity>,
  ): Promise<void> {
    try {
      const { workspaceId, recordId, properties } = payload;
      const { stage: newStage, stage: previousStage } = properties;

      // Only process if stage actually changed
      if (newStage === previousStage) {
        return;
      }

      this.logger.log(
        `Opportunity ${recordId} stage changed from ${previousStage} to ${newStage} in workspace ${workspaceId}`,
      );

      // Check if new stage should trigger LAT creation
      if (this.LAT_TRIGGER_STAGES.includes(newStage as OpportunityStage)) {
        await this.createLicensorApprovalThread(
          workspaceId,
          recordId,
          newStage as OpportunityStage,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error in program-stage-change: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async createLicensorApprovalThread(
    workspaceId: string,
    opportunityId: string,
    stage: OpportunityStage,
  ): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      // Get the opportunity to link
      const opportunityRepository =
        await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
          workspaceId,
          'opportunity',
          { shouldBypassPermissionChecks: true },
        );

      const opportunity = await opportunityRepository.findOne({
        where: { id: opportunityId },
      });

      if (!opportunity) {
        this.logger.error(`Opportunity ${opportunityId} not found`);
        return;
      }

      // Create LAT record
      const latRepository =
        await this.globalWorkspaceOrmManager.getRepository<LicensorApprovalThreadWorkspaceEntity>(
          workspaceId,
          'licensorApprovalThread',
          { shouldBypassPermissionChecks: true },
        );

      const latData: DeepPartial<LicensorApprovalThreadWorkspaceEntity> = {
        name: `LAT - ${opportunity.name || 'New Program'}`,
        propertyName: opportunity.name || undefined,
        stage: 'CONCEPT_SUBMIT',
        position: 0,
      };

      const savedLat = await latRepository.save(latData);

      this.logger.log(
        `Created LAT ${savedLat.id} for opportunity ${opportunityId} at stage ${stage}`,
      );
    }, authContext);
  }
}
