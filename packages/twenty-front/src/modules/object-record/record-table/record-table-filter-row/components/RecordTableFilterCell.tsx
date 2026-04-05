import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { recordTableInlineFiltersComponentState } from '@/object-record/record-table/record-table-filter-row/components/recordTableInlineFiltersComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FieldMetadataType } from 'twenty-shared/types';

const DEBOUNCE_MS = 300;

const StyledFilterCell = styled.div`
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-width: 0;
`;

const StyledFilterInput = styled.input`
  width: 100%;
  height: 24px;
  border: 1px solid var(--border-color-medium, #e0e0e0);
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
  font-family: inherit;
  color: var(--font-color-primary, #333);
  background: var(--background-primary, #fff);
  outline: none;

  &:focus {
    border-color: var(--color-blue, #1961ed);
  }

  &::placeholder {
    color: var(--font-color-tertiary, #b3b3b3);
  }
`;

const StyledFilterSelect = styled.select`
  width: 100%;
  height: 24px;
  border: 1px solid var(--border-color-medium, #e0e0e0);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 12px;
  font-family: inherit;
  color: var(--font-color-primary, #333);
  background: var(--background-primary, #fff);
  outline: none;

  &:focus {
    border-color: var(--color-blue, #1961ed);
  }
`;

const StyledFilterCheckbox = styled.select`
  width: 100%;
  height: 24px;
  border: 1px solid var(--border-color-medium, #e0e0e0);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 12px;
  font-family: inherit;
  color: var(--font-color-primary, #333);
  background: var(--background-primary, #fff);
  outline: none;

  &:focus {
    border-color: var(--color-blue, #1961ed);
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

  const inlineFilters = useAtomComponentStateValue(
    recordTableInlineFiltersComponentState,
  );

  const setInlineFilters = useSetAtomComponentState(
    recordTableInlineFiltersComponentState,
  );

  const currentValue = inlineFilters[fieldMetadataItemId] ?? '';
  const [localValue, setLocalValue] = useState(currentValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(currentValue);
  }, [currentValue]);

  const commitValue = useCallback(
    (value: string) => {
      setInlineFilters((prev) => {
        if (value === '') {
          const next = { ...prev };
          delete next[fieldMetadataItemId];
          return next;
        }
        return { ...prev, [fieldMetadataItemId]: value };
      });
    },
    [fieldMetadataItemId, setInlineFilters],
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setLocalValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        commitValue(value);
      }, DEBOUNCE_MS);
    },
    [commitValue],
  );

  const handleSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setLocalValue(value);
      commitValue(value);
    },
    [commitValue],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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
          <StyledFilterSelect
            value={localValue}
            onChange={handleSelectChange}
          >
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
          <StyledFilterCheckbox
            value={localValue}
            onChange={handleSelectChange}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </StyledFilterCheckbox>
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
            onChange={handleTextChange}
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
            onChange={handleTextChange}
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
            onChange={handleTextChange}
            placeholder="Filter..."
          />
        </StyledFilterCell>
      );
  }
};
