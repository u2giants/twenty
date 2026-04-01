import {
  type ActorMetadata,
  type CurrencyMetadata,
  FieldMetadataType,
} from 'twenty-shared/types';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type FavoriteWorkspaceEntity } from 'src/modules/favorite/standard-objects/favorite.workspace-entity';
import { type NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type TaskTargetWorkspaceEntity } from 'src/modules/task/standard-objects/task-target.workspace-entity';
import { type TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { type DepartmentWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/department.workspace-entity';
import { type EmailMessageWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/email-message.workspace-entity';
import { type FactoryWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/factory.workspace-entity';
import { type LicensorApprovalThreadWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/licensor-approval-thread.workspace-entity';
import { type MeetingNoteWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/meeting-note.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_OPPORTUNITY: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export class OpportunityWorkspaceEntity extends BaseWorkspaceEntity {
  name: string;
  amount: CurrencyMetadata | null;
  closeDate: Date | null;
  stage: string;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  pointOfContact: EntityRelation<PersonWorkspaceEntity> | null;
  pointOfContactId: string | null;
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;
  favorites: EntityRelation<FavoriteWorkspaceEntity[]>;
  taskTargets: EntityRelation<TaskTargetWorkspaceEntity[]>;
  noteTargets: EntityRelation<NoteTargetWorkspaceEntity[]>;
  attachments: EntityRelation<AttachmentWorkspaceEntity[]>;
  timelineActivities: EntityRelation<TimelineActivityWorkspaceEntity[]>;
  owner: EntityRelation<WorkspaceMemberWorkspaceEntity> | null;
  ownerId: string | null;
  /** @deprecated */
  probability: string;
  searchVector: string;

  // --- POP Creations custom fields ---
  programType: string | null;
  seasonYear: string | null;
  directiveSource: string | null;
  division: string | null;
  originCountry: string | null;
  licensed: boolean | null;
  productionPoNumber: string | null;
  salesOrderNumber: string | null;
  importPoNumber: string | null;
  customerIncoterms: string | null;
  factoryIncoterms: string | null;
  hardDeliveryDate: Date | null;
  sampleRequired: boolean | null;
  sampleApprovalMethod: string | null;
  requiresNewPricing: boolean | null;
  clickupTaskId: string | null;
  clickupStatus: string | null;
  plmProjectId: string | null;
  department: EntityRelation<DepartmentWorkspaceEntity> | null;
  departmentId: string | null;
  factory: EntityRelation<FactoryWorkspaceEntity> | null;
  factoryId: string | null;
  licensorApprovalThreads: EntityRelation<LicensorApprovalThreadWorkspaceEntity[]>;
  emailMessages: EntityRelation<EmailMessageWorkspaceEntity[]>;
  meetingNotes: EntityRelation<MeetingNoteWorkspaceEntity[]>;
}
