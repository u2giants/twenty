import { styled } from '@linaria/react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const PROGRAM_FOLIO_QUERY = gql`
  query ProgramFolio($id: ID!) {
    opportunity(filter: { id: { eq: $id } }) {
      id
      name
      stage
      programType
      seasonYear
      licensed
      sampleRequired
      hardDeliveryDate
      productionPoNumber
      salesOrderNumber
      importPoNumber
      clickupStatus
      clickupTaskId
      customerIncoterms
      factoryIncoterms
      department {
        id
        name
      }
      factory {
        id
        name
        location
      }
      company {
        id
        name
      }
      licensorApprovalThreads {
        edges {
          node {
            id
            propertyName
            stage
            submittedDate
            dueDate
          }
        }
      }
      emailMessages {
        edges {
          node {
            id
            subject
            sender
            receivedAt
            routingMethod
          }
        }
      }
      meetingNotes {
        edges {
          node {
            id
            name
            date
            participants
          }
        }
      }
    }
  }
`;

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  DIRECTIVE_RECEIVED: { bg: '#dbeafe', text: '#1d4ed8' },
  DESIGN_IN_PROGRESS: { bg: '#ede9fe', text: '#7c3aed' },
  BUYER_REVIEW: { bg: '#cffafe', text: '#0e7490' },
  PRICING_AND_SAMPLING: { bg: '#fef3c7', text: '#b45309' },
  IN_PRODUCTION: { bg: '#d1fae5', text: '#047857' },
  SHIPPED: { bg: '#e0f2fe', text: '#0369a1' },
  CLOSED: { bg: '#f3f4f6', text: '#4b5563' },
};

const LAT_STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  CONCEPT_SUBMIT: { bg: '#dbeafe', text: '#1d4ed8' },
  CONCEPT_REVISIONS: { bg: '#fef3c7', text: '#b45309' },
  RESUBMIT: { bg: '#ede9fe', text: '#7c3aed' },
  CONCEPT_APPROVED_WITH_COMMENTS: { bg: '#cffafe', text: '#0e7490' },
  CONCEPT_APPROVED: { bg: '#d1fae5', text: '#047857' },
  PPS_SUBMIT: { bg: '#e0f2fe', text: '#0369a1' },
  PPS_APPROVED: { bg: '#dcfce7', text: '#15803d' },
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  height: 100%;
  overflow: auto;
  padding: ${themeCssVariables.spacing[6]};
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSectionTitle = styled.h3`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
  padding-bottom: ${themeCssVariables.spacing[2]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledDetailsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[6]};
`;

const StyledDetailRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[1.5]} 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledDetailLabel = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StyledDetailValue = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledChip = styled.span<{ bgColor: string; textColor: string }>`
  display: inline-flex;
  align-items: center;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${(props) => props.bgColor};
  color: ${(props) => props.textColor};
`;

const StyledInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledInfoLabel = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.tertiary};
  min-width: 80px;
`;

const StyledInfoValue = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledLatRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};

  &:last-child {
    border-bottom: none;
  }
`;

const StyledLatInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledLatName = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledLatMeta = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledEmailRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[2]} 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};

  &:last-child {
    border-bottom: none;
  }
`;

const StyledEmailSubject = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledEmailMeta = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledMeetingRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[2]} 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};

  &:last-child {
    border-bottom: none;
  }
`;

const StyledMeetingTitle = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledMeetingMeta = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[10]};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledEmpty = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[2]} 0;
`;

type LATNode = {
  id: string;
  propertyName: string | null;
  stage: string | null;
  submittedDate: string | null;
  dueDate: string | null;
};

type EmailNode = {
  id: string;
  subject: string | null;
  sender: string | null;
  receivedAt: string | null;
  routingMethod: string | null;
};

type MeetingNoteNode = {
  id: string;
  name: string;
  date: string | null;
  participants: string | null;
};

