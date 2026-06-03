import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { isDefined } from 'twenty-shared/utils';
import { type DeepPartial } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { MeetingNoteAttendeeWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/meeting-note-attendee.workspace-entity';
import { MeetingNoteWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/meeting-note.workspace-entity';

import * as crypto from 'crypto';
import type {
  FirefliesMeetingData,
  FirefliesParticipant,
  FirefliesProcessResult,
  FirefliesWebhookPayload,
} from '../types/fireflies-ingest.types';
import { FirefliesApiClient } from './fireflies-api.client';

type WebhookInput = {
  payload: unknown;
  signature?: string;
  headers: Record<string, string>;
  workspaceId?: string;
};

const INTERNAL_DOMAIN = 'popcre.com';

type MatchedParticipant = {
  personId: string | null;
  email: string;
  name: string;
};

type MatchResult = {
  matched: MatchedParticipant[];
  people: PersonWorkspaceEntity[];
};

type AttributionResult = {
  companyId: string | null;
  departmentId: string | null;
};

@Injectable()
export class FirefliesIngestService {
  private readonly logger = new Logger(FirefliesIngestService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly firefliesApiClient: FirefliesApiClient,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workspaceEventEmitter: WorkspaceEventEmitter,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>(
      'FIREFLIES_WEBHOOK_SECRET',
      '',
    );
  }

  async processWebhook(input: WebhookInput): Promise<FirefliesProcessResult> {
    const result: FirefliesProcessResult = {
      success: false,
      errors: [],
    };

    try {
      // Verify webhook signature
      if (this.webhookSecret && input.signature) {
        const isValid = this.verifySignature(input.payload, input.signature);
        if (!isValid) {
          this.logger.warn('Invalid webhook signature');
          result.errors?.push('Invalid webhook signature');
          return result;
        }
      }

      const payload = this.parsePayload(input.payload);

      if (!payload?.meetingId) {
        result.errors?.push('Missing meetingId in payload');
        return result;
      }

      this.logger.log(`Processing meeting: ${payload.meetingId}`);

      // Fetch meeting data from Fireflies API
      const meetingData = await this.firefliesApiClient.fetchMeetingData(
        payload.meetingId,
      );

      // Determine if summary is ready
      result.summaryReady =
        meetingData.summary_status === 'completed' ||
        (meetingData.summary?.action_items?.length ?? 0) > 0 ||
        !!meetingData.summary?.overview;
      result.summaryPending = !result.summaryReady;
      result.actionItemsCount = meetingData.summary?.action_items?.length || 0;

      // If workspace ID provided, perform full CRM integration
      if (input.workspaceId) {
        const integrationResult = await this.integrateWithTwentyCRM(
          input.workspaceId,
          meetingData,
        );
        result.noteIds = integrationResult.noteIds;
        result.newContacts = integrationResult.newContactIds;
      } else {
        this.logger.warn(
          'No workspaceId provided, skipping CRM integration. Webhook processed for API data only.',
        );
      }

      result.success = true;
      result.meetingId = meetingData.id;

      this.logger.log(`Meeting ${meetingData.id} processed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error processing webhook: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      result.errors?.push(message);
    }

    return result;
  }

  private verifySignature(payload: unknown, signature: string): boolean {
    try {
      const payloadString =
        typeof payload === 'string' ? payload : JSON.stringify(payload);

      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');

      return `sha256=${expectedSignature}` === signature;
    } catch (error) {
      this.logger.error(`Error verifying signature: ${error}`);
      return false;
    }
  }

  private parsePayload(params: unknown): FirefliesWebhookPayload | null {
    // Handle string params
    if (typeof params === 'string') {
      try {
        params = JSON.parse(params);
      } catch {
        this.logger.error('Failed to parse string payload');
        return null;
      }
    }

    // Handle wrapped payloads
    if (params && typeof params === 'object') {
      const wrapper = params as Record<string, unknown>;

      // Try common wrapper keys
      const wrapperKeys = ['params', 'payload', 'body', 'data', 'event'];
      for (const key of wrapperKeys) {
        const candidate = wrapper[key];
        if (this.isValidPayload(candidate)) {
          return candidate as FirefliesWebhookPayload;
        }
      }

      // Check if the object itself is a valid payload
      if (this.isValidPayload(params)) {
        return params as FirefliesWebhookPayload;
      }
    }

    return null;
  }

  private isValidPayload(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    const record = obj as Record<string, unknown>;
    return typeof record.meetingId === 'string';
  }

  private async integrateWithTwentyCRM(
    workspaceId: string,
    meetingData: FirefliesMeetingData,
  ): Promise<{ noteIds: string[]; newContactIds: string[] }> {
    const authContext = buildSystemAuthContext(workspaceId);
    const noteIds: string[] = [];
    const newContactIds: string[] = [];

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      // 1. Check for duplicate meetings by firefliesTranscriptId
      const existingNoteId = await this.findMeetingByFirefliesId(
        workspaceId,
        meetingData.id,
      );

      if (existingNoteId) {
        this.logger.log(
          `Meeting ${meetingData.id} already exists as ${existingNoteId}, skipping creation`,
        );
        noteIds.push(existingNoteId);
        return;
      }

      // 2. Match participants to contacts (Person by email)
      const { matched: matchedParticipants, people: matchedPeople } =
        await this.matchParticipantsToContacts(
          workspaceId,
          meetingData.participants,
        );

      // 2b. Exclusive attribution: derive company + department from attendees
      const attribution = this.deriveAttribution(matchedPeople);

      // 3. Create meeting note
      const noteId = await this.createMeetingNote(
        workspaceId,
        meetingData,
        attribution,
      );

      if (noteId) {
        noteIds.push(noteId);

        // 4. Create attendee records for each participant (batched)
        await this.createAttendees(workspaceId, noteId, matchedParticipants);

        // Emit event for other systems to react
        this.workspaceEventEmitter.emitCustomBatchEvent(
          `meeting_note_${noteId}_created`,
          [
            {
              workspaceMemberId: null,
              meetingNoteId: noteId,
              firefliesId: meetingData.id,
            },
          ],
          workspaceId,
        );
      }
    }, authContext);

    return { noteIds, newContactIds };
  }

  private async findMeetingByFirefliesId(
    workspaceId: string,
    firefliesMeetingId: string,
  ): Promise<string | null> {
    try {
      const repository =
        await this.globalWorkspaceOrmManager.getRepository<MeetingNoteWorkspaceEntity>(
          workspaceId,
          'meetingNote',
          { shouldBypassPermissionChecks: true },
        );

      const meeting = await repository.findOne({
        where: {
          firefliesTranscriptId: firefliesMeetingId,
        },
      });

      return meeting?.id ?? null;
    } catch (error) {
      this.logger.error(`Error finding meeting by fireflies ID: ${error}`);
      return null;
    }
  }

  private async matchParticipantsToContacts(
    workspaceId: string,
    participants: FirefliesParticipant[],
  ): Promise<MatchResult> {
    const emptyResult = (
      people: PersonWorkspaceEntity[] = [],
    ): MatchResult => ({
      matched: participants.map((p) => ({
        personId: null,
        email: p.email,
        name: p.name,
      })),
      people,
    });

    if (participants.length === 0) {
      return { matched: [], people: [] };
    }

    const emails = participants.map((p) => p.email).filter(isDefined);

    if (emails.length === 0) {
      return emptyResult();
    }

    try {
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      // Search for people by primary email
      const people = await personRepository.find({
        where: emails.map((email) => ({
          emails: { primaryEmail: email.toLowerCase() },
        })),
      });

      // Create a lookup map by email
      const peopleByEmail = new Map<string, PersonWorkspaceEntity>();
      for (const person of people) {
        if (person.emails?.primaryEmail) {
          peopleByEmail.set(person.emails.primaryEmail.toLowerCase(), person);
        }
      }

      // Match each participant
      const matchedParticipants: MatchedParticipant[] = [];
      for (const participant of participants) {
        const email = participant.email?.toLowerCase();
        const person = email ? peopleByEmail.get(email) : undefined;

        matchedParticipants.push({
          personId: person?.id ?? null,
          email: participant.email,
          name: participant.name,
        });
      }

      return { matched: matchedParticipants, people };
    } catch (error) {
      this.logger.error(`Error matching participants: ${error}`);
      return emptyResult();
    }
  }

  /**
   * Exclusive attribution: given matched Person records from meeting attendees,
   * derive companyId and departmentId using sole-candidate checks.
   *
   * - External participants only (skip @popcre.com)
   * - Company: if all external attendees resolve to exactly one customer company → assign
   * - Department: if exactly one DEPARTMENT-scoped attendee exists among those → assign
   *   (central-office people with scope !== 'DEPARTMENT' are excluded)
   */
  private deriveAttribution(
    matchedPeople: PersonWorkspaceEntity[],
  ): AttributionResult {
    const externalPeople = matchedPeople.filter(
      (p) =>
        !p.emails?.primaryEmail?.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`),
    );

    // Sole-candidate check on company
    const companyIds = [
      ...new Set(
        externalPeople
          .map((p) => p.companyId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const companyId = companyIds.length === 1 ? companyIds[0] : null;

    // Sole-candidate check on department (DEPARTMENT-scoped people only)
    let departmentId: string | null = null;
    if (companyId) {
      const deptPeople = externalPeople.filter(
        (p) => p.scope === 'DEPARTMENT' && p.departmentId,
      );
      const deptIds = [
        ...new Set(deptPeople.map((p) => p.departmentId as string)),
      ];
      departmentId = deptIds.length === 1 ? deptIds[0] : null;
    }

    return { companyId, departmentId };
  }

  private async createMeetingNote(
    workspaceId: string,
    meetingData: FirefliesMeetingData,
    attribution: AttributionResult,
  ): Promise<string | null> {
    try {
      const repository =
        await this.globalWorkspaceOrmManager.getRepository<MeetingNoteWorkspaceEntity>(
          workspaceId,
          'meetingNote',
          { shouldBypassPermissionChecks: true },
        );

      const participantsList = meetingData.participants
        .map((p) => `${p.name} <${p.email}>`)
        .join(', ');

      // Pass plain object directly to save (no create method)
      const savedNote = await repository.save({
        name: meetingData.title,
        date: new Date(meetingData.date),
        participants: participantsList,
        summary: meetingData.summary?.overview ?? null,
        actionItems: meetingData.summary?.action_items?.join('\n') ?? null,
        source: 'fireflies',
        firefliesTranscriptId: meetingData.id,
        companyId: attribution.companyId ?? undefined,
        departmentId: attribution.departmentId ?? undefined,
      } as DeepPartial<MeetingNoteWorkspaceEntity>);

      this.logger.log(`Created meeting note: ${savedNote.id}`);
      return savedNote.id;
    } catch (error) {
      this.logger.error(`Error creating meeting note: ${error}`);
      return null;
    }
  }

  private async createAttendees(
    workspaceId: string,
    meetingNoteId: string,
    participants: MatchedParticipant[],
  ): Promise<void> {
    if (participants.length === 0) {
      return;
    }

    try {
      const repository =
        await this.globalWorkspaceOrmManager.getRepository<MeetingNoteAttendeeWorkspaceEntity>(
          workspaceId,
          'meetingNoteAttendee',
          { shouldBypassPermissionChecks: true },
        );

      // Batch create all attendees at once
      const attendeesToCreate = participants
        .filter((p) => p.personId !== null) // Only create attendees with linked persons
        .map(
          (participant) =>
            ({
              name: participant.name,
              meetingNoteId: meetingNoteId,
              personId: participant.personId,
            }) as DeepPartial<MeetingNoteAttendeeWorkspaceEntity>,
        );

      if (attendeesToCreate.length > 0) {
        await repository.save(attendeesToCreate);
        this.logger.log(
          `Created ${attendeesToCreate.length} attendees for meeting ${meetingNoteId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error creating attendees: ${error}`);
    }
  }
}
