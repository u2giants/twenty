/**
 * EmailContactSyncCronJob
 *
 * Daily scan of ingested emails (runs at 2am) to create Company and Person
 * records from external email addresses. Groups addresses by domain, finds
 * or creates Company records, then finds or creates Person records.
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
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type EmailMessageWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/email-message.workspace-entity';

// ─── Constants ─────────────────────────────────────────────────────────────

export const EMAIL_CONTACT_SYNC_CRON_PATTERN = '0 2 * * *';

const INTERNAL_DOMAIN = 'popcre.com';

const NOISE_DOMAINS = new Set([
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'msn.com',
  'ymail.com',
  'googlemail.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'fastmail.com',
]);

// ─── Job ───────────────────────────────────────────────────────────────────

@Processor(MessageQueue.cronQueue)
export class EmailContactSyncCronJob {
  private readonly logger = new Logger(EmailContactSyncCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(EmailContactSyncCronJob.name)
  @SentryCronMonitor(
    EmailContactSyncCronJob.name,
    EMAIL_CONTACT_SYNC_CRON_PATTERN,
  )
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

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const emailMessageRepo =
        await this.globalWorkspaceOrmManager.getRepository<EmailMessageWorkspaceEntity>(
          workspaceId,
          'emailMessage',
          { shouldBypassPermissionChecks: true },
        );

      const companyRepo =
        await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
          workspaceId,
          'company',
          { shouldBypassPermissionChecks: true },
        );

      const personRepo =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      // 1. Collect all unique external email addresses from EmailMessage records
      const allEmails = await emailMessageRepo.find({
        select: ['sender', 'recipients'] as any,
      });

      const uniqueAddresses = new Set<string>();

      for (const email of allEmails) {
        this.extractAddresses(email).forEach((addr) =>
          uniqueAddresses.add(addr.toLowerCase()),
        );
      }

      // 2. Filter out noise domains and internal addresses
      const externalAddresses = [...uniqueAddresses].filter((addr) => {
        const domain = addr.split('@')[1];

        if (!domain) return false;
        if (domain === INTERNAL_DOMAIN) return false;
        if (NOISE_DOMAINS.has(domain)) return false;

        return true;
      });

      if (externalAddresses.length === 0) {
        this.logger.debug(`[${workspaceId}] No external addresses to sync`);

        return;
      }

      // 3. Group by domain
      const domainGroups = new Map<string, string[]>();

      for (const addr of externalAddresses) {
        const domain = addr.split('@')[1]!;
        const existing = domainGroups.get(domain) ?? [];

        existing.push(addr);
        domainGroups.set(domain, existing);
      }

      let companiesCreated = 0;
      let personsCreated = 0;

      // 4. For each domain: find or create Company
      for (const [domain, addresses] of domainGroups) {
        try {
          const companyId = await this.findOrCreateCompany(companyRepo, domain);

          if (companyId) {
            companiesCreated++;
          }

          // 5. For each address: find or create Person
          for (const addr of addresses) {
            try {
              const created = await this.findOrCreatePerson(
                personRepo,
                addr,
                companyId,
              );

              if (created) {
                personsCreated++;
              }
            } catch (personError) {
              this.logger.error(
                `[${workspaceId}] Failed to sync person ${addr}: ${personError}`,
              );
            }
          }
        } catch (domainError) {
          this.logger.error(
            `[${workspaceId}] Failed to sync domain ${domain}: ${domainError}`,
          );
        }
      }

      this.logger.log(
        `[${workspaceId}] Email contact sync: ${externalAddresses.length} addresses, ${companiesCreated} companies created/found, ${personsCreated} persons created`,
      );
    }, authContext);
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

  /**
   * Find an existing company by domain or create one.
   * Returns the company ID (existing or newly created).
   * Returns null only if domain lookup indicates the company was already there.
   */
  private async findOrCreateCompany(
    companyRepo: any,
    domain: string,
  ): Promise<string | null> {
    const domainUrl = `https://${domain}`;

    // Search for existing company by domain — also matches subdomains to parent
    // (e.g. ps.target.com → target.com) using the same reverse ILIKE check as the router
    const existing = await companyRepo
      .createQueryBuilder('company')
      .where(
        `company."domainNamePrimaryLinkUrl" ILIKE :domain` +
          ` OR :rawDomain ILIKE '%.' || REGEXP_REPLACE(company."domainNamePrimaryLinkUrl", '^https?://', '')`,
        { domain: `%${domain}%`, rawDomain: domain },
      )
      .limit(1)
      .getOne();

    if (existing) {
      return existing.id;
    }

    // Create new company — UNASSIGNED until a user classifies it
    const newCompany = await companyRepo.save({
      name: this.domainToCompanyName(domain),
      domainName: {
        primaryLinkUrl: domainUrl,
        primaryLinkLabel: domain,
      },
      customerStatus: 'UNASSIGNED',
      position: 0,
    });

    return newCompany.id;
  }

  /**
   * Find an existing person by email or create one.
   * Returns true if a new person was created.
   */
  private async findOrCreatePerson(
    personRepo: any,
    emailAddress: string,
    companyId: string | null,
  ): Promise<boolean> {
    // Check if person already exists
    const existing = await personRepo
      .createQueryBuilder('person')
      .where(`person."emailsPrimaryEmail" = :email`, {
        email: emailAddress,
      })
      .limit(1)
      .getOne();

    if (existing) {
      return false;
    }

    // Parse name from email address
    const { firstName, lastName } = this.parseNameFromEmail(emailAddress);

    await personRepo.save({
      name: {
        firstName,
        lastName,
      },
      emails: {
        primaryEmail: emailAddress,
      },
      companyId,
      position: 0,
    });

    return true;
  }

  /**
   * Parse first.last@domain.com into { firstName: 'First', lastName: 'Last' }.
   * Falls back to the local part as firstName if no separator found.
   */
  private parseNameFromEmail(email: string): {
    firstName: string;
    lastName: string;
  } {
    const localPart = email.split('@')[0] ?? '';

    // Try common separators: dot, underscore, dash
    const separators = ['.', '_', '-'];

    for (const sep of separators) {
      if (localPart.includes(sep)) {
        const parts = localPart.split(sep);
        const firstName = this.capitalize(parts[0] ?? '');
        const lastName = this.capitalize(parts.slice(1).join(' '));

        return { firstName, lastName };
      }
    }

    // No separator — use the entire local part as firstName
    return {
      firstName: this.capitalize(localPart),
      lastName: '',
    };
  }

  private capitalize(s: string): string {
    if (!s) return '';

    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  private domainToCompanyName(domain: string): string {
    // Strip TLD and capitalize: "acme-corp.com" → "Acme Corp"
    const withoutTld = domain.split('.').slice(0, -1).join('.');

    return withoutTld
      .split(/[-_.]/)
      .map((part) => this.capitalize(part))
      .join(' ');
  }
}
