import { CoreObjectNameSingular } from 'twenty-shared/types';

import { type ObjectRecordFilterInput } from '~/generated/graphql';

type GetPopCreationsRelationPickerFilterOverrideArgs = {
  sourceObjectNameSingular?: string;
  targetObjectNameSingular: string;
  customerCompanyIds?: string[];
  companyId?: string | null;
};

const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
const RESTRICTED_SOURCES = ['department', 'person'];

// Objects that have both company and department relations — department picker
// must be scoped to the currently selected company.
const COMPANY_SCOPED_DEPARTMENT_SOURCES = [
  'emailMessage',
  'meetingNote',
  'opportunity',
];

export const getPopCreationsRelationPickerFilterOverride = ({
  sourceObjectNameSingular,
  targetObjectNameSingular,
  customerCompanyIds,
  companyId,
}: GetPopCreationsRelationPickerFilterOverrideArgs):
  | ObjectRecordFilterInput
  | undefined => {
  // Department picker scoped to the record's currently selected company
  if (
    COMPANY_SCOPED_DEPARTMENT_SOURCES.includes(
      sourceObjectNameSingular ?? '',
    ) &&
    targetObjectNameSingular === 'department'
  ) {
    if (!companyId) return undefined; // no company yet — show all departments
    return { companyId: { eq: companyId } } as ObjectRecordFilterInput;
  }

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
