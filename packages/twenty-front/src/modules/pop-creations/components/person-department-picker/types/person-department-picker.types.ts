import { type FieldMetadata } from '@/object-record/record-field/types/FieldMetadata';

export type PersonDepartmentPickerProps = {
  field: FieldMetadata;
  recordId: string;
  onChange?: (departmentId: string | null) => void;
};
