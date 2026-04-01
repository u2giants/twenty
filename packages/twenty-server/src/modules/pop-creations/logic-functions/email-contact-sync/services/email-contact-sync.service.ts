import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

@Injectable()
export class EmailContactSyncService {
  private readonly logger = new Logger(EmailContactSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async syncEmailsToContacts(workspaceId: string): Promise<void> {
    this.logger.log(
      `Starting email-to-contact sync for workspace ${workspaceId}`,
    );

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      // Find people without email addresses
      const peopleWithoutEmail = await personRepository.find({
        where: {
          email: null,
        },
      });

      // In a real implementation, this would:
      // 1. Fetch emails from email provider (Gmail, Outlook, etc.)
      // 2. Extract sender/recipient email addresses
      // 3. Match to existing contacts or create new ones
      // 4. Link email threads to contacts

      this.logger.log(
        `Email-to-contact sync complete. Found ${peopleWithoutEmail.length} people without email.`,
      );
    }, authContext);
  }
}
