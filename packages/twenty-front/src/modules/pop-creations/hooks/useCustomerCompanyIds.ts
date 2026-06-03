import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

export const useCustomerCompanyIds = ({ skip }: { skip: boolean }) => {
  const { records, loading } = useFindManyRecords({
    objectNameSingular: 'company',
    filter: {
      customerStatus: { in: ['ACTIVE_CUSTOMER', 'POTENTIAL_CUSTOMER'] },
    },
    recordGqlFields: { id: true },
    limit: 200,
    skip,
  });

  return { ids: records.map((r) => r.id as string), loading };
};
