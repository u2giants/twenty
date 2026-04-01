import { SingleRecordPicker } from '@/object-record/record-picker/single-record-picker/components/SingleRecordPicker';
import { useDialog } from '@/ui/layout/dialog/hooks/useDialog';
import { useDialogManager } from '@/ui/layout/dialog/hooks/useDialogManager';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { createComponentInstanceContext } from '@/ui/utilities/state/component-state/utils/createComponentInstanceContext';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { IconBuilding } from 'twenty-ui/display';

import { type PersonDepartmentPickerProps } from '../types/person-department-picker.types';

const PersonDepartmentPickerInstanceContext = createComponentInstanceContext();

export const PersonDepartmentPicker = ({
  field,
  recordId,
  onChange,
}: PersonDepartmentPickerProps) => {
  const { t } = useLingui();
  const componentInstanceId = useAvailableComponentInstanceIdOrThrow(
    PersonDepartmentPickerInstanceContext,
  );

  const { openDialog } = useDialog();
  const { enqueueDialog } = useDialogManager();

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleSelectDepartment = (departmentId: string | undefined) => {
    onChange?.(departmentId ?? null);
    setIsPickerOpen(false);
  };

  const handleClearDepartment = () => {
    onChange?.(null);
  };

  return (
    <PersonDepartmentPickerInstanceContext.Provider
      value={{ instanceId: componentInstanceId }}
    >
      <div>
        <SingleRecordPicker
          componentInstanceId={componentInstanceId}
          EmptyIcon={IconBuilding}
          emptyLabel={t`No department`}
          onCancel={() => setIsPickerOpen(false)}
          onChange={(record) => handleSelectDepartment(record?.recordId)}
          objectNameSingulars={['department']}
          recordPickerInstanceId={`person-department-picker-${recordId}`}
        />
      </div>
    </PersonDepartmentPickerInstanceContext.Provider>
  );
};
