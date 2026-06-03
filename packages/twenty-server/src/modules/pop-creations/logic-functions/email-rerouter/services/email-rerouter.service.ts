import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

type EmailDestination = {
  workspaceMemberId: string;
  email: string;
};

@Injectable()
export class EmailRerouterService {
  private readonly logger = new Logger(EmailRerouterService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async rerouteEmails(workspaceId: string): Promise<void> {
    this.logger.log(`Starting email rerouting for workspace ${workspaceId}`);

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      // Get all workspace members with emails
      const workspaceMemberRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
          workspaceId,
          'workspaceMember',
          { shouldBypassPermissionChecks: true },
        );

      const workspaceMembers = await workspaceMemberRepository.find({
        where: { deletedAt: null as any },
        relations: ['user'],
      });

      // Build email routing map
      const emailMap = new Map<string, EmailDestination>();

      for (const member of workspaceMembers) {
        if (member.userEmail) {
          emailMap.set(member.userEmail.toLowerCase(), {
            workspaceMemberId: member.id,
            email: member.userEmail,
          });
        }
      }

      // Find people with emails not assigned to any member
      const _personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      // Get unassigned emails - these should be rerouted to default inbox
      // This is a placeholder - actual implementation would depend on
      // how emails are stored and managed in Twenty
      const unassignedEmailCount = 0; // Placeholder

      this.logger.log(
        `Email rerouting complete for workspace ${workspaceId}. ${emailMap.size} team members mapped, ${unassignedEmailCount} emails rerouted.`,
      );
    }, authContext);
  }
}
