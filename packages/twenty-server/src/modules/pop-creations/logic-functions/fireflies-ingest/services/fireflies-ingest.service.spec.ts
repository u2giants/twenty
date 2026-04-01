import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';
import { FirefliesApiClient } from './fireflies-api.client';
import { FirefliesIngestService } from './fireflies-ingest.service';

describe('FirefliesIngestService', () => {
  let service: FirefliesIngestService;
  let firefliesApiClient: jest.Mocked<FirefliesApiClient>;
  let globalWorkspaceOrmManager: jest.Mocked<GlobalWorkspaceOrmManager>;
  let workspaceEventEmitter: jest.Mocked<WorkspaceEventEmitter>;

  const mockWorkspaceId = '20202020-0000-0000-0000-000000000000';
  const mockFirefliesMeetingId = 'fireflies-meeting-123';

  const mockMeetingData = {
    id: mockFirefliesMeetingId,
    title: 'Test Meeting',
    date: '2024-01-15T10:00:00Z',
    transcript_url: 'https://fireflies.ai/transcript/123',
    summary_status: 'completed',
    summary: {
      overview: 'This is a test meeting summary',
      action_items: ['Action item 1', 'Action item 2'],
      keywords: ['keyword1', 'keyword2'],
    },
    participants: [
      { name: 'John Doe', email: 'john@example.com' },
      { name: 'Jane Smith', email: 'jane@example.com' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirefliesIngestService,
        {
          provide: FirefliesApiClient,
          useValue: {
            fetchMeetingData: jest.fn(),
          },
        },
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest.fn(),
            getRepository: jest.fn(),
          },
        },
        {
          provide: WorkspaceEventEmitter,
          useValue: {
            emitCustomBatchEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-webhook-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<FirefliesIngestService>(FirefliesIngestService);
    firefliesApiClient = module.get(FirefliesApiClient);
    globalWorkspaceOrmManager = module.get(GlobalWorkspaceOrmManager);
    workspaceEventEmitter = module.get(WorkspaceEventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    describe('successful cases', () => {
      it('should successfully process a webhook with CRM integration', async () => {
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          mockMeetingData as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue(null),
          find: jest.fn().mockResolvedValue([]),
          save: jest
            .fn()
            .mockImplementation((entity) =>
              Promise.resolve({
                id: 'generated-uuid-123',
                ...(entity as object),
              }),
            ),
        };

        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
        expect(result.meetingId).toBe(mockFirefliesMeetingId);
        expect(result.summaryReady).toBe(true);
        expect(result.actionItemsCount).toBe(2);
        expect(result.noteIds).toHaveLength(1);
        expect(firefliesApiClient.fetchMeetingData).toHaveBeenCalledWith(
          mockFirefliesMeetingId,
        );
      });

      it('should skip CRM integration when workspaceId is not provided', async () => {
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          mockMeetingData as any,
        );

        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: undefined,
          headers: {},
          workspaceId: undefined,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
        expect(result.noteIds).toBeUndefined();
        expect(result.newContacts).toBeUndefined();
        expect(
          globalWorkspaceOrmManager.executeInWorkspaceContext,
        ).not.toHaveBeenCalled();
      });

      it('should handle summary not ready status', async () => {
        const meetingWithoutSummary = {
          ...mockMeetingData,
          summary_status: 'processing',
          summary: undefined,
        };
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          meetingWithoutSummary as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest
            .fn()
            .mockImplementation((entity) =>
              Promise.resolve({
                id: 'generated-uuid-123',
                ...(entity as object),
              }),
            ),
        };
        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
        expect(result.summaryReady).toBe(false);
        expect(result.summaryPending).toBe(true);
        expect(result.actionItemsCount).toBe(0);
      });

      it('should handle string payload input', async () => {
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          mockMeetingData as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest
            .fn()
            .mockImplementation((entity) =>
              Promise.resolve({
                id: 'generated-uuid-123',
                ...(entity as object),
              }),
            ),
        };
        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const input = {
          payload: JSON.stringify({ meetingId: mockFirefliesMeetingId }),
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
      });

      it('should skip creation for duplicate meetings', async () => {
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          mockMeetingData as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue({ id: 'existing-note-id' }),
          save: jest.fn(),
        };
        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
        expect(result.noteIds).toEqual(['existing-note-id']);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should return error for missing meetingId', async () => {
        const input = {
          payload: { someOtherField: 'value' },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Missing meetingId in payload');
      });

      it('should handle API errors gracefully', async () => {
        firefliesApiClient.fetchMeetingData.mockRejectedValue(
          new Error('API connection failed'),
        );

        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('API connection failed');
      });

      it('should validate wrapped payload objects', async () => {
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          mockMeetingData as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest
            .fn()
            .mockImplementation((entity) =>
              Promise.resolve({
                id: 'generated-uuid-123',
                ...(entity as object),
              }),
            ),
        };
        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const input = {
          payload: { params: { meetingId: mockFirefliesMeetingId } },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
      });

      it('should handle empty participants list', async () => {
        const meetingWithoutParticipants = {
          ...mockMeetingData,
          participants: [],
        };
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          meetingWithoutParticipants as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest
            .fn()
            .mockImplementation((entity) =>
              Promise.resolve({
                id: 'generated-uuid-123',
                ...(entity as object),
              }),
            ),
        };
        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: undefined,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
        expect(result.noteIds).toHaveLength(1);
      });
    });

    describe('signature verification', () => {
      it('should validate correct signature', async () => {
        firefliesApiClient.fetchMeetingData.mockResolvedValue(
          mockMeetingData as any,
        );

        globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
          async (callback: () => Promise<void>) => {
            await callback();
          },
        );

        const mockRepository = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest
            .fn()
            .mockImplementation((entity) =>
              Promise.resolve({
                id: 'generated-uuid-123',
                ...(entity as object),
              }),
            ),
        };
        globalWorkspaceOrmManager.getRepository = jest
          .fn()
          .mockResolvedValue(mockRepository);

        const payload = JSON.stringify({ meetingId: mockFirefliesMeetingId });
        const signature =
          'sha256=' +
          crypto
            .createHmac('sha256', 'test-webhook-secret')
            .update(payload)
            .digest('hex');

        const input = {
          payload,
          signature,
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(true);
      });

      it('should reject invalid signature', async () => {
        const input = {
          payload: { meetingId: mockFirefliesMeetingId },
          signature: 'sha256=invalid-signature-here',
          headers: {},
          workspaceId: mockWorkspaceId,
        };

        const result = await service.processWebhook(input);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid webhook signature');
      });
    });
  });
});
