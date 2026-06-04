import { useCompanyScopedDepartmentFilterOverride } from '@/pop-creations/hooks/useCompanyScopedDepartmentFilterOverride';

describe('useCompanyScopedDepartmentFilterOverride', () => {
  it('should scope department pickers to the selected company department ids', () => {
    expect(
      useCompanyScopedDepartmentFilterOverride({
        targetObjectNameSingular: 'department',
        departmentIds: ['department-id'],
        loading: false,
      }),
    ).toEqual({ id: { in: ['department-id'] } });
  });

  it('should block department pickers while department ids are loading', () => {
    expect(
      useCompanyScopedDepartmentFilterOverride({
        targetObjectNameSingular: 'department',
        departmentIds: [],
        loading: true,
      }),
    ).toEqual({ id: { in: [] } });
  });

  it('should leave non-department pickers unchanged', () => {
    expect(
      useCompanyScopedDepartmentFilterOverride({
        targetObjectNameSingular: 'company',
        departmentIds: ['department-id'],
        loading: false,
      }),
    ).toBeUndefined();
  });
});
