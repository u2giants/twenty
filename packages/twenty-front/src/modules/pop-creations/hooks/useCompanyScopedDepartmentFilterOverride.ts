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

  if (!isScoped) return undefined;

  // No company selected — block all departments (return impossible filter)
  if (!companyId) {
    return { id: { in: [] } } as unknown as ObjectRecordFilterInput;
  }

  return {
    companyId: { eq: companyId },
  } as unknown as ObjectRecordFilterInput;
};
