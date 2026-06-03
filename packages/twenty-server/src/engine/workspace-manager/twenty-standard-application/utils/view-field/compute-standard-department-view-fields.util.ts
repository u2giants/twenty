import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import {
  createStandardViewFieldFlatMetadata,
  type CreateStandardViewFieldArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field/create-standard-view-field-flat-metadata.util';

export const computeStandardDepartmentViewFields = (
  args: Omit<CreateStandardViewFieldArgs<'department'>, 'context'>,
): Record<string, FlatViewField> => {
  return {
    allDepartmentsName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'department',
      context: {
        viewName: 'allDepartments',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 200,
      },
    }),
    allDepartmentsCompany: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'department',
      context: {
        viewName: 'allDepartments',
        viewFieldName: 'company',
        fieldName: 'company',
        position: 1,
        isVisible: true,
        size: 180,
      },
    }),
    allDepartmentsCategory: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'department',
      context: {
        viewName: 'allDepartments',
        viewFieldName: 'category',
        fieldName: 'category',
        position: 2,
        isVisible: true,
        size: 150,
      },
    }),
    allDepartmentsActive: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'department',
      context: {
        viewName: 'allDepartments',
        viewFieldName: 'active',
        fieldName: 'active',
        position: 3,
        isVisible: true,
        size: 100,
      },
    }),
    allDepartmentsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'department',
      context: {
        viewName: 'allDepartments',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 4,
        isVisible: false,
        size: 150,
      },
    }),
  };
};
