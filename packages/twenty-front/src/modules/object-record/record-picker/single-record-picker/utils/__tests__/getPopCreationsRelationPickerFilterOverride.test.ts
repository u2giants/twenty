import { CoreObjectNameSingular } from 'twenty-shared/types';

import { getPopCreationsRelationPickerFilterOverride } from '@/object-record/record-picker/single-record-picker/utils/getPopCreationsRelationPickerFilterOverride';

describe('getPopCreationsRelationPickerFilterOverride', () => {
  it('should restrict department company pickers to the pre-fetched customer company ids', () => {
    const ids = ['id-1', 'id-2'];
    expect(
      getPopCreationsRelationPickerFilterOverride({
        sourceObjectNameSingular: 'department',
        targetObjectNameSingular: CoreObjectNameSingular.Company,
        customerCompanyIds: ids,
      }),
    ).toEqual({ id: { in: ids } });
  });

  it('should return a match-nothing filter while customer company ids are still loading', () => {
    expect(
      getPopCreationsRelationPickerFilterOverride({
        sourceObjectNameSingular: 'department',
        targetObjectNameSingular: CoreObjectNameSingular.Company,
        customerCompanyIds: [],
      }),
    ).toEqual({ id: { in: ['00000000-0000-0000-0000-000000000000'] } });
  });

  it('should restrict any-to-company pickers to customer company ids', () => {
    const ids = ['id-1'];
    expect(
      getPopCreationsRelationPickerFilterOverride({
        sourceObjectNameSingular: 'person',
        targetObjectNameSingular: CoreObjectNameSingular.Company,
        customerCompanyIds: ids,
      }),
    ).toEqual({ id: { in: ids } });
  });

  it('should not override pickers that do not target company', () => {
    expect(
      getPopCreationsRelationPickerFilterOverride({
        sourceObjectNameSingular: 'person',
        targetObjectNameSingular: 'workspaceMember',
      }),
    ).toBeUndefined();
  });

  it('should restrict person company pickers to the pre-fetched customer company ids', () => {
    const ids = ['id-1', 'id-2'];

    expect(
      getPopCreationsRelationPickerFilterOverride({
        sourceObjectNameSingular: 'person',
        targetObjectNameSingular: CoreObjectNameSingular.Company,
        customerCompanyIds: ids,
      }),
    ).toEqual({ id: { in: ids } });
  });

  it('should not override unrelated relation pickers', () => {
    expect(
      getPopCreationsRelationPickerFilterOverride({
        sourceObjectNameSingular: 'opportunity',
        targetObjectNameSingular: CoreObjectNameSingular.Company,
      }),
    ).toBeUndefined();
  });
});
