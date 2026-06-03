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

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  padding: ${themeCssVariables.spacing[8]};
  max-width: 960px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 ${themeCssVariables.spacing[1]};
`;

const Subtitle = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const Section = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
  background: ${themeCssVariables.background.primary};
`;

const SectionHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const Td = styled.td`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  vertical-align: middle;
  &:last-child {
    border-bottom: none;
  }
`;

const Tr = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
  &:hover {
    background: ${themeCssVariables.background.tertiary};
  }
`;

const Btn = styled.button<{ $danger?: boolean }>`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  cursor: pointer;
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${({ $danger }) =>
    $danger
      ? themeCssVariables.color.red
      : themeCssVariables.background.secondary};
  color: ${({ $danger }) =>
    $danger ? '#fff' : themeCssVariables.font.color.primary};
  &:hover {
    opacity: 0.8;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Input = styled.input`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  width: 100%;
  box-sizing: border-box;
  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const Select = styled.select`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
`;

const ActionsCell = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const EmptyMsg = styled.td`
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-style: italic;
`;

const Toast = styled.div<{ $error?: boolean }>`
  position: fixed;
  bottom: ${themeCssVariables.spacing[6]};
  right: ${themeCssVariables.spacing[6]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[5]};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${({ $error }) =>
    $error ? themeCssVariables.color.red : '#16a34a'};
  color: #fff;
  font-size: ${themeCssVariables.font.size.sm};
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
    <Page>
      <div>
        <Title>Field Dropdown Options</Title>
        <Subtitle>
          Edit the SELECT options for configurable fields. Changes take effect
          immediately.
        </Subtitle>
      </div>

      {fields.map((entry) => {
        const isEditing = (opt: FieldMetadataItemOption) =>
          edit?.fieldMetadataId === entry.fieldMetadataId &&
          edit.optionId === opt.id;
        const isAdding =
          edit?.fieldMetadataId === entry.fieldMetadataId &&
          edit.optionId === null;

        return (
          <Section key={`${entry.objectName}-${entry.fieldName}`}>
            <SectionHead>
              <SectionTitle>
                {entry.objectName} → {entry.fieldName}
              </SectionTitle>
              <Btn
                onClick={() => startAdd(entry)}
                disabled={
                  saving || edit?.fieldMetadataId === entry.fieldMetadataId
                }
              >
                + Add
              </Btn>
            </SectionHead>

            <Table>
              <thead>
                <tr>
                  <Th>Label</Th>
                  <Th>Value</Th>
                  <Th>Color</Th>
                  <Th>Position</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {entry.options.length === 0 && !isAdding && (
                  <tr>
                    <EmptyMsg colSpan={5}>No options yet.</EmptyMsg>
                  </tr>
                )}
                {entry.options.map((opt) =>
                  isEditing(opt) && edit ? (
                    <Tr key={opt.id}>
                      <Td>
                        <Input
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
                      </Td>
                      <Td>
                        <Input
                          value={edit.value}
                          onChange={(e) =>
                            setEdit({ ...edit, value: e.target.value })
                          }
                        />
                      </Td>
                      <Td>
                        <Select
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
                        </Select>
                      </Td>
                      <Td>
                        <Input
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
                      </Td>
                      <Td>
                        <ActionsCell>
                          <Btn
                            onClick={() => commitEdit(entry)}
                            disabled={
                              saving || !edit.label.trim() || !edit.value.trim()
                            }
                          >
                            Save
                          </Btn>
                          <Btn onClick={() => setEdit(null)}>Cancel</Btn>
                        </ActionsCell>
                      </Td>
                    </Tr>
                  ) : (
                    <Tr key={opt.id}>
                      <Td>{opt.label}</Td>
                      <Td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {opt.value}
                      </Td>
                      <Td>{opt.color}</Td>
                      <Td>{opt.position}</Td>
                      <Td>
                        <ActionsCell>
                          <Btn
                            onClick={() => startEdit(entry, opt)}
                            disabled={saving || !!edit}
                          >
                            Edit
                          </Btn>
                          <Btn
                            $danger
                            onClick={() => deleteOption(entry, opt.id)}
                            disabled={saving || !!edit}
                          >
                            Del
                          </Btn>
                        </ActionsCell>
                      </Td>
                    </Tr>
                  ),
                )}
                {isAdding && edit && (
                  <Tr>
                    <Td>
                      <Input
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
                    </Td>
                    <Td>
                      <Input
                        value={edit.value}
                        onChange={(e) =>
                          setEdit({ ...edit, value: e.target.value })
                        }
                        placeholder="VALUE"
                      />
                    </Td>
                    <Td>
                      <Select
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
                      </Select>
                    </Td>
                    <Td>
                      <Input
                        type="number"
                        value={edit.position}
                        onChange={(e) =>
                          setEdit({ ...edit, position: Number(e.target.value) })
                        }
                        style={{ width: 60 }}
                      />
                    </Td>
                    <Td>
                      <ActionsCell>
                        <Btn
                          onClick={() => commitEdit(entry)}
                          disabled={
                            saving || !edit.label.trim() || !edit.value.trim()
                          }
                        >
                          Save
                        </Btn>
                        <Btn onClick={() => setEdit(null)}>Cancel</Btn>
                      </ActionsCell>
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Section>
        );
      })}

      {toast && <Toast $error={toast.error}>{toast.msg}</Toast>}
    </Page>
  );
};
