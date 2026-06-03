/**
 * CompanyEnrichCountsPostQueryHook
 *
 * After Company records are fetched, enriches each with:
 * - contactCount: number of Person records linked to the company
 * - departmentCount: number of Department records linked to the company
 *
 * These are virtual/computed fields — they don't exist in the database schema
 * but are injected into the response at query time.
 */

import { type WorkspacePostQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { WorkspaceQueryHookType } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type DepartmentWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/department.workspace-entity';

@WorkspaceQueryHook({
  key: `company.findMany`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class CompanyFindManyEnrichCountsPostQueryHook implements WorkspacePostQueryHookInstance {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CompanyWorkspaceEntity[],
  ): Promise<void> {
    if (!payload || payload.length === 0) return;

    const workspaceId = authContext.workspace.id;
    const companyIds = payload.map((c) => c.id);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const personRepo =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const departmentRepo =
        await this.globalWorkspaceOrmManager.getRepository<DepartmentWorkspaceEntity>(
          workspaceId,
          'department',
          { shouldBypassPermissionChecks: true },
        );

      // Batch count contacts per company
      const contactCounts = await personRepo
        .createQueryBuilder('person')
        .select('person."companyId"', 'companyId')
        .addSelect('COUNT(*)', 'count')
        .where('person."companyId" IN (:...ids)', { ids: companyIds })
        .andWhere('person."deletedAt" IS NULL')
        .groupBy('person."companyId"')
        .getRawMany<{ companyId: string; count: string }>();

      const contactCountMap = new Map(
        contactCounts.map((r) => [r.companyId, parseInt(r.count, 10)]),
      );

      // Batch count departments per company
      const deptCounts = await departmentRepo
        .createQueryBuilder('dept')
        .select('dept."companyId"', 'companyId')
        .addSelect('COUNT(*)', 'count')
        .where('dept."companyId" IN (:...ids)', { ids: companyIds })
        .andWhere('dept."deletedAt" IS NULL')
        .groupBy('dept."companyId"')
        .getRawMany<{ companyId: string; count: string }>();

      const deptCountMap = new Map(
        deptCounts.map((r) => [r.companyId, parseInt(r.count, 10)]),
      );

      // Inject computed values into each company record
      for (const company of payload) {
        (company as any).contactCount = contactCountMap.get(company.id) ?? 0;
        (company as any).departmentCount = deptCountMap.get(company.id) ?? 0;
      }
    }, authContext);
  }
}

@WorkspaceQueryHook({
  key: `company.findOne`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class CompanyFindOneEnrichCountsPostQueryHook implements WorkspacePostQueryHookInstance {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CompanyWorkspaceEntity[],
  ): Promise<void> {
    if (!payload || payload.length === 0) return;

    const workspaceId = authContext.workspace.id;
    const company = payload[0];

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const personRepo =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const departmentRepo =
        await this.globalWorkspaceOrmManager.getRepository<DepartmentWorkspaceEntity>(
          workspaceId,
          'department',
          { shouldBypassPermissionChecks: true },
        );

      const contactCount = await personRepo.count({
        where: { companyId: company.id } as any,
      });

      const departmentCount = await departmentRepo.count({
        where: { companyId: company.id } as any,
      });

      (company as any).contactCount = contactCount;
      (company as any).departmentCount = departmentCount;
    }, authContext);
  }
}
