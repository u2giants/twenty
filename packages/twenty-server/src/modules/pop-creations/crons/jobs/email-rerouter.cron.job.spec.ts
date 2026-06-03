import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { EmailRerouterCronJob } from 'src/modules/pop-creations/crons/jobs/email-rerouter.cron.job';
import {
  type RoutingResult,
  EmailRouterService,
} from 'src/modules/pop-creations/services/email-router.service';

describe('EmailRerouterCronJob', () => {
  let job: EmailRerouterCronJob;

  const query = jest.fn();
  const workspaceRepository = {
    find: jest.fn(),
  };
  const exceptionHandlerService = {
    captureExceptions: jest.fn(),
  };
  const emailRouterService = {
    routeEmail: jest.fn(),
    isImprovement: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest
      .fn()
      .mockImplementation(
        async (
          fn: () => Promise<unknown>,
          _authContext?: unknown,
          _options?: unknown,
        ) => await fn(),
      ),
    getGlobalWorkspaceDataSource: jest.fn().mockResolvedValue({ query }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailRerouterCronJob,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: workspaceRepository,
        },
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: globalWorkspaceOrmManager,
        },
        {
          provide: ExceptionHandlerService,
          useValue: exceptionHandlerService,
        },
        {
          provide: EmailRouterService,
          useValue: emailRouterService,
        },
      ],
    }).compile();

    job = module.get(EmailRerouterCronJob);
  });

  it('re-routes emails through the global workspace data source and persists improvements', async () => {
    const workspaceId = '99c80ca1-610f-48b5-bd1f-9178201bdcb7';
    const schemaName = getWorkspaceSchemaName(workspaceId);
    const routingResult: RoutingResult = {
      companyId: 'company-2',
      departmentId: 'dept-2',
      programId: 'program-2',
      routingStatus: 'COMPANY_ONLY',
      routingMethod: 'EMAIL_DOMAIN',
      confidence: 0.9,
    };

    workspaceRepository.find.mockResolvedValue([
      {
        id: workspaceId,
        activationStatus: 'ACTIVE',
      },
    ]);
    query
      .mockResolvedValueOnce([
        {
          id: 'email-1',
          createdAt: '2026-04-20T10:00:00.000Z',
          subject: 'Burlington order',
          bodyPreview: 'PO attached',
          sender: 'sender@example.com',
          recipients: 'buyer@example.com, merch@example.com ',
          routingStatus: 'UNROUTED',
          companyId: 'company-1',
        },
      ])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([]);
    emailRouterService.routeEmail.mockResolvedValue(routingResult);
    emailRouterService.isImprovement.mockReturnValue(true);

    await job.handle();

    expect(
      globalWorkspaceOrmManager.executeInWorkspaceContext,
    ).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        type: 'system',
        workspace: expect.objectContaining({ id: workspaceId }),
      }),
      { lite: true },
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`FROM "${schemaName}"."_emailMessage"`),
      [expect.any(String), null, null, 500],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    expect(emailRouterService.routeEmail).toHaveBeenCalledWith(workspaceId, {
      subject: 'Burlington order',
      bodyText: 'PO attached',
      emailAddresses: [
        'sender@example.com',
        'buyer@example.com',
        'merch@example.com',
      ],
    });
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`UPDATE "${schemaName}"."_emailMessage"`),
      [
        routingResult.routingStatus,
        routingResult.routingMethod,
        routingResult.companyId,
        routingResult.departmentId,
        routingResult.programId,
        'email-1',
      ],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining(`FROM "${schemaName}"."_emailMessage"`),
      [expect.any(String), '2026-04-20T10:00:00.000Z', 'email-1', 500],
      undefined,
      { shouldBypassPermissionChecks: true },
    );
    expect(exceptionHandlerService.captureExceptions).not.toHaveBeenCalled();
  });

  it('captures workspace failures without aborting the whole job', async () => {
    const firstWorkspace = 'workspace-1';
    const secondWorkspace = 'workspace-2';

    workspaceRepository.find.mockResolvedValue([
      {
        id: firstWorkspace,
        activationStatus: 'ACTIVE',
      },
      {
        id: secondWorkspace,
        activationStatus: 'ACTIVE',
      },
    ]);
    globalWorkspaceOrmManager.executeInWorkspaceContext
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockImplementationOnce(async (fn: () => Promise<unknown>) => await fn());
    query.mockResolvedValueOnce([]);

    await job.handle();

    expect(exceptionHandlerService.captureExceptions).toHaveBeenCalledWith(
      [expect.any(Error)],
      {
        workspace: { id: firstWorkspace },
      },
    );
    expect(
      globalWorkspaceOrmManager.executeInWorkspaceContext,
    ).toHaveBeenCalledTimes(2);
  });
});
