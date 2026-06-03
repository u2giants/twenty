/**
 * EmailRerouterCronJob
 *
 * Re-processes partially routed or unrouted emails every 6 hours.
 * Finds EmailMessage records with routingStatus IN ('UNROUTED', 'COMPANY_ONLY',
 * 'COMPANY_DEPT') that were created at least 30 minutes ago, re-runs the
 * routing pipeline, and updates the record if an improvement is found.
 */

import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { Repository } from 'typeorm';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { EmailRouterService } from 'src/modules/pop-creations/services/email-router.service';

// ─── Constants ─────────────────────────────────────────────────────────────

export const EMAIL_REROUTER_CRON_PATTERN = '0 */6 * * *';

const REROUTABLE_STATUSES = ['UNROUTED', 'COMPANY_ONLY', 'COMPANY_DEPT'];
const MIN_AGE_MINUTES = 30;
const BATCH_SIZE = 500;

// ─── Email row from raw SQL ─────────────────────────────────────────────────

type EmailRow = {
  id: string;
  createdAt: string;
  subject: string | null;
  bodyPreview: string | null;
  sender: string | null;
  recipients: string | null;
  routingStatus: string;
  companyId: string | null;
};

// ─── Job ───────────────────────────────────────────────────────────────────

@Processor(MessageQueue.cronQueue)
export class EmailRerouterCronJob {
  private readonly logger = new Logger(EmailRerouterCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly exceptionHandlerService: ExceptionHandlerService,
    private readonly emailRouterService: EmailRouterService,
  ) {}

  @Process(EmailRerouterCronJob.name)
  @SentryCronMonitor(EmailRerouterCronJob.name, EMAIL_REROUTER_CRON_PATTERN)
  async handle(): Promise<void> {
    const activeWorkspaces = await this.workspaceRepository.find({
      where: { activationStatus: WorkspaceActivationStatus.ACTIVE },
    });

    for (const workspace of activeWorkspaces) {
      try {
        await this.processWorkspace(workspace.id);
      } catch (error) {
        this.exceptionHandlerService.captureExceptions([error], {
          workspace: { id: workspace.id },
        });
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async processWorkspace(workspaceId: string): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const dataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSource();
        const schemaName = getWorkspaceSchemaName(workspaceId);
        const cutoffIso = new Date(
          Date.now() - MIN_AGE_MINUTES * 60 * 1000,
        ).toISOString();
        const statusList = REROUTABLE_STATUSES.map((s) => `'${s}'`).join(', ');

        let processed = 0;
        let improved = 0;
        let errors = 0;
        let lastCreatedAt: string | null = null;
        let lastId: string | null = null;

        while (true) {
          const emails: EmailRow[] = await dataSource.query(
            `SELECT id, "createdAt", subject, "bodyPreview", sender, recipients,
                "routingStatus", "companyId"
         FROM "${schemaName}"."_emailMessage"
         WHERE "routingStatus" IN (${statusList})
           AND "createdAt" <= $1
           AND (
             $2::timestamptz IS NULL
             OR "createdAt" > $2
             OR ("createdAt" = $2 AND id > $3)
           )
         ORDER BY "createdAt" ASC, id ASC
         LIMIT $4`,
            [cutoffIso, lastCreatedAt, lastId, BATCH_SIZE],
            undefined,
            { shouldBypassPermissionChecks: true },
          );

          if (emails.length === 0) {
            if (processed === 0) {
              this.logger.debug(`[${workspaceId}] No reroutable emails found`);
            }

            break;
          }

          for (const email of emails) {
            try {
              const allAddresses = this.extractAddresses(email);

              const result = await this.emailRouterService.routeEmail(
                workspaceId,
                {
                  subject: email.subject ?? '',
                  bodyText: email.bodyPreview ?? '',
                  emailAddresses: allAddresses,
                },
              );

              processed++;

              if (
                this.emailRouterService.isImprovement(
                  email.routingStatus ?? 'UNROUTED',
                  result,
                  email.companyId ?? null,
                )
              ) {
                await dataSource.query(
                  `UPDATE "${schemaName}"."_emailMessage"
               SET "routingStatus" = $1,
                   "routingMethod" = $2,
                   "companyId"     = $3,
                   "departmentId"  = $4,
                   "programId"     = $5,
                   "updatedAt"     = NOW()
               WHERE id = $6`,
                  [
                    result.routingStatus,
                    result.routingMethod,
                    result.companyId,
                    result.departmentId,
                    result.programId,
                    email.id,
                  ],
                  undefined,
                  { shouldBypassPermissionChecks: true },
                );

                improved++;
              }
            } catch (emailError) {
              errors++;
              this.logger.error(
                `[${workspaceId}] Failed to reroute email ${email.id}: ${emailError}`,
              );
            }
          }

          const lastEmail = emails[emails.length - 1];

          lastCreatedAt = lastEmail.createdAt;
          lastId = lastEmail.id;
        }

        this.logger.log(
          `[${workspaceId}] Email rerouter: processed=${processed}, improved=${improved}, errors=${errors}`,
        );
      },
      authContext,
      { lite: true },
    );
  }

  private extractAddresses(email: EmailRow): string[] {
    const addresses: string[] = [];

    if (email.sender) {
      addresses.push(email.sender);
    }

    if (email.recipients) {
      for (const addr of email.recipients.split(',')) {
        const trimmed = addr.trim();
        if (trimmed) {
          addresses.push(trimmed);
        }
      }
    }

    return addresses;
  }
}
