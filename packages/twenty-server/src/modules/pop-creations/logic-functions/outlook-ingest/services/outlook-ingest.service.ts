import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

@Injectable()
export class OutlookIngestService {
  private readonly logger = new Logger(OutlookIngestService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async ingestOutlookEmails(workspaceId: string): Promise<void> {
    this.logger.log(
      `Starting Outlook email ingestion for workspace ${workspaceId}`,
    );

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      // In a real implementation, this would:
      // 1. Authenticate with Microsoft Graph API
      // 2. Fetch emails from Outlook inbox
      // 3. Parse email content and attachments
      // 4. Create email thread records in Twenty
      // 5. Link emails to existing contacts/companies

      this.logger.log(
        `Outlook email ingestion complete for workspace ${workspaceId}`,
      );
    }, authContext);
  }
}
