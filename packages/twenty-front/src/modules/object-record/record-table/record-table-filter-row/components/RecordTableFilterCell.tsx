import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { recordTableInlineFiltersComponentState } from '@/object-record/record-table/record-table-filter-row/components/recordTableInlineFiltersComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { FieldMetadataType } from 'twenty-shared/types';

const DEBOUNCE_MS = 300;

const StyledFilterCell = styled.div`
  align-items: center;
  display: flex;
  min-width: 0;
  padding: 0 8px;
`;

const StyledFilterInput = styled.input`
  background: var(--background-primary);
  border: 1px solid var(--border-color-medium);
  border-radius: 4px;
  color: var(--font-color-primary);
  font-family: inherit;
  font-size: 12px;
  height: 24px;
  outline: none;
  padding: 0 6px;
  width: 100%;

  &:focus {
    border-color: var(--color-blue);
  }

  &::placeholder {
    color: var(--font-color-tertiary);
  }
`;

const StyledFilterSelect = styled.select`
  background: var(--background-primary);
  border: 1px solid var(--border-color-medium);
  border-radius: 4px;
  color: var(--font-color-primary);
  font-family: inherit;
  font-size: 12px;
  height: 24px;
  outline: none;
  padding: 0 4px;
  width: 100%;

  &:focus {
    border-color: var(--color-blue);
  }
`;

type RecordTableFilterCellProps = {
  fieldMetadataItemId: string;
};

export const RecordTableFilterCell = ({
  fieldMetadataItemId,
}: RecordTableFilterCellProps) => {
  const { objectMetadataItem } = useRecordTableContextOrThrow();

  const fieldMetadataItem = objectMetadataItem.fields.find(
    (field) => field.id === fieldMetadataItemId,
  );

  const recordTableInlineFilters = useAtomComponentStateValue(
    recordTableInlineFiltersComponentState,
  );

  const setRecordTableInlineFilters = useSetAtomComponentState(
    recordTableInlineFiltersComponentState,
  );

  const currentValue = recordTableInlineFilters[fieldMetadataItemId] ?? '';
  const [localValue, setLocalValue] = useState(currentValue);
  const [debouncedValue] = useDebounce(localValue, DEBOUNCE_MS);

  useEffect(() => {
    setLocalValue(currentValue);
  }, [currentValue]);

  useEffect(() => {
    setRecordTableInlineFilters((prev) => {
      if (debouncedValue === '') {
        const next = { ...prev };
        delete next[fieldMetadataItemId];
        return next;
      }
      return { ...prev, [fieldMetadataItemId]: debouncedValue };
    });
  }, [debouncedValue, fieldMetadataItemId, setRecordTableInlineFilters]);

  const handleSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setLocalValue(value);
      setRecordTableInlineFilters((prev) => {
        if (value === '') {
          const next = { ...prev };
          delete next[fieldMetadataItemId];
          return next;
        }
        return { ...prev, [fieldMetadataItemId]: value };
      });
    },
    [fieldMetadataItemId, setRecordTableInlineFilters],
  );

  if (!fieldMetadataItem) {
    return <StyledFilterCell />;
  }

  const fieldType = fieldMetadataItem.type as FieldMetadataType;
  const options =
    (fieldMetadataItem as { options?: { value: string; label: string }[] })
      .options ?? [];

  switch (fieldType) {
    case FieldMetadataType.SELECT:
    case FieldMetadataType.MULTI_SELECT:
      return (
        <StyledFilterCell>
          <StyledFilterSelect value={localValue} onChange={handleSelectChange}>
            <option value="">All</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </StyledFilterSelect>
        </StyledFilterCell>
      );

    case FieldMetadataType.BOOLEAN:
      return (
        <StyledFilterCell>
          <StyledFilterSelect value={localValue} onChange={handleSelectChange}>
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </StyledFilterSelect>
        </StyledFilterCell>
      );

    case FieldMetadataType.NUMBER:
    case FieldMetadataType.CURRENCY:
    case FieldMetadataType.NUMERIC:
      return (
        <StyledFilterCell>
          <StyledFilterInput
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder="Filter..."
          />
        </StyledFilterCell>
      );

    case FieldMetadataType.DATE:
    case FieldMetadataType.DATE_TIME:
      return (
        <StyledFilterCell>
          <StyledFilterInput
            type="date"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
          />
        </StyledFilterCell>
      );

    case FieldMetadataType.TEXT:
    case FieldMetadataType.EMAILS:
    case FieldMetadataType.PHONES:
    case FieldMetadataType.LINKS:
    case FieldMetadataType.RELATION:
    case FieldMetadataType.FULL_NAME:
    case FieldMetadataType.ADDRESS:
    default:
      return (
        <StyledFilterCell>
          <StyledFilterInput
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder="Filter..."
          />
        </StyledFilterCell>
      );
  }
};
