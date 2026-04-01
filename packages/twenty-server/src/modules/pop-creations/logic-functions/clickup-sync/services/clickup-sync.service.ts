import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';

@Injectable()
export class ClickupSyncService {
  private readonly logger = new Logger(ClickupSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async syncFromClickup(workspaceId: string): Promise<void> {
    this.logger.log(`Starting ClickUp sync for workspace ${workspaceId}`);

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      // Fetch tasks from ClickUp API
      // This is a placeholder - actual implementation would:
      // 1. Call ClickUp API to get task updates
      // 2. Match tasks to Twenty tasks by external ID
      // 3. Update matching Twenty tasks with ClickUp data
      // 4. Create new tasks if they don't exist

      const taskRepository =
        await this.globalWorkspaceOrmManager.getRepository<TaskWorkspaceEntity>(
          workspaceId,
          'task',
          { shouldBypassPermissionChecks: true },
        );

      // Find tasks with clickup links
      const tasksWithClickup = await taskRepository.find({
        where: {
          linkMetadata: { id: '' } as any, // Placeholder for clickup link field
        },
      });

      this.logger.log(
        `ClickUp sync complete for workspace ${workspaceId}. Found ${tasksWithClickup.length} tasks with ClickUp links.`,
      );
    }, authContext);
  }

  async syncToClickup(workspaceId: string): Promise<void> {
    this.logger.log(`Starting ClickUp push for workspace ${workspaceId}`);

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      // Push task updates to ClickUp
      // This would sync status changes, due dates, comments, etc.
      this.logger.log(`ClickUp push complete for workspace ${workspaceId}`);
    }, authContext);
  }
}
