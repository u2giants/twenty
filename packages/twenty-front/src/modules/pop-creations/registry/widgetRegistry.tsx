import { DepartmentDashboardWidget } from '@/pop-creations/components/DepartmentDashboardWidget';
import { ProgramFolioWidget } from '@/pop-creations/components/ProgramFolioWidget';
import type { FC } from 'react';

/**
 * POP Creations widget registry.
 *
 * To add a new custom widget:
 *   1. Create the component in packages/twenty-front/src/modules/pop-creations/components/
 *   2. Import it here and add an entry below.
 *   3. Done — WidgetContentRenderer.tsx never needs to change again.
 *
 * The key matches the `frontComponentName` field stored in the widget's
 * page layout configuration in the database.
 */
export const POP_CREATIONS_WIDGET_REGISTRY: Record<string, FC> = {
  departmentDashboard: DepartmentDashboardWidget,
  programFolio: ProgramFolioWidget,
};
