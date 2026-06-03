import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RECORD_TABLE_COLUMN_CHECKBOX_WIDTH } from '@/object-record/record-table/constants/RecordTableColumnCheckboxWidth';
import { RECORD_TABLE_COLUMN_CHECKBOX_WIDTH_CLASS_NAME } from '@/object-record/record-table/constants/RecordTableColumnCheckboxWidthClassName';
import { RECORD_TABLE_COLUMN_DRAG_AND_DROP_WIDTH } from '@/object-record/record-table/constants/RecordTableColumnDragAndDropWidth';
import { RECORD_TABLE_COLUMN_DRAG_AND_DROP_WIDTH_CLASS_NAME } from '@/object-record/record-table/constants/RecordTableColumnDragAndDropWidthClassName';
import { RECORD_TABLE_ROW_HEIGHT } from '@/object-record/record-table/constants/RecordTableRowHeight';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableFilterCell } from '@/object-record/record-table/record-table-filter-row/components/RecordTableFilterCell';
import { isRecordTableFilterRowVisibleComponentState } from '@/object-record/record-table/record-table-filter-row/components/isRecordTableFilterRowVisibleComponentState';
import { getVisibleFieldWithLowestPosition } from '@/object-record/record-table/record-table-header/utils/getVisibleFieldWithLowestPosition';
import { isRecordTableCheckboxColumnHiddenComponentState } from '@/object-record/record-table/states/isRecordTableCheckboxColumnHiddenComponentState';
import { isRecordTableDragColumnHiddenComponentState } from '@/object-record/record-table/states/isRecordTableDragColumnHiddenComponentState';
import { getRecordTableColumnFieldWidthClassName } from '@/object-record/record-table/utils/getRecordTableColumnFieldWidthClassName';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { cx } from '@linaria/core';
import { styled } from '@linaria/react';
import { filterOutByProperty } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledFilterRowContainer = styled.div`
  display: flex;
  flex-direction: row;
`;

const StyledFilterRowDragCell = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  min-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  max-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  min-width: ${RECORD_TABLE_COLUMN_DRAG_AND_DROP_WIDTH}px;
  max-width: ${RECORD_TABLE_COLUMN_DRAG_AND_DROP_WIDTH}px;
  width: ${RECORD_TABLE_COLUMN_DRAG_AND_DROP_WIDTH}px;
`;

const StyledFilterRowCheckboxCell = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  min-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  max-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  min-width: ${RECORD_TABLE_COLUMN_CHECKBOX_WIDTH}px;
`;

const StyledFilterRowFieldCell = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  min-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  max-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
`;

const StyledFilterRowEmptyCell = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  min-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  max-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  flex: 1;
  min-width: 0;
`;

export const RecordTableFilterRow = () => {
  const { visibleRecordFields } = useRecordTableContextOrThrow();
  const { labelIdentifierFieldMetadataItem } = useRecordIndexContextOrThrow();

  const isFilterRowVisible = useAtomComponentStateValue(
    isRecordTableFilterRowVisibleComponentState,
  );

  const isRecordTableDragColumnHidden = useAtomComponentStateValue(
    isRecordTableDragColumnHiddenComponentState,
  );

  const isRecordTableCheckboxColumnHidden = useAtomComponentStateValue(
    isRecordTableCheckboxColumnHiddenComponentState,
  );

  if (!isFilterRowVisible) {
    return null;
  }

  // Column 0: the label identifier field (lowest position visible field)
  const labelIdentifierField =
    getVisibleFieldWithLowestPosition(visibleRecordFields);

  // Column 1: first non-label-identifier field
  // Columns 2+: remaining non-label-identifier fields
  const nonLabelFields = visibleRecordFields.filter(
    filterOutByProperty(
      'fieldMetadataItemId',
      labelIdentifierFieldMetadataItem?.id,
    ),
  );

  const firstNonLabelField = nonLabelFields[0];
  const remainingFields = nonLabelFields.slice(1);

  return (
    <StyledFilterRowContainer>
      {!isRecordTableDragColumnHidden && (
        <StyledFilterRowDragCell
          className={RECORD_TABLE_COLUMN_DRAG_AND_DROP_WIDTH_CLASS_NAME}
        />
      )}
      {!isRecordTableCheckboxColumnHidden && (
        <StyledFilterRowCheckboxCell
          className={RECORD_TABLE_COLUMN_CHECKBOX_WIDTH_CLASS_NAME}
        />
      )}
      {labelIdentifierField && (
        <StyledFilterRowFieldCell
          className={cx(getRecordTableColumnFieldWidthClassName(0))}
        >
          <RecordTableFilterCell
            fieldMetadataItemId={labelIdentifierField.fieldMetadataItemId}
          />
        </StyledFilterRowFieldCell>
      )}
      {firstNonLabelField && (
        <StyledFilterRowFieldCell
          className={cx(getRecordTableColumnFieldWidthClassName(1))}
        >
          <RecordTableFilterCell
            fieldMetadataItemId={firstNonLabelField.fieldMetadataItemId}
          />
        </StyledFilterRowFieldCell>
      )}
      {remainingFields.map((recordField, index) => (
        <StyledFilterRowFieldCell
          key={recordField.fieldMetadataItemId}
          className={cx(getRecordTableColumnFieldWidthClassName(index + 2))}
        >
          <RecordTableFilterCell
            fieldMetadataItemId={recordField.fieldMetadataItemId}
          />
        </StyledFilterRowFieldCell>
      ))}
      <StyledFilterRowEmptyCell />
    </StyledFilterRowContainer>
  );
};
