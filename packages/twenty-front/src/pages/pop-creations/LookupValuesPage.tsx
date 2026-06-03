import { useState } from 'react';

import { styled } from '@linaria/react';
import { v4 as uuidv4 } from 'uuid';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useUpdateOneFieldMetadataItem } from '@/object-metadata/hooks/useUpdateOneFieldMetadataItem';
import { type FieldMetadataItemOption } from '@/object-metadata/types/FieldMetadataItem';
import { type ThemeColor } from 'twenty-ui/theme';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MANAGED_FIELDS: Array<{ objectName: string; fieldName: string }> = [
  { objectName: 'department', fieldName: 'category' },
  { objectName: 'department', fieldName: 'division' },
  { objectName: 'company', fieldName: 'customerStatus' },
  { objectName: 'company', fieldName: 'chainType' },
  { objectName: 'person', fieldName: 'contactType' },
  { objectName: 'opportunity', fieldName: 'programType' },
  { objectName: 'opportunity', fieldName: 'seasonYear' },
  { objectName: 'opportunity', fieldName: 'directiveSource' },
  { objectName: 'opportunity', fieldName: 'division' },
  { objectName: 'opportunity', fieldName: 'originCountry' },
  { objectName: 'opportunity', fieldName: 'customerIncoterms' },
  { objectName: 'opportunity', fieldName: 'factoryIncoterms' },
  { objectName: 'opportunity', fieldName: 'sampleApprovalMethod' },
];

const COLORS: ThemeColor[] = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'jade',
  'mint',
  'cyan',
  'sky',
  'blue',
  'iris',
  'violet',
  'purple',
  'pink',
  'crimson',
  'gray',
  'brown',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldEntry = {
  objectMetadataId: string;
  fieldMetadataId: string;
  objectName: string;
  fieldName: string;
  options: FieldMetadataItemOption[];
};

type EditState = {
  fieldMetadataId: string;
  optionId: string | null; // null = new option
  label: string;
  value: string;
  color: ThemeColor;
  position: number;
};

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const StyledPage = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  margin: 0 auto;
  max-width: 960px;
  padding: ${themeCssVariables.spacing[8]};
`;

const StyledTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 ${themeCssVariables.spacing[1]};
`;

const StyledSubtitle = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledSection = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
`;

const StyledSectionHead = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;
`;

const StyledTh = styled.th`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  text-align: left;
`;

const StyledTd = styled.td`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  vertical-align: middle;
  &:last-child {
    border-bottom: none;
  }
`;

const StyledTr = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
  &:hover {
    background: ${themeCssVariables.background.tertiary};
  }
