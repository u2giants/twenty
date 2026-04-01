import { msg } from '@lingui/core/macro';
import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type AllStandardObjectFieldName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-object-field-name.type';
import {
  type CreateStandardFieldArgs,
  createStandardFieldFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-field-flat-metadata.util';
import { createStandardRelationFieldFlatMetadata } from 'src/engine/workspace-manager/twenty-standard-application/utils/field-metadata/create-standard-relation-field-flat-metadata.util';
import { getTsVectorColumnExpressionFromFields } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { i18nLabel } from 'src/engine/workspace-manager/twenty-standard-application/utils/i18n-label.util';
import { SEARCH_FIELDS_FOR_AI_MODEL_CONFIG } from 'src/modules/pop-creations/standard-objects/ai-model-config.workspace-entity';

export const buildAiModelConfigStandardFlatFieldMetadatas = ({
  now,
  objectName,
  workspaceId,
  standardObjectMetadataRelatedEntityIds,
  dependencyFlatEntityMaps,
  twentyStandardApplicationId,
}: Omit<
  CreateStandardFieldArgs<'aiModelConfig', FieldMetadataType>,
  'context'
>): Record<
  AllStandardObjectFieldName<'aiModelConfig'>,
  FlatFieldMetadata
> => ({
  id: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'id', type: FieldMetadataType.UUID, label: i18nLabel(msg`Id`), description: i18nLabel(msg`Id`), icon: 'Icon123', isSystem: true, isNullable: false, isUIReadOnly: true, defaultValue: 'uuid' }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  createdAt: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'createdAt', type: FieldMetadataType.DATE_TIME, label: i18nLabel(msg`Creation date`), description: i18nLabel(msg`Creation date`), icon: 'IconCalendar', isSystem: true, isNullable: false, isUIReadOnly: true, defaultValue: 'now' }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  updatedAt: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'updatedAt', type: FieldMetadataType.DATE_TIME, label: i18nLabel(msg`Last update`), description: i18nLabel(msg`Last time the record was changed`), icon: 'IconCalendarClock', isSystem: true, isNullable: false, isUIReadOnly: true, defaultValue: 'now' }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  deletedAt: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'deletedAt', type: FieldMetadataType.DATE_TIME, label: i18nLabel(msg`Deleted at`), description: i18nLabel(msg`Date when the record was deleted`), icon: 'IconCalendarMinus', isSystem: true, isNullable: true }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  position: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'position', type: FieldMetadataType.POSITION, label: i18nLabel(msg`Position`), description: i18nLabel(msg`Record position`), icon: 'IconHierarchy2', isSystem: true, isNullable: false, defaultValue: 0 }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  createdBy: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'createdBy', type: FieldMetadataType.ACTOR, label: i18nLabel(msg`Created by`), description: i18nLabel(msg`The creator of the record`), icon: 'IconCreativeCommonsSa', isSystem: true, isUIReadOnly: true, isNullable: false, defaultValue: { source: "'MANUAL'", name: "'System'", workspaceMemberId: null } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  updatedBy: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'updatedBy', type: FieldMetadataType.ACTOR, label: i18nLabel(msg`Updated by`), description: i18nLabel(msg`The workspace member who last updated the record`), icon: 'IconUserCircle', isSystem: true, isUIReadOnly: true, isNullable: false, defaultValue: { source: "'MANUAL'", name: "'System'", workspaceMemberId: null } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  searchVector: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'searchVector', type: FieldMetadataType.TS_VECTOR, label: i18nLabel(msg`Search vector`), description: i18nLabel(msg`Field used for full-text search`), icon: 'IconUser', isSystem: true, isNullable: true, settings: { generatedType: 'STORED', asExpression: getTsVectorColumnExpressionFromFields(SEARCH_FIELDS_FOR_AI_MODEL_CONFIG) } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),

  // Custom fields
  name: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'name', type: FieldMetadataType.TEXT, label: i18nLabel(msg`Name`), description: i18nLabel(msg`Configuration name`), icon: 'IconRobot', isNullable: true }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  emailRoutingModel: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'emailRoutingModel', type: FieldMetadataType.TEXT, label: i18nLabel(msg`Email Routing Model`), description: i18nLabel(msg`AI model used for email routing`), icon: 'IconMail', isNullable: true }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  firefliesRoutingModel: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'firefliesRoutingModel', type: FieldMetadataType.TEXT, label: i18nLabel(msg`Fireflies Routing Model`), description: i18nLabel(msg`AI model used for meeting note routing`), icon: 'IconNotes', isNullable: true }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  transcriptSplitModel: createStandardFieldFlatMetadata({ objectName, workspaceId, context: { fieldName: 'transcriptSplitModel', type: FieldMetadataType.TEXT, label: i18nLabel(msg`Transcript Split Model`), description: i18nLabel(msg`AI model used for splitting transcripts`), icon: 'IconCut', isNullable: true }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),

  // System relations
  favorites: createStandardRelationFieldFlatMetadata({ objectName, workspaceId, context: { type: FieldMetadataType.RELATION, morphId: null, fieldName: 'favorites', label: i18nLabel(msg`Favorites`), description: i18nLabel(msg`Favorites linked to the record`), icon: 'IconHeart', isSystem: true, isNullable: true, targetObjectName: 'favorite', targetFieldName: 'targetAiModelConfig', settings: { relationType: RelationType.ONE_TO_MANY } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  attachments: createStandardRelationFieldFlatMetadata({ objectName, workspaceId, context: { type: FieldMetadataType.MORPH_RELATION, morphId: null, fieldName: 'attachments', label: i18nLabel(msg`Attachments`), description: i18nLabel(msg`Attachments linked to the record`), icon: 'IconFileImport', isSystem: true, isNullable: true, targetObjectName: 'attachment', targetFieldName: 'targetAiModelConfig', settings: { relationType: RelationType.ONE_TO_MANY } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  noteTargets: createStandardRelationFieldFlatMetadata({ objectName, workspaceId, context: { type: FieldMetadataType.MORPH_RELATION, morphId: null, fieldName: 'noteTargets', label: i18nLabel(msg`Note Targets`), description: i18nLabel(msg`Note targets linked to the record`), icon: 'IconNotes', isSystem: true, isNullable: true, targetObjectName: 'noteTarget', targetFieldName: 'targetAiModelConfig', settings: { relationType: RelationType.ONE_TO_MANY } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  taskTargets: createStandardRelationFieldFlatMetadata({ objectName, workspaceId, context: { type: FieldMetadataType.MORPH_RELATION, morphId: null, fieldName: 'taskTargets', label: i18nLabel(msg`Task Targets`), description: i18nLabel(msg`Task targets linked to the record`), icon: 'IconCheckbox', isSystem: true, isNullable: true, targetObjectName: 'taskTarget', targetFieldName: 'targetAiModelConfig', settings: { relationType: RelationType.ONE_TO_MANY } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
  timelineActivities: createStandardRelationFieldFlatMetadata({ objectName, workspaceId, context: { type: FieldMetadataType.MORPH_RELATION, morphId: null, fieldName: 'timelineActivities', label: i18nLabel(msg`Timeline Activities`), description: i18nLabel(msg`Timeline activities linked to the record`), icon: 'IconTimelineEvent', isSystem: true, isNullable: true, targetObjectName: 'timelineActivity', targetFieldName: 'targetAiModelConfig', settings: { relationType: RelationType.ONE_TO_MANY } }, standardObjectMetadataRelatedEntityIds, dependencyFlatEntityMaps, twentyStandardApplicationId, now }),
});
