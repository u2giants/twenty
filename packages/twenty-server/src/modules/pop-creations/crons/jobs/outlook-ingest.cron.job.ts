/**
 * OutlookIngestCronJob
 *
 * Polls Microsoft Graph API every 15 minutes for recent emails in the
 * configured Outlook mailbox and creates EmailMessage records in each
 * active workspace. Deduplicates by outlookMessageId and delegates
 * routing to EmailRouterService.
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
import { EmailRouterService } from 'src/modules/pop-creations/services/email-router.service';
import { SoExtractorService } from 'src/modules/pop-creations/services/so-extractor.service';
import { type EmailMessageWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/email-message.workspace-entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

// ─── Constants ─────────────────────────────────────────────────────────────

export const OUTLOOK_INGEST_CRON_PATTERN = '*/15 * * * *';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const LOGIN_BASE = 'https://login.microsoftonline.com';
const LOOKBACK_MINUTES = 5760; // temporarily 4 days to backfill Apr 13-16 gap; revert to 20 after one run
const PAGE_SIZE = 50;
const INTERNAL_DOMAIN = 'popcre.com';

// ─── Types ─────────────────────────────────────────────────────────────────

type GraphEmail = {
  id: string;
  subject: string;
  receivedDateTime: string;
  bodyPreview: string;
  body: { content: string };
  from: { emailAddress: { address: string; name: string } };
  toRecipients: { emailAddress: { address: string; name: string } }[];
  ccRecipients: { emailAddress: { address: string; name: string } }[];
  isRead: boolean;
};

// ─── Job ───────────────────────────────────────────────────────────────────

@Processor(MessageQueue.cronQueue)
export class OutlookIngestCronJob {
  private readonly logger = new Logger(OutlookIngestCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly exceptionHandlerService: ExceptionHandlerService,
    private readonly emailRouterService: EmailRouterService,
    private readonly soExtractorService: SoExtractorService,
  ) {}

  @Process(OutlookIngestCronJob.name)
  @SentryCronMonitor(OutlookIngestCronJob.name, OUTLOOK_INGEST_CRON_PATTERN)
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
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const mailbox = process.env.OUTLOOK_MAILBOX ?? 'adweck@popcre.com';
    const isGated = process.env.OUTLOOK_GATED === 'true';

    if (!tenantId || !clientId || !clientSecret) {
      this.logger.warn(
        'Missing Azure credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET). Skipping Outlook ingest.',
      );

      return;
    }

    // 1. Acquire Microsoft Graph access token
    const accessToken = await this.getGraphToken(
      tenantId,
      clientId,
      clientSecret,
    );

    // 2. Fetch recent emails from Graph
    const since = new Date(
      Date.now() - LOOKBACK_MINUTES * 60 * 1000,
    ).toISOString();

    const emails = await this.fetchRecentEmails(
      accessToken,
      mailbox,
      since,
    );

    if (emails.length === 0) {
      this.logger.debug(
        `No new emails found for ${mailbox} since ${since}`,
      );

      return;
    }

    this.logger.log(
      `Fetched ${emails.length} emails for ${mailbox} since ${since}`,
    );

    // 3. Process each email within workspace context
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const emailMessageRepo =
          await this.globalWorkspaceOrmManager.getRepository<EmailMessageWorkspaceEntity>(
            workspaceId,
            'emailMessage',
            { shouldBypassPermissionChecks: true },
          );

        // Resolve workspace member for createdBy
        const createdByMemberId = await this.resolveWorkspaceMember(
          workspaceId,
          mailbox,
        );

