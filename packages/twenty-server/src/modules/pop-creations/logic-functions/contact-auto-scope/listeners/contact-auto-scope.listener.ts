import { Injectable, Logger, OnEvent } from '@nestjs/common';
import { type DeepPartial } from 'typeorm';

import {
  type ObjectRecordCreateEvent,
  type ObjectRecordUpdateEvent,
} from 'twenty-shared/database-events';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

type PersonScope = 'DEPARTMENT' | 'COMPANY_WIDE' | 'IGNORED';

@Injectable()
export class ContactAutoScopeListener {
  private readonly logger = new Logger(ContactAutoScopeListener.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @OnEvent('person.created', { async: true })
  async handlePersonCreated(
    payload: ObjectRecordCreateEvent<PersonWorkspaceEntity>,
  ): Promise<void> {
    try {
      const { workspaceId, recordId, properties } = payload;
      const entity = properties.after as Partial<PersonWorkspaceEntity>;

      this.logger.log(
        `Auto-setting scope for person ${recordId} in workspace ${workspaceId}`,
      );

      const scope = this.determineScope(entity);

      if (!scope) {
        this.logger.log(
          `Person ${recordId} has no company/department, setting to IGNORED`,
        );
      }

      await this.updatePersonScope(workspaceId, recordId, scope);
    } catch (error) {
      this.logger.error(
        `Error in contact-auto-scope: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent('person.updated', { async: true })
  async handlePersonUpdated(
    payload: ObjectRecordUpdateEvent<PersonWorkspaceEntity>,
  ): Promise<void> {
    const { workspaceId, recordId, properties } = payload;
    const before = properties.before as
      | Partial<PersonWorkspaceEntity>
      | undefined;
    const after = properties.after as Partial<PersonWorkspaceEntity>;

    // Only re-scope if company or department actually changed
    if (
      before &&
      before.departmentId === after.departmentId &&
      before.companyId === after.companyId
    ) {
      return;
    }

    try {
      const scope = this.determineScope(after);
      await this.updatePersonScope(workspaceId, recordId, scope);
    } catch (error) {
      this.logger.error(
        `Error in contact-auto-scope (update): ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private determineScope(
    properties: Partial<PersonWorkspaceEntity>,
  ): PersonScope | null {
    // If person has a department, set to DEPARTMENT
    if (properties.departmentId) {
      return 'DEPARTMENT';
    }

    // If person has a company but no department, set to COMPANY_WIDE
    if (properties.companyId) {
      return 'COMPANY_WIDE';
    }

    // No company - return null (caller will set IGNORED)
    return null;
  }

  private async updatePersonScope(
    workspaceId: string,
    personId: string,
    scope: PersonScope | null,
  ): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const updateData: DeepPartial<PersonWorkspaceEntity> = {
        scope: scope ?? 'IGNORED',
      };

      await repository.update({ id: personId }, updateData);

      this.logger.log(
        `Updated person ${personId} scope to ${scope ?? 'IGNORED'}`,
      );
    }, authContext);
  }
}
