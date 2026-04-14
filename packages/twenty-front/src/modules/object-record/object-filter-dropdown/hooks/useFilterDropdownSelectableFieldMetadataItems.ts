import { objectFilterDropdownSearchInputComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSearchInputComponentState';
import { visibleRecordFieldsComponentSelector } from '@/object-record/record-field/states/visibleRecordFieldsComponentSelector';
import { useFilterableFieldMetadataItemsInRecordIndexContext } from '@/object-record/record-filter/hooks/useFilterableFieldMetadataItemsInRecordIndexContext';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

// Fields to surface first in the filter dialog, keyed by object nameSingular.
const PRIORITY_FILTER_FIELD_LABELS: Record<string, string[]> = {
  person: ['Company Customer Status', 'Department'],
  meetingNote: ['Company', 'Department'],
  emailMessage: ['Company', 'Department'],
};

const makePrioritySort =
  (priorityLabels: string[]) =>
  (a: { label: string }, b: { label: string }) => {
    const ai = priorityLabels.indexOf(a.label);
    const bi = priorityLabels.indexOf(b.label);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.label.localeCompare(b.label);
  };

export const useFilterDropdownSelectableFieldMetadataItems = () => {
  const { recordIndexId, objectMetadataItem } = useRecordIndexContextOrThrow();

  const objectFilterDropdownSearchInput = useAtomComponentStateValue(
    objectFilterDropdownSearchInputComponentState,
  );

  const { filterableFieldMetadataItems } =
    useFilterableFieldMetadataItemsInRecordIndexContext();

  const visibleRecordFields = useAtomComponentSelectorValue(
    visibleRecordFieldsComponentSelector,
    recordIndexId,
  );

  const visibleFieldMetadataItemIds = visibleRecordFields.map(
    (recordField) => recordField.fieldMetadataItemId,
  );

  const filteredSearchInputFieldMetadataItems =
    filterableFieldMetadataItems.filter((fieldMetadataItem) =>
      fieldMetadataItem.label
        .toLocaleLowerCase()
        .includes(objectFilterDropdownSearchInput.toLocaleLowerCase()),
    );

  const priorityLabels =
    PRIORITY_FILTER_FIELD_LABELS[objectMetadataItem.nameSingular] ?? [];

  const selectableVisibleFieldMetadataItems =
    filteredSearchInputFieldMetadataItems
      .sort((a, b) => {
        const positionSort =
          visibleFieldMetadataItemIds.indexOf(a.id) -
          visibleFieldMetadataItemIds.indexOf(b.id);
        if (priorityLabels.length === 0) return positionSort;
        return makePrioritySort(priorityLabels)(a, b);
      })
      .filter((fieldMetadataItem) =>
        visibleFieldMetadataItemIds.includes(fieldMetadataItem.id),
      );

  const selectableHiddenFieldMetadataItems =
    filteredSearchInputFieldMetadataItems
      .sort(makePrioritySort(priorityLabels))
      .filter(
        (fieldMetadataItem) =>
          !visibleFieldMetadataItemIds.includes(fieldMetadataItem.id),
      );

  return {
    selectableVisibleFieldMetadataItems,
    selectableHiddenFieldMetadataItems,
  };
};
