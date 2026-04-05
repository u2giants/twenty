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
import { In, LessThanOrEqual, Repository } from 'typeorm';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { EmailRouterService } from 'src/modules/pop-creations/services/email-router.service';
import { type EmailMessageWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/email-message.workspace-entity';

// ─── Constants ─────────────────────────────────────────────────────────────

export const EMAIL_REROUTER_CRON_PATTERN = '0 */6 * * *';

const REROUTABLE_STATUSES = ['UNROUTED', 'COMPANY_ONLY', 'COMPANY_DEPT'];
const MIN_AGE_MINUTES = 30;

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
        const emailMessageRepo =
          await this.globalWorkspaceOrmManager.getRepository<EmailMessageWorkspaceEntity>(
            workspaceId,
            'emailMessage',
            { shouldBypassPermissionChecks: true },
          );

        const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000);

        const emails = await emailMessageRepo.find({
          where: {
            routingStatus: In(REROUTABLE_STATUSES),
            createdAt: LessThanOrEqual(cutoff),
          },
        });

        if (emails.length === 0) {
          this.logger.debug(
            `[${workspaceId}] No reroutable emails found`,
          );

          return;
        }

        let processed = 0;
        let improved = 0;
        let errors = 0;

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
              )
            ) {
              await emailMessageRepo.update(email.id, {
                routingStatus: result.routingStatus,
                routingMethod: result.routingMethod,
                companyId: result.companyId,
                departmentId: result.departmentId,
                programId: result.programId,
              } as any);

              improved++;
            }
          } catch (emailError) {
            errors++;
            this.logger.error(
              `[${workspaceId}] Failed to reroute email ${email.id}: ${emailError}`,
            );
          }
        }

        this.logger.log(
          `[${workspaceId}] Email rerouter: processed=${processed}, improved=${improved}, errors=${errors}`,
        );
      },
      authContext,
    );
  }

  private extractAddresses(email: EmailMessageWorkspaceEntity): string[] {
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
