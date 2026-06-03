import { type ActorMetadata, FieldMetadataType } from 'twenty-shared/types';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type TaskTargetWorkspaceEntity } from 'src/modules/task/standard-objects/task-target.workspace-entity';
import { type TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_LICENSOR_APPROVAL_THREAD: FieldTypeAndNameMetadata[] =
  [{ name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT }];

export class LicensorApprovalThreadWorkspaceEntity extends BaseWorkspaceEntity {
  name: string | null;
  propertyName: string | null;
  stage: string | null;
  submittedDate: Date | null;
  responseDate: Date | null;
  dueDate: Date | null;
  licensorComments: string | null;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  // Relations
  program: EntityRelation<OpportunityWorkspaceEntity> | null;
  programId: string | null;
  attachments: EntityRelation<AttachmentWorkspaceEntity[]>;
  noteTargets: EntityRelation<NoteTargetWorkspaceEntity[]>;
  taskTargets: EntityRelation<TaskTargetWorkspaceEntity[]>;
  timelineActivities: EntityRelation<TimelineActivityWorkspaceEntity[]>;
}
