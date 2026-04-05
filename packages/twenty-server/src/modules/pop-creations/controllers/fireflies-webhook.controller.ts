/**
 * FirefliesWebhookController
 *
 * Receives Fireflies AI webhook payloads, creates MeetingNote records
 * with routing and participant linking.
 */

import {
  Body,
  Controller,
  Logger,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  EmailRouterService,
} from 'src/modules/pop-creations/services/email-router.service';
import { type MeetingNoteWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/meeting-note.workspace-entity';
import { type MeetingNoteAttendeeWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/meeting-note-attendee.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';

// ─── Types ──────────────────────────────────────────────────────────────────

type FirefliesTranscript = {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  summary?: {
    overview?: string;
    action_items?: string;
    keywords?: string[];
  };
};

type FirefliesWebhookBody = {
  meetingId?: string;
  clientReferenceId?: string;
  transcript?: FirefliesTranscript;
  workspaceId?: string;
};

@Controller('webhooks/fireflies')
export class FirefliesWebhookController {
  private readonly logger = new Logger(FirefliesWebhookController.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly emailRouterService: EmailRouterService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: FirefliesWebhookBody,
  ): Promise<{ created?: string; skipped?: string; error?: string }> {
    // The workspace ID must be passed in the webhook payload or configured
    const workspaceId =
      body.workspaceId ?? process.env.POP_CREATIONS_WORKSPACE_ID ?? '';

    if (!workspaceId) {
      this.logger.error('No workspaceId in webhook payload or environment');
      return { error: 'missing_workspace_id' };
    }

    const transcript = body?.transcript;

    if (!transcript?.id) {
      this.logger.log('No transcript data in webhook payload, skipping.');
      return { skipped: 'no_transcript' };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        // ── Deduplication ──────────────────────────────────────────────
        const meetingNoteRepo =
          await this.globalWorkspaceOrmManager.getRepository<MeetingNoteWorkspaceEntity>(
            workspaceId,
            'meetingNote',
            { shouldBypassPermissionChecks: true },
          );

        const existing = await meetingNoteRepo.findOne({
          where: { firefliesTranscriptId: transcript.id } as any,
        });

        if (existing) {
          this.logger.log(
            `MeetingNote for transcript ${transcript.id} already exists, skipping.`,
          );
          return { skipped: 'duplicate' };
        }

        // ── Prepare data ───────────────────────────────────────────────
        const participantsList = (transcript.participants ?? []).join(', ');
        const meetingDate = transcript.date
          ? new Date(Number(transcript.date)).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // ── Route to program ───────────────────────────────────────────
        const routing = await this.emailRouterService.routeEmail(
          workspaceId,
          {
            subject: transcript.title ?? '',
            bodyText: [
              transcript.summary?.overview ?? '',
              transcript.summary?.action_items ?? '',
              (transcript.summary?.keywords ?? []).join(' '),
            ].join(' '),
            emailAddresses: transcript.participants ?? [],
            task: 'firefliesRoutingModel',
          },
        );

        // ── Company fallback via participant domains ───────────────────
        if (!routing.companyId) {
          const companyRepo =
            await this.globalWorkspaceOrmManager.getRepository<CompanyWorkspaceEntity>(
              workspaceId,
              'company',
              { shouldBypassPermissionChecks: true },
            );

          const externalParticipants = (
            transcript.participants ?? []
          ).filter((e) => !e.toLowerCase().endsWith('@popcre.com'));

          for (const ext of externalParticipants) {
            const domain = ext.split('@')[1]?.toLowerCase();
            if (!domain) continue;

            const company = await companyRepo
              .createQueryBuilder('company')
              .where(
                `company."domainNamePrimaryLinkUrl" ILIKE :domain`,
                { domain: `%${domain}%` },
              )
              .limit(1)
              .getOne();

            if (company) {
              routing.companyId = company.id;
              break;
            }
          }
        }

        // ── Match participants to People ───────────────────────────────
        const internalParticipants = (
          transcript.participants ?? []
        ).filter((e) => e.toLowerCase().endsWith('@popcre.com'));

        const personRepo =
          await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const personIds: string[] = [];
        for (const email of internalParticipants) {
          const person = await personRepo.findOne({
            where: {
              emails: { primaryEmail: email.toLowerCase() },
            } as any,
          });
          if (person) personIds.push(person.id);
        }

        // ── Create MeetingNote ─────────────────────────────────────────
        const meetingNote = meetingNoteRepo.create({
          name: transcript.title ?? `Meeting — ${meetingDate}`,
          date: meetingDate,
          participants: participantsList,
          summary: transcript.summary?.overview ?? '',
          actionItems: transcript.summary?.action_items ?? '',
          source: 'FIREFLIES_AUTO_IMPORT',
          firefliesTranscriptId: transcript.id,
          programId: routing.programId ?? null,
          companyId: routing.companyId ?? null,
          departmentId: routing.departmentId ?? null,
          personId: personIds[0] ?? null,
        } as any);

        const saved = await meetingNoteRepo.save(meetingNote);
        const createdId = saved.id;

        // ── Create MeetingNoteAttendee records ─────────────────────────
        if (personIds.length > 0) {
          const attendeeRepo =
            await this.globalWorkspaceOrmManager.getRepository<MeetingNoteAttendeeWorkspaceEntity>(
              workspaceId,
              'meetingNoteAttendee',
              { shouldBypassPermissionChecks: true },
            );

          for (const personId of personIds) {
            const attendee = attendeeRepo.create({
              meetingNoteId: createdId,
              personId,
            } as any);
            await attendeeRepo.save(attendee);
          }
        }

        this.logger.log(
          `Created MeetingNote ${createdId} for "${transcript.title}"` +
            (routing.routingStatus === 'ROUTED'
              ? ` — routed via ${routing.routingMethod}`
              : ` — ${routing.routingStatus}`) +
            (personIds.length > 0
              ? ` — linked ${personIds.length} internal attendee(s)`
              : ''),
        );

        return { created: createdId };
      },
      authContext,
    );
  }
}