type OpportunityData = {
  opportunity: {
    id: string;
    name: string;
    stage: string | null;
    programType: string | null;
    seasonYear: string | null;
    licensed: boolean | null;
    sampleRequired: boolean | null;
    hardDeliveryDate: string | null;
    productionPoNumber: string | null;
    salesOrderNumber: string | null;
    importPoNumber: string | null;
    clickupStatus: string | null;
    clickupTaskId: string | null;
    customerIncoterms: string | null;
    factoryIncoterms: string | null;
    department: { id: string; name: string } | null;
    factory: { id: string; name: string; location: string | null } | null;
    company: { id: string; name: string } | null;
    licensorApprovalThreads: { edges: Array<{ node: LATNode }> };
    emailMessages: { edges: Array<{ node: EmailNode }> };
    meetingNotes: { edges: Array<{ node: MeetingNoteNode }> };
  } | null;
};

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatEnumValue(value: string | null): string {
  if (!value) return '-';
  return value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

type DetailField = {
  label: string;
  value: string;
};

export const ProgramFolioWidget = () => {
  const { id } = useTargetRecord();

  const { data, loading, error } = useQuery<OpportunityData>(
    PROGRAM_FOLIO_QUERY,
    { variables: { id }, skip: !id },
  );

  if (loading) {
    return <StyledLoading>Loading program data...</StyledLoading>;
  }

  if (error) {
    return <StyledLoading>Error loading program: {error.message}</StyledLoading>;
  }

  const program = data?.opportunity;

  if (!program) {
    return <StyledLoading>Program not found</StyledLoading>;
  }

  const stageColors = STAGE_COLORS[program.stage || ''] || {
    bg: '#f3f4f6',
    text: '#4b5563',
  };

  const detailFields: DetailField[] = [
    { label: 'Stage', value: formatEnumValue(program.stage) },
    { label: 'Program Type', value: formatEnumValue(program.programType) },
    { label: 'Season / Year', value: formatEnumValue(program.seasonYear) },
    { label: 'Licensed', value: program.licensed ? 'Yes' : 'No' },
    { label: 'Sample Required', value: program.sampleRequired ? 'Yes' : 'No' },
    {
      label: 'Hard Delivery Date',
      value: formatDate(program.hardDeliveryDate),
    },
    {
      label: 'Production PO #',
      value: program.productionPoNumber || '-',
    },
    {
      label: 'Sales Order #',
      value: program.salesOrderNumber || '-',
    },
    {
      label: 'Import PO #',
      value: program.importPoNumber || '-',
    },
    {
      label: 'ClickUp Status',
      value: program.clickupStatus || '-',
    },
    {
      label: 'ClickUp Task ID',
      value: program.clickupTaskId || '-',
    },
    {
      label: 'Customer Incoterms',
      value: formatEnumValue(program.customerIncoterms),
    },
    {
      label: 'Factory Incoterms',
      value: formatEnumValue(program.factoryIncoterms),
    },
  ];

  const lats = program.licensorApprovalThreads.edges.map((e) => e.node);

  const emails = program.emailMessages.edges
    .map((e) => e.node)
    .sort((a, b) => {
      if (!a.receivedAt || !b.receivedAt) return 0;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    })
    .slice(0, 5);

  const meetingNotes = program.meetingNotes.edges
    .map((e) => e.node)
    .sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 5);

  return (
    <StyledContainer>
      <StyledSection>
        <StyledSectionTitle>
          Program Details
          {program.stage && (
            <>
              {' '}
              <StyledChip bgColor={stageColors.bg} textColor={stageColors.text}>
                {formatEnumValue(program.stage)}
              </StyledChip>
            </>
          )}
        </StyledSectionTitle>
        <StyledDetailsGrid>
          {detailFields.map((field) => (
            <StyledDetailRow key={field.label}>
              <StyledDetailLabel>{field.label}</StyledDetailLabel>
              <StyledDetailValue>{field.value}</StyledDetailValue>
            </StyledDetailRow>
          ))}
        </StyledDetailsGrid>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Company / Department / Factory</StyledSectionTitle>
        <StyledInfoRow>
          <StyledInfoLabel>Company</StyledInfoLabel>
          <StyledInfoValue>
            {program.company?.name || '-'}
          </StyledInfoValue>
        </StyledInfoRow>
        <StyledInfoRow>
          <StyledInfoLabel>Department</StyledInfoLabel>
          <StyledInfoValue>
            {program.department?.name || '-'}
          </StyledInfoValue>
        </StyledInfoRow>
        <StyledInfoRow>
          <StyledInfoLabel>Factory</StyledInfoLabel>
          <StyledInfoValue>
            {program.factory
              ? `${program.factory.name}${program.factory.location ? ` (${program.factory.location})` : ''}`
              : '-'}
          </StyledInfoValue>
        </StyledInfoRow>
      </StyledSection>

      {lats.length > 0 && (
        <StyledSection>
          <StyledSectionTitle>
            Licensor Approval Threads ({lats.length})
          </StyledSectionTitle>
          {lats.map((lat) => {
            const latColors = LAT_STAGE_COLORS[lat.stage || ''] || {
              bg: '#f3f4f6',
              text: '#4b5563',
            };
            return (
              <StyledLatRow key={lat.id}>
                <StyledLatInfo>
                  <StyledLatName>
                    {lat.propertyName || 'Untitled'}
                  </StyledLatName>
                  <StyledLatMeta>
                    Submitted: {formatDate(lat.submittedDate)}
                    {lat.dueDate ? ` | Due: ${formatDate(lat.dueDate)}` : ''}
                  </StyledLatMeta>
                </StyledLatInfo>
                {lat.stage && (
                  <StyledChip
                    bgColor={latColors.bg}
                    textColor={latColors.text}
                  >
                    {formatEnumValue(lat.stage)}
                  </StyledChip>
                )}
              </StyledLatRow>
            );
          })}
        </StyledSection>
      )}

      <StyledSection>
        <StyledSectionTitle>Recent Emails</StyledSectionTitle>
        {emails.length === 0 ? (
          <StyledEmpty>No emails linked to this program</StyledEmpty>
        ) : (
          emails.map((email) => (
            <StyledEmailRow key={email.id}>
              <StyledEmailSubject>
                {email.subject || '(No subject)'}
              </StyledEmailSubject>
              <StyledEmailMeta>
                {email.sender || 'Unknown sender'}
                {' — '}
                {formatDateTime(email.receivedAt)}
                {email.routingMethod
                  ? ` (${formatLabel(email.routingMethod)})`
                  : ''}
              </StyledEmailMeta>
            </StyledEmailRow>
          ))
        )}
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Recent Meeting Notes</StyledSectionTitle>
        {meetingNotes.length === 0 ? (
          <StyledEmpty>No meeting notes for this program</StyledEmpty>
        ) : (
          meetingNotes.map((note) => (
            <StyledMeetingRow key={note.id}>
              <StyledMeetingTitle>{note.name}</StyledMeetingTitle>
              <StyledMeetingMeta>
                {formatDate(note.date)}
                {note.participants ? ` — ${note.participants}` : ''}
              </StyledMeetingMeta>
            </StyledMeetingRow>
          ))
        )}
      </StyledSection>
    </StyledContainer>
  );
};
