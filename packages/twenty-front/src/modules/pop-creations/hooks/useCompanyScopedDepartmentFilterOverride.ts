import { type ObjectRecordFilterInput } from '~/generated/graphql';

export const useCompanyScopedDepartmentFilterOverride = ({
  targetObjectNameSingular,
  departmentIds,
  loading,
}: {
  targetObjectNameSingular: string;
  departmentIds: string[];
  loading: boolean;
}): ObjectRecordFilterInput | undefined => {
  if (targetObjectNameSingular !== 'department') return undefined;

  if (loading) {
    return { id: { in: [] } } as unknown as ObjectRecordFilterInput;
  }

  return {
    id: { in: departmentIds },
  } as unknown as ObjectRecordFilterInput;
};
