import { type ActorMetadata, FieldMetadataType } from 'twenty-shared/types';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type FavoriteWorkspaceEntity } from 'src/modules/favorite/standard-objects/favorite.workspace-entity';
import { type NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type TaskTargetWorkspaceEntity } from 'src/modules/task/standard-objects/task-target.workspace-entity';
import { type TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';
import { type DepartmentWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/department.workspace-entity';

const SUBJECT_FIELD_NAME = 'subject';
const SENDER_FIELD_NAME = 'sender';

export const SEARCH_FIELDS_FOR_EMAIL_MESSAGE: FieldTypeAndNameMetadata[] = [
  { name: SUBJECT_FIELD_NAME, type: FieldMetadataType.TEXT },
  { name: SENDER_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export class EmailMessageWorkspaceEntity extends BaseWorkspaceEntity {
  name: string | null;
  subject: string | null;
  sender: string | null;
  recipients: string | null;
  receivedAt: Date | null;
  bodyPreview: string | null;
  outlookMessageId: string | null;
  routingStatus: string | null;
  routingMethod: string | null;
  detectedSoNumbers: string | null;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  // Relations
  program: EntityRelation<OpportunityWorkspaceEntity> | null;
  programId: string | null;
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;
  department: EntityRelation<DepartmentWorkspaceEntity> | null;
  departmentId: string | null;
  favorites: EntityRelation<FavoriteWorkspaceEntity[]>;
  attachments: EntityRelation<AttachmentWorkspaceEntity[]>;
  noteTargets: EntityRelation<NoteTargetWorkspaceEntity[]>;
  taskTargets: EntityRelation<TaskTargetWorkspaceEntity[]>;
  timelineActivities: EntityRelation<TimelineActivityWorkspaceEntity[]>;
}
