// Fireflies Webhook Types

export type FirefliesWebhookPayload = {
  meetingId: string;
  eventType: string;
  clientReferenceId?: string;
};

export type FirefliesParticipant = {
  email: string;
  name: string;
};

export type FirefliesMeetingData = {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: FirefliesParticipant[];
  organizer_email?: string;
  summary: {
    action_items: string[];
    overview: string;
    keywords?: string[];
    topics_discussed?: string[];
    meeting_type?: string;
  };
  transcript_url: string;
  audio_url?: string;
  video_url?: string;
  meeting_link?: string;
  summary_status?: string;
};

export type FirefliesProcessResult = {
  success: boolean;
  meetingId?: string;
  noteIds?: string[];
  newContacts?: string[];
  errors?: string[];
  summaryReady?: boolean;
  summaryPending?: boolean;
  actionItemsCount?: number;
};
