import { Injectable, Logger, Scope } from '@nestjs/common';

import {
  type ObjectRecordCreateEvent,
  type ObjectRecordUpdateEvent,
} from 'twenty-shared/database-events';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type EmailMessageWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/email-message.workspace-entity';
import { type IgnoreRuleWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/ignore-rule.workspace-entity';
import { type LicensorApprovalThreadWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/licensor-approval-thread.workspace-entity';
import { type TaskWorkspaceEntity } from 'src/modules/task/standard-objects/task.workspace-entity';
import { type TaskTargetWorkspaceEntity } from 'src/modules/task/standard-objects/task-target.workspace-entity';

// ─── Constants ──────────────────────────────────────────────────────────────

const BUYER_CONTACT_TYPES = ['BUYER', 'ASSISTANT_BUYER', 'PLANNER'];
const COMPANY_WIDE_CONTACT_TYPES = [
  'CHINA_OFFICE',
  'LOGISTICS',
  'LEGAL',
  'FINANCE',
];

const SUBJECT_PREFIX_PATTERN = /^(re:\s*|fw:\s*|fwd:\s*)+/i;

const PAGE_SIZE = 100;

// ─── Listener ───────────────────────────────────────────────────────────────

@Injectable({ scope: Scope.REQUEST })
export class PopCreationsRecordListener {
  private readonly logger = new Logger(PopCreationsRecordListener.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  // ─── 1. Company customerStatus updated → sync to all linked People ──────

  @OnDatabaseBatchEvent('company', DatabaseEventAction.UPDATED)
  async handleCompanyStatusUpdated(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<CompanyWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;

    for (const event of events) {
      const { before, after } = event.properties;

      if (before.customerStatus === after.customerStatus) {
        continue;
      }

      this.logger.log(
        `Company ${after.id} customerStatus changed: ${before.customerStatus} → ${after.customerStatus}`,
      );

      const authContext = buildSystemAuthContext(workspaceId);

      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const personRepo =
            await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
              workspaceId,
              'person',
              { shouldBypassPermissionChecks: true },
            );

          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            const people = await personRepo.find({
              where: { companyId: after.id },
              take: PAGE_SIZE,
              skip: offset,
            });

            if (people.length === 0) {
              hasMore = false;
              break;
            }

            const personIds = people.map((p) => p.id);

            await personRepo.update(personIds, {
              companyCustomerStatus: after.customerStatus,
            } as any);

            this.logger.log(
              `Updated companyCustomerStatus for ${people.length} people (offset ${offset})`,
            );

            offset += PAGE_SIZE;

            if (people.length < PAGE_SIZE) {
              hasMore = false;
            }
          }
        },
        authContext,
      );
    }
  }

  // ─── 2 & 4. Person created → sync companyCustomerStatus + auto-set scope ─

  @OnDatabaseBatchEvent('person', DatabaseEventAction.CREATED)
  async handlePersonCreated(
    payload: WorkspaceEventBatch<
      ObjectRecordCreateEvent<PersonWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const personRepo =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const companyRepo =
          await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );

        for (const event of events) {
          const person = event.properties.after;
          const updates: Partial<PersonWorkspaceEntity> = {};

          // --- Sync companyCustomerStatus from parent Company ---
          if (person.companyId) {
            const company = await companyRepo.findOne({
              where: { id: person.companyId },
            });

            if (company) {
              updates.companyCustomerStatus = company.customerStatus;
            }
          }

          // --- Auto-set scope based on contactType ---
          if (!person.scope && person.contactType) {
            if (BUYER_CONTACT_TYPES.includes(person.contactType)) {
              updates.scope = 'DEPARTMENT';
            } else if (
              COMPANY_WIDE_CONTACT_TYPES.includes(person.contactType)
            ) {
              updates.scope = 'COMPANY_WIDE';
            } else if (person.contactType === 'OTHER') {
              updates.scope = 'IGNORED';
            }
          }

          if (Object.keys(updates).length > 0) {
            await personRepo.update(person.id, updates as any);

            this.logger.log(
              `Person ${person.id} created: applied updates ${JSON.stringify(updates)}`,
            );
          }
        }
      },
      authContext,
    );
  }

  // ─── 3. Person updated (companyId changed) → sync companyCustomerStatus ──

  @OnDatabaseBatchEvent('person', DatabaseEventAction.UPDATED)
  async handlePersonCompanyChanged(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<PersonWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const personRepo =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const companyRepo =
          await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );

        for (const event of events) {
          const { before, after } = event.properties;

          if (before.companyId === after.companyId) {
            continue;
          }

          if (!after.companyId) {
            // Company removed — clear companyCustomerStatus
            await personRepo.update(after.id, {
              companyCustomerStatus: null,
            } as any);

            this.logger.log(
              `Person ${after.id} company removed: cleared companyCustomerStatus`,
            );
          } else {
            // Company changed — look up new company's customerStatus
            const company = await companyRepo.findOne({
              where: { id: after.companyId },
            });

            if (company) {
              await personRepo.update(after.id, {
                companyCustomerStatus: company.customerStatus,
              } as any);

              this.logger.log(
                `Person ${after.id} company changed to ${after.companyId}: set companyCustomerStatus = ${company.customerStatus}`,
              );
            }
          }
        }
      },
      authContext,
    );
  }

  // ─── 5. IgnoreRule created → bulk-skip matching UNROUTED emails ───────────

  @OnDatabaseBatchEvent('ignoreRule', DatabaseEventAction.CREATED)
  async handleIgnoreRuleCreated(
    payload: WorkspaceEventBatch<
      ObjectRecordCreateEvent<IgnoreRuleWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const emailRepo =
          await this.globalWorkspaceOrmManager.getRepository<EmailMessageWorkspaceEntity>(
            workspaceId,
            'emailMessage',
            { shouldBypassPermissionChecks: true },
          );

        const ignoreRuleRepo =
          await this.globalWorkspaceOrmManager.getRepository<IgnoreRuleWorkspaceEntity>(
            workspaceId,
            'ignoreRule',
            { shouldBypassPermissionChecks: true },
          );

        for (const event of events) {
          const rule = event.properties.after;
          const pattern = rule.pattern;
          const matchType = rule.matchType;

          if (!pattern || !matchType) {
            continue;
          }

          this.logger.log(
            `IgnoreRule created: pattern="${pattern}", matchType=${matchType}`,
          );

          // Fetch all UNROUTED emails and filter by match
          let offset = 0;
          let totalSkipped = 0;
          let hasMore = true;

          while (hasMore) {
            const emails = await emailRepo.find({
              where: { routingStatus: 'UNROUTED' },
              take: PAGE_SIZE,
              skip: offset,
            });

            if (emails.length === 0) {
              hasMore = false;
              break;
            }

            const matchingIds: string[] = [];

            for (const email of emails) {
              if (this.subjectMatchesRule(email.subject, pattern, matchType)) {
                matchingIds.push(email.id);
              }
            }

            if (matchingIds.length > 0) {
              await emailRepo.update(matchingIds, {
                routingStatus: 'SKIPPED',
                routingMethod: 'AUTO_SKIP',
              } as any);

              totalSkipped += matchingIds.length;
            }

            offset += PAGE_SIZE;

            if (emails.length < PAGE_SIZE) {
              hasMore = false;
            }
          }

          // Update the IgnoreRule's emailsSkipped count
          if (totalSkipped > 0) {
            const currentRule = await ignoreRuleRepo.findOne({
              where: { id: rule.id },
            });

            const currentCount = currentRule?.emailsSkipped ?? 0;

            await ignoreRuleRepo.update(rule.id, {
              emailsSkipped: currentCount + totalSkipped,
            } as any);

            this.logger.log(
              `IgnoreRule ${rule.id}: skipped ${totalSkipped} emails (total now ${currentCount + totalSkipped})`,
            );
          }
        }
      },
      authContext,
    );
  }

  // ─── 6. Opportunity stage updated → create follow-up tasks ────────────────

  @OnDatabaseBatchEvent('opportunity', DatabaseEventAction.UPDATED)
  async handleOpportunityStageChanged(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<OpportunityWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        for (const event of events) {
          const { before, after } = event.properties;

          if (before.stage === after.stage) {
            continue;
          }

          this.logger.log(
            `Opportunity ${after.id} stage changed: ${before.stage} → ${after.stage}`,
          );

          const tasksToCreate: string[] = [];

          switch (after.stage) {
            case 'BUYER_REVIEW':
              if (after.licensed) {
                await this.createLicensorApprovalThread(workspaceId, after);
              }
              if (after.requiresNewPricing) {
                tasksToCreate.push('Get factory pricing');
              }
              break;

            case 'PRICING_AND_SAMPLING':
              if (after.sampleRequired) {
                tasksToCreate.push('Request sample');
                tasksToCreate.push('Schedule sample review');
              }
              break;

            case 'IN_PRODUCTION':
              tasksToCreate.push('Send Production PO');
              tasksToCreate.push('Send art files');
              if (after.sampleRequired) {
                tasksToCreate.push(
                  'Request sample with production PO',
                );
              }
              break;
          }

          if (tasksToCreate.length > 0) {
            await this.createTasksForOpportunity(
              workspaceId,
              after.id,
              tasksToCreate,
            );
          }
        }
      },
      authContext,
    );
  }

  // ─── 7. Opportunity created → create standard task checklist ──────────────

  @OnDatabaseBatchEvent('opportunity', DatabaseEventAction.CREATED)
  async handleOpportunityCreated(
    payload: WorkspaceEventBatch<
      ObjectRecordCreateEvent<OpportunityWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        for (const event of events) {
          const opportunity = event.properties.after;

          this.logger.log(
            `Opportunity ${opportunity.id} created: generating standard task checklist`,
          );

          const tasksToCreate: string[] = [
            'Confirm directive details',
            'Set up program record',
            'Identify and assign factory',
          ];

          if (opportunity.sampleRequired) {
            tasksToCreate.push('Arrange sample production and shipment');
          }

          if (opportunity.licensed) {
            tasksToCreate.push('Create LAT and submit artwork');
          }

          await this.createTasksForOpportunity(
            workspaceId,
            opportunity.id,
            tasksToCreate,
          );
        }
      },
      authContext,
    );
  }

  // ─── 8. LicensorApprovalThread stage updated → create follow-up tasks ────

  @OnDatabaseBatchEvent('licensorApprovalThread', DatabaseEventAction.UPDATED)
  async handleLicensorApprovalThreadStageChanged(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<LicensorApprovalThreadWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        for (const event of events) {
          const { before, after } = event.properties;

          if (before.stage === after.stage) {
            continue;
          }

          this.logger.log(
            `LicensorApprovalThread ${after.id} stage changed: ${before.stage} → ${after.stage}`,
          );

          const stageTaskMap: Record<string, string> = {
            SUBMITTED_TO_LICENSOR:
              'Follow up with licensor on submission status',
            RESUBMIT_REQUIRED:
              'Address licensor comments and resubmit artwork',
            FIRST_APPROVAL: 'Obtain final approval from licensor',
            APPROVED:
              'Confirm licensor approval received — proceed to production',
            REJECTED:
              'Review rejection with buyer and decide next steps',
          };

          const taskTitle = stageTaskMap[after.stage ?? ''];

          if (taskTitle && after.programId) {
            await this.createTasksForOpportunity(
              workspaceId,
              after.programId,
              [taskTitle],
            );

            this.logger.log(
              `Created task "${taskTitle}" for program ${after.programId}`,
            );
          }
        }
      },
      authContext,
    );
  }

  // ─── 9. EmailMessage ignoreSubject toggled → create IgnoreRule + bulk-skip ─

  @OnDatabaseBatchEvent('emailMessage', DatabaseEventAction.UPDATED)
  async handleEmailIgnoreSubject(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<EmailMessageWorkspaceEntity>
    >,
  ) {
    const { workspaceId, events } = payload;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        for (const event of events) {
          const { before, after } = event.properties;

          // Only fire when ignoreSubject is toggled ON
          if (
            (before as any).ignoreSubject === (after as any).ignoreSubject ||
            !(after as any).ignoreSubject
          ) {
            continue;
          }

          const subject = (after as any).subject;
          if (!subject) continue;

          const normalized = this.normalizeSubject(subject);
          if (normalized.length < 3) continue;

          this.logger.log(
            `ignore-subject-trigger: "${normalized}" on email ${after.id}`,
          );

          // 1. Create an IgnoreRule
          const ignoreRuleRepo =
            await this.globalWorkspaceOrmManager.getRepository<IgnoreRuleWorkspaceEntity>(
              workspaceId,
              'ignoreRule',
              { shouldBypassPermissionChecks: true },
            );

          const rule = await ignoreRuleRepo.save({
            pattern: normalized,
            matchType: 'CONTAINS',
          } as any);

          // 2. Bulk-skip all matching UNROUTED emails
          const emailRepo =
            await this.globalWorkspaceOrmManager.getRepository<EmailMessageWorkspaceEntity>(
              workspaceId,
              'emailMessage',
              { shouldBypassPermissionChecks: true },
            );

          let offset = 0;
          let totalSkipped = 0;
          let hasMore = true;

          while (hasMore) {
            const emails = await emailRepo.find({
              where: { routingStatus: 'UNROUTED' },
              take: PAGE_SIZE,
              skip: offset,
            });

            if (emails.length === 0) break;

            const matchingIds: string[] = [];
            for (const email of emails) {
              const emailNormalized = this.normalizeSubject(
                email.subject,
              );
              if (
                emailNormalized.toLowerCase() ===
                normalized.toLowerCase()
              ) {
                matchingIds.push(email.id);
              }
            }

            if (matchingIds.length > 0) {
              await emailRepo.update(matchingIds, {
                routingStatus: 'SKIPPED',
                routingMethod: 'AUTO_SKIP',
              } as any);
              totalSkipped += matchingIds.length;
            }

            offset += PAGE_SIZE;
            if (emails.length < PAGE_SIZE) hasMore = false;
          }

          // 3. Skip the triggering email too
          await emailRepo.update(after.id, {
            routingStatus: 'SKIPPED',
            routingMethod: 'AUTO_SKIP',
          } as any);

          // 4. Update the rule with the count
          if (rule?.id) {
            await ignoreRuleRepo.update(rule.id, {
              emailsSkipped: totalSkipped + 1,
            } as any);
          }

          this.logger.log(
            `ignore-subject-trigger: "${normalized}" → skipped ${totalSkipped + 1} emails, rule created`,
          );
        }
      },
      authContext,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Normalize a subject line by stripping RE:/FW:/Fwd: prefixes.
   */
  private normalizeSubject(subject: string | null): string {
    if (!subject) {
      return '';
    }

    return subject.replace(SUBJECT_PREFIX_PATTERN, '').trim();
  }

  /**
   * Check if a subject matches an IgnoreRule pattern.
   */
  private subjectMatchesRule(
    rawSubject: string | null,
    pattern: string,
    matchType: string,
  ): boolean {
    const subject = this.normalizeSubject(rawSubject);
    const normalizedPattern = pattern.toLowerCase();
    const normalizedSubject = subject.toLowerCase();

    switch (matchType) {
      case 'EXACT':
        return normalizedSubject === normalizedPattern;
      case 'STARTS_WITH':
        return normalizedSubject.startsWith(normalizedPattern);
      case 'CONTAINS':
        return normalizedSubject.includes(normalizedPattern);
      default:
        return false;
    }
  }

  /**
   * Create a LicensorApprovalThread with stage CONCEPT_SUBMIT and a
   * follow-up task for the parent opportunity.
   */
  private async createLicensorApprovalThread(
    workspaceId: string,
    opportunity: OpportunityWorkspaceEntity,
  ): Promise<void> {
    const latRepo =
      await this.globalWorkspaceOrmManager.getRepository<LicensorApprovalThreadWorkspaceEntity>(
        workspaceId,
        'licensorApprovalThread',
        { shouldBypassPermissionChecks: true },
      );

    await latRepo.save({
      stage: 'CONCEPT_SUBMIT',
      programId: opportunity.id,
      propertyName: opportunity.name ?? null,
    } as any);

    await this.createTasksForOpportunity(workspaceId, opportunity.id, [
      'Submit concept to licensor for approval',
    ]);

    this.logger.log(
      `Created LicensorApprovalThread (CONCEPT_SUBMIT) for opportunity ${opportunity.id}`,
    );
  }

  /**
   * Create Task records and link them to an Opportunity via TaskTarget.
   */
  private async createTasksForOpportunity(
    workspaceId: string,
    opportunityId: string,
    taskTitles: string[],
  ): Promise<void> {
    const taskRepo =
      await this.globalWorkspaceOrmManager.getRepository<TaskWorkspaceEntity>(
        workspaceId,
        'task',
        { shouldBypassPermissionChecks: true },
      );

    const taskTargetRepo =
      await this.globalWorkspaceOrmManager.getRepository<TaskTargetWorkspaceEntity>(
        workspaceId,
        'taskTarget',
        { shouldBypassPermissionChecks: true },
      );

    for (const title of taskTitles) {
      const task = await taskRepo.save({
        title,
        status: 'TODO',
      } as any);

      await taskTargetRepo.save({
        taskId: task.id,
        targetOpportunityId: opportunityId,
      } as any);

      this.logger.log(
        `Created task "${title}" linked to opportunity ${opportunityId}`,
      );
    }
  }
}