`;

const StyledBtn = styled.button<{ $danger?: boolean }>`
  background: ${({ $danger }) =>
    $danger
      ? themeCssVariables.color.red
      : themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ $danger }) =>
    $danger ? themeCssVariables.font.color.inverted : themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  &:hover {
    opacity: 0.8;
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  width: 100%;
  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledActionsCell = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledEmptyMsg = styled.td`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-style: italic;
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;
`;

const StyledToast = styled.div<{ $error?: boolean }>`
  background: ${({ $error }) =>
    $error ? themeCssVariables.color.red : themeCssVariables.color.green};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.inverted};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]};
  position: fixed;
  right: ${themeCssVariables.spacing[6]};
  z-index: 9999;
`;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const toLabelToValue = (label: string) =>
  label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LookupValuesPage = () => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const { updateOneFieldMetadataItem } = useUpdateOneFieldMetadataItem();
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(
    null,
  );

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const fields: FieldEntry[] = MANAGED_FIELDS.flatMap(
    ({ objectName, fieldName }) => {
      const obj = objectMetadataItems.find(
        (o) => o.nameSingular === objectName,
      );
      if (!obj) return [];
      const field = obj.fields.find((f) => f.name === fieldName);
      if (!field) return [];
      return [
        {
          objectMetadataId: obj.id,
          fieldMetadataId: field.id,
          objectName,
          fieldName,
          options: (field.options ?? [])
            .slice()
            .sort((a, b) => a.position - b.position),
        },
      ];
    },
  );

  const saveOptions = async (
    entry: FieldEntry,
    newOptions: FieldMetadataItemOption[],
  ) => {
    setSaving(true);
    try {
      const result = await updateOneFieldMetadataItem({
        objectMetadataId: entry.objectMetadataId,
        fieldMetadataIdToUpdate: entry.fieldMetadataId,
        updatePayload: { options: newOptions },
      });
      if (result.status === 'successful') {
        showToast('Saved.');
      } else {
        showToast('Save failed.', true);
      }
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setSaving(false);
    }
  };

  const startAdd = (entry: FieldEntry) => {
    setEdit({
      fieldMetadataId: entry.fieldMetadataId,
      optionId: null,
      label: '',
      value: '',
      color: 'gray',
      position: entry.options.length,
    });
  };

  const startEdit = (entry: FieldEntry, opt: FieldMetadataItemOption) => {
    setEdit({
      fieldMetadataId: entry.fieldMetadataId,
      optionId: opt.id,
      label: opt.label,
      value: opt.value,
      color: opt.color,
      position: opt.position,
    });
  };

  const commitEdit = async (entry: FieldEntry) => {
    if (!edit) return;
    const isNew = edit.optionId === null;
    let newOptions: FieldMetadataItemOption[];
    if (isNew) {
      newOptions = [
        ...entry.options,
        {
          id: uuidv4(),
          label: edit.label.trim(),
          value: edit.value.trim(),
          color: edit.color,
          position: edit.position,
        },
      ];
    } else {
      newOptions = entry.options.map((o) =>
        o.id === edit.optionId
          ? {
              ...o,
              label: edit.label.trim(),
              value: edit.value.trim(),
              color: edit.color,
              position: edit.position,
            }
          : o,
      );
    }
    setEdit(null);
    await saveOptions(entry, newOptions);
  };

  const deleteOption = async (entry: FieldEntry, optId: string) => {
    if (!window.confirm('Delete this option?')) return;
    await saveOptions(
      entry,
      entry.options.filter((o) => o.id !== optId),
    );
  };

  return (
    <StyledPage>
      <div>
        <StyledTitle>Field Dropdown Options</StyledTitle>
        <StyledSubtitle>
          Edit the SELECT options for configurable fields. Changes take effect
          immediately.
        </StyledSubtitle>
      </div>

      {fields.map((entry) => {
        const isEditing = (opt: FieldMetadataItemOption) =>
          edit?.fieldMetadataId === entry.fieldMetadataId &&
          edit.optionId === opt.id;
        const isAdding =
          edit?.fieldMetadataId === entry.fieldMetadataId &&
          edit.optionId === null;

        return (
          <StyledSection key={`${entry.objectName}-${entry.fieldName}`}>
            <StyledSectionHead>
              <StyledSectionTitle>
                {entry.objectName} → {entry.fieldName}
              </StyledSectionTitle>
              <StyledBtn
                onClick={() => startAdd(entry)}
                disabled={
                  saving || edit?.fieldMetadataId === entry.fieldMetadataId
                }
              >
                + Add
              </StyledBtn>
            </StyledSectionHead>

            <StyledTable>
              <thead>
                <tr>
                  <StyledTh>Label</StyledTh>
                  <StyledTh>Value</StyledTh>
                  <StyledTh>Color</StyledTh>
                  <StyledTh>Position</StyledTh>
                  <StyledTh>Actions</StyledTh>
                </tr>
              </thead>
              <tbody>
                {entry.options.length === 0 && !isAdding && (
                  <tr>
                    <StyledEmptyMsg colSpan={5}>No options yet.</StyledEmptyMsg>
                  </tr>
                )}
                {entry.options.map((opt) =>
                  isEditing(opt) && edit ? (
                    <StyledTr key={opt.id}>
                      <StyledTd>
                        <StyledInput
                          value={edit.label}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              label: e.target.value,
                              value: toLabelToValue(e.target.value),
                            })
                          }
                          autoFocus
                        />
                      </StyledTd>
                      <StyledTd>
                        <StyledInput
                          value={edit.value}
                          onChange={(e) =>
                            setEdit({ ...edit, value: e.target.value })
                          }
                        />
                      </StyledTd>
                      <StyledTd>
                        <StyledSelect
                          value={edit.color}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              color: e.target.value as ThemeColor,
                            })
                          }
                        >
                          {COLORS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </StyledSelect>
                      </StyledTd>
                      <StyledTd>
                        <StyledInput
                          type="number"
                          value={edit.position}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              position: Number(e.target.value),
                            })
                          }
                          style={{ width: 60 }}
                        />
                      </StyledTd>
                      <StyledTd>
                        <StyledActionsCell>
                          <StyledBtn
                            onClick={() => commitEdit(entry)}
                            disabled={
                              saving || !edit.label.trim() || !edit.value.trim()
                            }
                          >
                            Save
                          </StyledBtn>
                          <StyledBtn onClick={() => setEdit(null)}>Cancel</StyledBtn>
                        </StyledActionsCell>
                      </StyledTd>
                    </StyledTr>
                  ) : (
                    <StyledTr key={opt.id}>
                      <StyledTd>{opt.label}</StyledTd>
                      <StyledTd style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {opt.value}
                      </StyledTd>
                      <StyledTd>{opt.color}</StyledTd>
                      <StyledTd>{opt.position}</StyledTd>
                      <StyledTd>
                        <StyledActionsCell>
                          <StyledBtn
                            onClick={() => startEdit(entry, opt)}
                            disabled={saving || !!edit}
                          >
                            Edit
                          </StyledBtn>
                          <StyledBtn
                            $danger
                            onClick={() => deleteOption(entry, opt.id)}
                            disabled={saving || !!edit}
                          >
                            Del
                          </StyledBtn>
                        </StyledActionsCell>
                      </StyledTd>
                    </StyledTr>
                  ),
                )}
                {isAdding && edit !== null && (
                  <StyledTr>
                    <StyledTd>
                      <StyledInput
                        value={edit.label}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            label: e.target.value,
                            value: toLabelToValue(e.target.value),
                          })
                        }
                        placeholder="Label"
                        autoFocus
                      />
                    </StyledTd>
                    <StyledTd>
                      <StyledInput
                        value={edit.value}
                        onChange={(e) =>
                          setEdit({ ...edit, value: e.target.value })
                        }
                        placeholder="VALUE"
                      />
                    </StyledTd>
                    <StyledTd>
                      <StyledSelect
                        value={edit.color}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            color: e.target.value as ThemeColor,
                          })
                        }
                      >
                        {COLORS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </StyledSelect>
                    </StyledTd>
                    <StyledTd>
                      <StyledInput
                        type="number"
                        value={edit.position}
                        onChange={(e) =>
                          setEdit({ ...edit, position: Number(e.target.value) })
                        }
                        style={{ width: 60 }}
                      />
                    </StyledTd>
                    <StyledTd>
                      <StyledActionsCell>
                        <StyledBtn
                          onClick={() => commitEdit(entry)}
                          disabled={
                            saving || !edit.label.trim() || !edit.value.trim()
                          }
                        >
                          Save
                        </StyledBtn>
                        <StyledBtn onClick={() => setEdit(null)}>Cancel</StyledBtn>
                      </StyledActionsCell>
                    </StyledTd>
                  </StyledTr>
                )}
              </tbody>
            </StyledTable>
          </StyledSection>
        );
      })}

      {toast && <StyledToast $error={toast.error}>{toast.msg}</StyledToast>}
    </StyledPage>
  );
};
