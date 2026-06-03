import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type {
  FirefliesMeetingData,
  FirefliesParticipant,
} from '../types/fireflies-ingest.types';

@Injectable()
export class FirefliesApiClient {
  private readonly logger = new Logger(FirefliesApiClient.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.fireflies.ai/graphql';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FIREFLIES_API_KEY', '');

    if (!this.apiKey) {
      this.logger.warn('FIREFLIES_API_KEY not configured');
    }
  }

  async fetchMeetingData(meetingId: string): Promise<FirefliesMeetingData> {
    const query = `
      query GetTranscript($transcriptId: String!) {
        transcript(id: $transcriptId) {
          id
          title
          date
          duration
          participants
          organizer_email
          summary {
            action_items
            overview
            keywords
            topics_discussed
            meeting_type
          }
          transcript_url
          audio_url
          video_url
          meeting_link
        }
      }
    `;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables: { transcriptId: meetingId },
      }),
    });

    if (!response.ok) {
      throw new Error(`Fireflies API error: ${response.status}`);
    }

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(`Fireflies GraphQL error: ${json.errors[0].message}`);
    }

    return this.transformTranscript(json.data.transcript, meetingId);
  }

  private transformTranscript(
    transcript: Record<string, unknown>,
    meetingId: string,
  ): FirefliesMeetingData {
    const participants = this.extractParticipants(transcript);
    const summary = transcript.summary as Record<string, unknown> | undefined;
    const meetingInfo = transcript.meeting_info as
      | Record<string, unknown>
      | undefined;

    return {
      id: (transcript.id as string) || meetingId,
      title: (transcript.title as string) || 'Untitled Meeting',
      date: this.normalizeDate(transcript.date),
      duration: (transcript.duration as number) || 0,
      participants,
      organizer_email: transcript.organizer_email as string | undefined,
      summary: {
        action_items: Array.isArray(summary?.action_items)
          ? (summary.action_items as string[])
          : [],
        overview: (summary?.overview as string) || '',
        keywords: summary?.keywords as string[] | undefined,
        topics_discussed: summary?.topics_discussed as string[] | undefined,
        meeting_type: summary?.meeting_type as string | undefined,
      },
      transcript_url:
        (transcript.transcript_url as string) ||
        `https://app.fireflies.ai/view/${meetingId}`,
      audio_url: transcript.audio_url as string | undefined,
      video_url: transcript.video_url as string | undefined,
      meeting_link: transcript.meeting_link as string | undefined,
      summary_status: (meetingInfo?.summary_status as string) || undefined,
    };
  }

  private extractParticipants(
    transcript: Record<string, unknown>,
  ): FirefliesParticipant[] {
    const participants: FirefliesParticipant[] = [];

    // Handle legacy participants format: "Name <email@domain.com>"
    if (transcript.participants && Array.isArray(transcript.participants)) {
      for (const participant of transcript.participants as string[]) {
        const emailMatch = participant.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : '';
        const name = emailMatch
          ? participant.substring(0, participant.indexOf('<')).trim()
          : participant.trim();

        if (name && !participants.some((p) => p.email === email)) {
          participants.push({ name, email });
        }
      }
    }

    // Add organizer if not already in list
    const organizerEmail = transcript.organizer_email as string | undefined;
    if (
      organizerEmail &&
      !participants.some((p) => p.email === organizerEmail)
    ) {
      participants.push({
        name: 'Meeting Organizer',
        email: organizerEmail,
      });
    }

    return participants;
  }

  private normalizeDate(dateValue: unknown): string {
    if (!dateValue) {
      return new Date().toISOString();
    }

    if (typeof dateValue === 'number') {
      return new Date(dateValue).toISOString();
    }

    if (typeof dateValue === 'string') {
      const parsed = Number(dateValue);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
      return dateValue;
    }

    return new Date().toISOString();
  }
}
