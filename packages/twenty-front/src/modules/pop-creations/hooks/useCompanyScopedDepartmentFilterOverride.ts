import { type ObjectRecordFilterInput } from '~/generated/graphql';

export const useCompanyScopedDepartmentFilterOverride = ({
  targetObjectNameSingular,
  companyId,
}: {
  targetObjectNameSingular: string;
  companyId: string | null | undefined;
}): ObjectRecordFilterInput | undefined => {
  if (targetObjectNameSingular !== 'department') return undefined;

  // No company selected — block all departments (return impossible filter)
  if (!companyId) {
    return { id: { in: [] } } as unknown as ObjectRecordFilterInput;
  }

  return {
    companyId: { eq: companyId },
  } as unknown as ObjectRecordFilterInput;
};
