import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecordFilterInput } from '~/generated/graphql';

const COMPANY_SCOPED_DEPARTMENT_SOURCES = [
  'emailMessage',
  'meetingNote',
  'opportunity',
];

export const useCompanyScopedDepartmentFilterOverride = ({
  sourceObjectNameSingular,
  targetObjectNameSingular,
  companyId,
}: {
  sourceObjectNameSingular: string;
  targetObjectNameSingular: string;
  companyId: string | null | undefined;
}): ObjectRecordFilterInput | undefined => {
  const isScoped =
    COMPANY_SCOPED_DEPARTMENT_SOURCES.includes(sourceObjectNameSingular) &&
    targetObjectNameSingular === 'department';

  const { records: departments } = useFindManyRecords({
    objectNameSingular: 'department',
    filter: isScoped && companyId ? { companyId: { eq: companyId } } : {},
    skip: !isScoped || !companyId,
    recordGqlFields: { id: true },
  });

  if (!isScoped) return undefined;

  // No company selected — block all departments (return impossible filter)
  if (!companyId) {
    return { id: { in: [] } } as unknown as ObjectRecordFilterInput;
  }

  if (departments.length === 0) {
    return { id: { in: [] } } as unknown as ObjectRecordFilterInput;
  }

  return {
    id: { in: departments.map((d) => d.id) },
  } as unknown as ObjectRecordFilterInput;
};