        for (const graphEmail of emails) {
          try {
            await this.processEmail(
              workspaceId,
              graphEmail,
              mailbox,
              isGated,
              emailMessageRepo,
              createdByMemberId,
            );
          } catch (emailError) {
            this.logger.error(
              `Failed to process email ${graphEmail.id}: ${emailError}`,
            );
          }
        }
      },
      authContext,
    );
  }

  private async processEmail(
    workspaceId: string,
    graphEmail: GraphEmail,
    mailbox: string,
    isGated: boolean,
    emailMessageRepo: any,
    createdByMemberId: string | null,
  ): Promise<void> {
    // Collect all email addresses on this message
    const allAddresses = this.extractAllAddresses(graphEmail);

    // Gating: skip if all addresses are internal-only
    if (isGated) {
      const hasExternal = allAddresses.some(
        (addr) =>
          !addr.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`),
      );

      if (!hasExternal) {
        this.logger.debug(
          `Gated: skipping internal-only email "${graphEmail.subject}"`,
        );

        return;
      }
    }

    // Deduplication check
    const existing = await emailMessageRepo.findOne({
      where: { outlookMessageId: graphEmail.id },
    });

    if (existing) {
      return;
    }

    // Route the email — pass full body so the router can scan quoted thread
    // headers for customer addresses even when the top-level email only has
    // internal addresses (e.g. a reply from adweck@ to a customer thread).
    // Display names are passed so the router can disambiguate companies that
    // share a domain (e.g. Ross Stores vs DD's, both on @ros.com).
    const routingResult = await this.emailRouterService.routeEmail(
      workspaceId,
      {
        subject: graphEmail.subject ?? '',
        bodyText: graphEmail.body?.content || graphEmail.bodyPreview || '',
        emailAddresses: allAddresses,
        displayNames: this.buildDisplayNameMap(graphEmail),
      },
    );

    // Build recipients string
    const toAddresses = graphEmail.toRecipients
      .map((r) => r.emailAddress.address)
      .join(', ');
    const ccAddresses = graphEmail.ccRecipients
      .map((r) => r.emailAddress.address)
      .join(', ');
    const recipients = [toAddresses, ccAddresses]
      .filter(Boolean)
      .join(', ');

    // Extract SO/PO numbers from the body (full body preferred, preview as fallback)
    const bodyForExtraction =
      graphEmail.body?.content || graphEmail.bodyPreview || '';
    const detectedSoNumbers =
      this.soExtractorService.extractAsString(bodyForExtraction);

    // Create EmailMessage record
    await emailMessageRepo.save({
      subject: graphEmail.subject ?? '(no subject)',
      sender: graphEmail.from?.emailAddress?.address ?? '',
      recipients,
      receivedAt: new Date(graphEmail.receivedDateTime),
      bodyPreview: graphEmail.bodyPreview ?? '',
      outlookMessageId: graphEmail.id,
      routingStatus: routingResult.routingStatus,
      routingMethod: routingResult.routingMethod,
      companyId: routingResult.companyId,
      departmentId: routingResult.departmentId,
      programId: routingResult.programId,
      detectedSoNumbers,
      mailboxOwnerId: createdByMemberId ?? null,
      createdBy: createdByMemberId
        ? { source: 'SYSTEM', workspaceMemberId: createdByMemberId }
        : { source: 'SYSTEM' },
      position: 0,
    });

    this.logger.debug(
      `Ingested email "${graphEmail.subject}" → ${routingResult.routingStatus}`,
    );
  }

  /** Build a map of address.toLowerCase() → display name for all participants. */
  private buildDisplayNameMap(graphEmail: GraphEmail): Record<string, string> {
    const map: Record<string, string> = {};
    const add = (ea: { address: string; name: string } | undefined) => {
      if (ea?.address && ea.name) {
        map[ea.address.toLowerCase()] = ea.name;
      }
    };
    add(graphEmail.from?.emailAddress);
    for (const r of graphEmail.toRecipients ?? []) add(r.emailAddress);
    for (const r of graphEmail.ccRecipients ?? []) add(r.emailAddress);
    return map;
  }

  private extractAllAddresses(graphEmail: GraphEmail): string[] {
    const addresses: string[] = [];

    if (graphEmail.from?.emailAddress?.address) {
      addresses.push(graphEmail.from.emailAddress.address);
    }

    for (const r of graphEmail.toRecipients ?? []) {
      if (r.emailAddress?.address) {
        addresses.push(r.emailAddress.address);
      }
    }

    for (const r of graphEmail.ccRecipients ?? []) {
      if (r.emailAddress?.address) {
        addresses.push(r.emailAddress.address);
      }
    }

    return addresses;
  }

  private async getGraphToken(
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const tokenUrl = `${LOGIN_BASE}/${tenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Failed to acquire Graph token: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();

    return data.access_token;
  }

  private async fetchRecentEmails(
    accessToken: string,
    mailbox: string,
    since: string,
  ): Promise<GraphEmail[]> {
    const selectFields = [
      'id',
      'subject',
      'receivedDateTime',
      'bodyPreview',
      'body',
      'from',
      'toRecipients',
      'ccRecipients',
      'isRead',
    ].join(',');

    const filterParam = `receivedDateTime ge ${since}`;
    const url =
      `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/messages` +
      `?$filter=${encodeURIComponent(filterParam)}` +
      `&$select=${selectFields}` +
      `&$top=${PAGE_SIZE}` +
      `&$orderby=${encodeURIComponent('receivedDateTime desc')}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Graph API messages fetch failed: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();

    return (data.value ?? []) as GraphEmail[];
  }

  private async resolveWorkspaceMember(
    workspaceId: string,
    mailboxEmail: string,
  ): Promise<string | null> {
    try {
      const memberRepo =
        await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
          workspaceId,
          'workspaceMember',
          { shouldBypassPermissionChecks: true },
        );

      const members = await memberRepo.find();

      const match = members.find(
        (m: any) =>
          m.userEmail?.toLowerCase() === mailboxEmail.toLowerCase(),
      );

      return match?.id ?? null;
    } catch {
      this.logger.warn(
        `Could not resolve workspace member for ${mailboxEmail}`,
      );

      return null;
    }
  }
}
