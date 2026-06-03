import { useLabelIdentifierFieldMetadataItem } from '@/object-metadata/hooks/useLabelIdentifierFieldMetadataItem';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { categorizeRelationFields } from '@/object-record/record-field-list/utils/categorizeRelationFields';
import { isFieldCellSupported } from '@/object-record/utils/isFieldCellSupported';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import groupBy from 'lodash.groupby';
import { CoreObjectNameSingular, FieldMetadataType } from 'twenty-shared/types';
import { FeatureFlagKey, RelationType } from '~/generated-metadata/graphql';

/**
 * Priority field ordering for the emailMessage record panel.
 * Fields listed here appear first (in this order); remaining fields sort
 * alphabetically after them.
 */
const EMAIL_MESSAGE_FIELD_ORDER: string[] = [
  'program', // Opportunity
  'department', // Department
  'company', // Company
  'detectedPoNumbers', // Detected Prod PO
  'detectedSoNumbers', // Detected SO
  'routingStatus', // Routing Status
];

const sortEmailMessageFields = <T extends { name: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const ai = EMAIL_MESSAGE_FIELD_ORDER.indexOf(a.name);
    const bi = EMAIL_MESSAGE_FIELD_ORDER.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

/**
 * Priority field ordering for the department record panel.
 * company and primaryBuyer are pulled inline (not boxed) so they appear
 * prominently when creating or editing a department.
 */
const DEPARTMENT_FIELD_ORDER: string[] = [
  'name', // Department name (shown inline, not just as title)
  'company', // Retailer this department belongs to
  'category', // Department category
  'division', // Business division
  'primaryBuyer', // Primary buyer contact
  'active', // Active status
];

const sortDepartmentFields = <T extends { name: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const ai = DEPARTMENT_FIELD_ORDER.indexOf(a.name);
    const bi = DEPARTMENT_FIELD_ORDER.indexOf(b.name);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

type UseFieldListFieldMetadataItemsProps = {
  objectNameSingular: string;
  excludeFieldMetadataIds?: string[];
  excludeCreatedAtAndUpdatedAt?: boolean;
  showRelationSections?: boolean;
};

export const useFieldListFieldMetadataItems = ({
  objectNameSingular,
  excludeFieldMetadataIds = [],
  showRelationSections = true,
  excludeCreatedAtAndUpdatedAt = true,
}: UseFieldListFieldMetadataItemsProps) => {
  const { labelIdentifierFieldMetadataItem } =
    useLabelIdentifierFieldMetadataItem({
      objectNameSingular,
    });

  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { objectMetadataItems } = useObjectMetadataItems();

  const isJunctionRelationsEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_JUNCTION_RELATIONS_ENABLED,
  );

  const availableFieldMetadataItems = objectMetadataItem.readableFields
    .filter(
      (fieldMetadataItem) =>
        isFieldCellSupported(fieldMetadataItem, objectMetadataItems) &&
        // For department, show the name field inline so it's visible as a labeled input.
        // For all other objects, exclude the label identifier (it's shown as the record title).
        (objectNameSingular === 'department' ||
          fieldMetadataItem.id !== labelIdentifierFieldMetadataItem?.id) &&
        !excludeFieldMetadataIds.includes(fieldMetadataItem.id) &&
        (!excludeCreatedAtAndUpdatedAt ||
          (fieldMetadataItem.name !== 'createdAt' &&
            fieldMetadataItem.name !== 'deletedAt')) &&
        (showRelationSections ||
          (fieldMetadataItem.type !== FieldMetadataType.RELATION &&
            fieldMetadataItem.type !== FieldMetadataType.MORPH_RELATION)),
    )
    .sort((fieldMetadataItemA, fieldMetadataItemB) =>
      fieldMetadataItemA.name.localeCompare(fieldMetadataItemB.name),
    );

  const { inlineFieldMetadataItems, relationFieldMetadataItems } = groupBy(
    availableFieldMetadataItems
      .filter(
        (fieldMetadataItem) =>
          fieldMetadataItem.name !== 'createdAt' &&
          fieldMetadataItem.name !== 'deletedAt',
      )
      .filter(
        (fieldMetadataItem) =>
          !(
            fieldMetadataItem.type === FieldMetadataType.RICH_TEXT &&
            fieldMetadataItem.name === 'bodyV2' &&
            (objectNameSingular === CoreObjectNameSingular.Note ||
              objectNameSingular === CoreObjectNameSingular.Task)
          ),
      ),
    (fieldMetadataItem) =>
      fieldMetadataItem.type === FieldMetadataType.RELATION ||
      fieldMetadataItem.type === FieldMetadataType.MORPH_RELATION
        ? 'relationFieldMetadataItems'
        : 'inlineFieldMetadataItems',
  );

  // For emailMessage and department: pull MANY_TO_ONE relations out of the
  // boxed section and render them inline so they can be sorted together with
  // other fields in the priority order defined above.
  const isEmailMessage = objectNameSingular === 'emailMessage';
  const isDepartment = objectNameSingular === 'department';
  const pullManyToOneInline = isEmailMessage || isDepartment;
  const allRelations = relationFieldMetadataItems ?? [];
  const relationsForCategorization = pullManyToOneInline
    ? allRelations.filter((f) => f.relation?.type !== RelationType.MANY_TO_ONE)
    : allRelations;
  const manyToOneRelationsForInline = pullManyToOneInline
    ? allRelations.filter((f) => f.relation?.type === RelationType.MANY_TO_ONE)
    : [];

  const {
    activityTargetFields,
    inlineRelationFields,
    junctionRelationFields,
    boxedRelationFields,
  } = categorizeRelationFields({
    relationFields: relationsForCategorization,
    objectNameSingular,
    objectPermissionsByObjectMetadataId,
    isJunctionRelationsEnabled,
  });

  const mergedInlineItems = [
    ...(inlineFieldMetadataItems ?? []),
    ...inlineRelationFields,
    ...manyToOneRelationsForInline,
  ];

  const allInlineFieldMetadataItems = isEmailMessage
    ? sortEmailMessageFields(mergedInlineItems)
    : isDepartment
      ? sortDepartmentFields(mergedInlineItems)
      : mergedInlineItems.sort((a, b) => a.name.localeCompare(b.name));

  return {
    inlineFieldMetadataItems: allInlineFieldMetadataItems,
    legacyActivityTargetFieldMetadataItems: activityTargetFields,
    junctionRelationFieldMetadataItems: junctionRelationFields,
    boxedRelationFieldMetadataItems: boxedRelationFields,
  };
};
