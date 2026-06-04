import { CoreObjectNameSingular } from 'twenty-shared/types';

import { type ObjectRecordFilterInput } from '~/generated/graphql';

type GetPopCreationsRelationPickerFilterOverrideArgs = {
  sourceObjectNameSingular?: string;
  targetObjectNameSingular: string;
  customerCompanyIds?: string[];
};

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
const RESTRICTED_SOURCES = ['department', 'person'];

export const getPopCreationsRelationPickerFilterOverride = ({
  sourceObjectNameSingular,
  targetObjectNameSingular,
  customerCompanyIds,
}: GetPopCreationsRelationPickerFilterOverrideArgs):
  | ObjectRecordFilterInput
  | undefined => {
  if (!RESTRICTED_SOURCES.includes(sourceObjectNameSingular ?? '')) {
    return undefined;
  }

  if (targetObjectNameSingular === CoreObjectNameSingular.Company) {
    const ids =
      customerCompanyIds && customerCompanyIds.length > 0
        ? customerCompanyIds
        : [NO_MATCH_UUID];
    return { id: { in: ids } } as ObjectRecordFilterInput;
  }

  return undefined;
};
