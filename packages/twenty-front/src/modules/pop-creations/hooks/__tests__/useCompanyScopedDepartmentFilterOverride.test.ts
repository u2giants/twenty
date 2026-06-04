import { useCompanyScopedDepartmentFilterOverride } from '@/pop-creations/hooks/useCompanyScopedDepartmentFilterOverride';

describe('useCompanyScopedDepartmentFilterOverride', () => {
  it('should scope department pickers to the selected company', () => {
    expect(
      useCompanyScopedDepartmentFilterOverride({
        targetObjectNameSingular: 'department',
        companyId: 'company-id',
      }),
    ).toEqual({ companyId: { eq: 'company-id' } });
  });

  it('should block department pickers until a company is selected', () => {
    expect(
      useCompanyScopedDepartmentFilterOverride({
        targetObjectNameSingular: 'department',
        companyId: null,
      }),
    ).toEqual({ id: { in: [] } });
  });

  it('should leave non-department pickers unchanged', () => {
    expect(
      useCompanyScopedDepartmentFilterOverride({
        targetObjectNameSingular: 'company',
        companyId: 'company-id',
      }),
    ).toBeUndefined();
  });
});
