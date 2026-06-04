import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useAtom } from 'jotai';
import { FieldMetadataType } from 'twenty-shared/types';

const COMPANY_SCOPED_DEPARTMENT_SOURCES = [
  'emailMessage',
  'meetingNote',
  'opportunity',
];

export const usePopCreationsDepartmentReadOnly = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [recordInStore] = useAtom(
    recordStoreFamilyState.atomFamily(objectRecordId),
  );

  const companyId = (recordInStore as Record<string, unknown> | null)
    ?.companyId as string | null | undefined;

  return (fieldMetadataItem: FieldMetadataItem): boolean => {
    if (!COMPANY_SCOPED_DEPARTMENT_SOURCES.includes(objectNameSingular)) {
      return false;
    }
    return (
      fieldMetadataItem.type === FieldMetadataType.RELATION &&
      fieldMetadataItem.relation?.targetObjectMetadata.nameSingular ===
        'department' &&
      !companyId
    );
  };
};
