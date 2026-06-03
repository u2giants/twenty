import { RecordTableComponentInstanceContext } from '@/object-record/record-table/states/context/RecordTableComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

export const recordTableInlineFiltersComponentState = createAtomComponentState<
  Record<string, string>
>({
  key: 'recordTableInlineFiltersComponentState',
  defaultValue: {},
  componentInstanceContext: RecordTableComponentInstanceContext,
});
