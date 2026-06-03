import { type ActorMetadata, FieldMetadataType } from 'twenty-shared/types';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type TaskTargetWorkspaceEntity } from 'src/modules/task/standard-objects/task-target.workspace-entity';
import { type TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';
import { type DepartmentWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/department.workspace-entity';
import { type MeetingNoteAttendeeWorkspaceEntity } from 'src/modules/pop-creations/standard-objects/meeting-note-attendee.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_MEETING_NOTE: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export class MeetingNoteWorkspaceEntity extends BaseWorkspaceEntity {
  name: string | null;
  date: Date | null;
  participants: string | null;
  summary: string | null;
  actionItems: string | null;
  source: string | null;
  firefliesTranscriptId: string | null;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  // Relations
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;
  department: EntityRelation<DepartmentWorkspaceEntity> | null;
  departmentId: string | null;
  program: EntityRelation<OpportunityWorkspaceEntity> | null;
  programId: string | null;
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;
  attendees: EntityRelation<MeetingNoteAttendeeWorkspaceEntity[]>;
  attachments: EntityRelation<AttachmentWorkspaceEntity[]>;
  noteTargets: EntityRelation<NoteTargetWorkspaceEntity[]>;
  taskTargets: EntityRelation<TaskTargetWorkspaceEntity[]>;
  timelineActivities: EntityRelation<TimelineActivityWorkspaceEntity[]>;
}
