import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

export const useCompanyDepartmentIds = ({
  companyId,
  skip,
}: {
  companyId: string | null | undefined;
  skip: boolean;
}) => {
  const { records, loading } = useFindManyRecords({
    objectNameSingular: 'department',
    filter: companyId ? { companyId: { eq: companyId } } : undefined,
    recordGqlFields: { id: true },
    limit: 200,
    skip: skip || !companyId,
  });

  return { ids: records.map((r) => r.id as string), loading };
};
