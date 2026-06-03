/**
 * ClickUpSyncCronJob
 *
 * Daily sync of ClickUp task statuses (runs at 7am).
 * For each active workspace:
 *   1. Finds Opportunities with a clickupTaskId, fetches current status
 *      from ClickUp API, and updates clickupStatus if changed.
 *   2. Finds Opportunities with a productionPoNumber but no clickupTaskId,
 *      searches ClickUp lists by SAS-PO custom field to auto-link.
 */

import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { IsNull, Not, Repository } from 'typeorm';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';

// ─── Constants ─────────────────────────────────────────────────────────────

export const CLICKUP_SYNC_CRON_PATTERN = '0 7 * * *';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

const LICENSED_LIST_IDS = [
  '13194624',
  '901104141567',
  '901103451229',
  '901103451267',
  '901103451188',
];

const NON_LICENSED_LIST_IDS = ['15061776', '901109204835'];

const ALL_LIST_IDS = [...LICENSED_LIST_IDS, ...NON_LICENSED_LIST_IDS];

// ─── Job ───────────────────────────────────────────────────────────────────

@Processor(MessageQueue.cronQueue)
export class ClickUpSyncCronJob {
  private readonly logger = new Logger(ClickUpSyncCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(ClickUpSyncCronJob.name)
  @SentryCronMonitor(ClickUpSyncCronJob.name, CLICKUP_SYNC_CRON_PATTERN)
  async handle(): Promise<void> {
    const clickupToken = process.env.CLICKUP_API_TOKEN;

    if (!clickupToken) {
      this.logger.warn('Missing CLICKUP_API_TOKEN. Skipping ClickUp sync.');

      return;
    }

    const activeWorkspaces = await this.workspaceRepository.find({
      where: { activationStatus: WorkspaceActivationStatus.ACTIVE },
    });

    for (const workspace of activeWorkspaces) {
      try {
        await this.processWorkspace(workspace.id, clickupToken);
      } catch (error) {
        this.exceptionHandlerService.captureExceptions([error], {
          workspace: { id: workspace.id },
        });
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async processWorkspace(
    workspaceId: string,
    clickupToken: string,
  ): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const opportunityRepo =
        await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
          workspaceId,
          'opportunity',
          { shouldBypassPermissionChecks: true },
        );

      // ── Part 1: Update status for programs with existing clickupTaskId ──
      await this.syncExistingTasks(workspaceId, opportunityRepo, clickupToken);

      // ── Part 2: Auto-link programs with PO number but no clickupTaskId ──
      await this.autoLinkByPoNumber(workspaceId, opportunityRepo, clickupToken);
    }, authContext);
  }

  private async syncExistingTasks(
    workspaceId: string,
    opportunityRepo: any,
    clickupToken: string,
  ): Promise<void> {
    const programs = await opportunityRepo.find({
      where: {
        clickupTaskId: Not(IsNull()),
      },
    });

    let updated = 0;
    let errors = 0;

    for (const program of programs) {
      try {
        const taskId = (program as any).clickupTaskId;

        if (!taskId) continue;

        const task = await this.fetchClickUpTask(taskId, clickupToken);

        if (!task) continue;

        const newStatus = task.status?.status ?? null;
        const currentStatus = (program as any).clickupStatus;

        if (newStatus && newStatus !== currentStatus) {
          await opportunityRepo.update(program.id, {
            clickupStatus: newStatus,
          } as any);
          updated++;
        }
      } catch (taskError) {
        errors++;
        this.logger.error(
          `[${workspaceId}] Failed to sync ClickUp task for program ${program.id}: ${taskError}`,
        );
      }
    }

    this.logger.log(
      `[${workspaceId}] ClickUp status sync: ${programs.length} checked, ${updated} updated, ${errors} errors`,
    );
  }

  private async autoLinkByPoNumber(
    workspaceId: string,
    opportunityRepo: any,
    clickupToken: string,
  ): Promise<void> {
    const unlinkedPrograms = await opportunityRepo
      .createQueryBuilder('opp')
      .where(`opp."productionPoNumber" IS NOT NULL`)
      .andWhere(`opp."productionPoNumber" != ''`)
      .andWhere(`opp."clickupTaskId" IS NULL`)
      .getMany();

    if (unlinkedPrograms.length === 0) {
      return;
    }

    // Build a map of PO numbers to search for
    const poToProgramMap = new Map<string, any>();

    for (const prog of unlinkedPrograms) {
      const po = (prog as any).productionPoNumber?.trim();

      if (po) {
        poToProgramMap.set(po.toUpperCase(), prog);
      }
    }

    let linked = 0;

    // Search each ClickUp list for tasks with matching SAS-PO custom field
    for (const listId of ALL_LIST_IDS) {
      try {
        const tasks = await this.fetchClickUpListTasks(listId, clickupToken);

        for (const task of tasks) {
          const sasPo = this.extractCustomFieldValue(task, 'SAS-PO');

          if (!sasPo) continue;

          const program = poToProgramMap.get(sasPo.toUpperCase());

          if (program) {
            await opportunityRepo.update(program.id, {
              clickupTaskId: task.id,
              clickupStatus: task.status?.status ?? null,
            } as any);

            poToProgramMap.delete(sasPo.toUpperCase());
            linked++;
          }
        }
      } catch (listError) {
        this.logger.error(
          `[${workspaceId}] Failed to search ClickUp list ${listId}: ${listError}`,
        );
      }

      // Stop early if all POs have been matched
      if (poToProgramMap.size === 0) break;
    }

    this.logger.log(
      `[${workspaceId}] ClickUp auto-link: ${unlinkedPrograms.length} unlinked programs, ${linked} newly linked`,
    );
  }

  private async fetchClickUpTask(
    taskId: string,
    token: string,
  ): Promise<any | null> {
    const response = await fetch(`${CLICKUP_API_BASE}/task/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        this.logger.warn(`ClickUp task ${taskId} not found (404)`);

        return null;
      }

      throw new Error(
        `ClickUp API error: ${response.status} ${await response.text()}`,
      );
    }

    return response.json();
  }

  private async fetchClickUpListTasks(
    listId: string,
    token: string,
  ): Promise<any[]> {
    const response = await fetch(
      `${CLICKUP_API_BASE}/list/${listId}/task?page=0&include_closed=true`,
      {
        method: 'GET',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `ClickUp list ${listId} fetch failed: ${response.status} ${await response.text()}`,
      );
    }

    const data = await response.json();

    return data.tasks ?? [];
  }

  private extractCustomFieldValue(task: any, fieldName: string): string | null {
    const customFields = task.custom_fields ?? [];

    const field = customFields.find(
      (f: any) => f.name?.toLowerCase() === fieldName.toLowerCase(),
    );

    return field?.value ?? null;
  }
}
