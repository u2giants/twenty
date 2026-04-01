import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/common';
import { type DeepPartial } from 'typeorm';

import { ObjectRecordCreateEvent } from 'src/engine/integrations/event-emitter/interfaces/object-record-create.event.interface';
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

      this.logger.log(
        `Auto-setting scope for person ${recordId} in workspace ${workspaceId}`,
      );

      // Determine scope based on company/department relationships
      const scope = this.determineScope(properties);

      if (!scope) {
        this.logger.log(
          `Person ${recordId} has no company/department, setting to IGNORED`,
        );
      }

      // Update the person's scope field using workspace context
      await this.updatePersonScope(workspaceId, recordId, scope);
    } catch (error) {
      this.logger.error(
        `Error in contact-auto-scope: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        companyCustomerStatus: scope ?? 'OTHER',
      };

      await repository.update({ id: personId }, updateData);

      this.logger.log(
        `Updated person ${personId} scope to ${scope ?? 'OTHER'}`,
      );
    }, authContext);
  }
}
