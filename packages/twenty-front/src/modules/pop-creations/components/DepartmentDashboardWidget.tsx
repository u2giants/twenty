import { styled } from '@linaria/react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const DEPARTMENT_DASHBOARD_QUERY = gql`
  query DepartmentDashboard($id: ID!) {
    department(filter: { id: { eq: $id } }) {
      id
      name
      category
      people {
        edges {
          node {
            id
            name {
              firstName
              lastName
            }
            contactType
          }
        }
      }
      programs {
        edges {
          node {
            id
            name
            stage
            closeDate
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

/* oxlint-disable twenty/no-hardcoded-colors */
const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  DIRECTIVE_RECEIVED: { bg: '#dbeafe', text: '#1d4ed8' },
  DESIGN_IN_PROGRESS: { bg: '#ede9fe', text: '#7c3aed' },
  BUYER_REVIEW: { bg: '#cffafe', text: '#0e7490' },
  PRICING_AND_SAMPLING: { bg: '#fef3c7', text: '#b45309' },
  IN_PRODUCTION: { bg: '#d1fae5', text: '#047857' },
  SHIPPED: { bg: '#e0f2fe', text: '#0369a1' },
  // oxlint-disable-next-line twenty/no-hardcoded-colors
  CLOSED: { bg: '#f3f4f6', text: '#4b5563' },
};
/* oxlint-enable twenty/no-hardcoded-colors */

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
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledContactRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledContactName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledBadge = styled.span`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xxs};
  font-weight: ${themeCssVariables.font.weight.medium};
  letter-spacing: 0.5px;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[2]};
  text-transform: uppercase;
`;

const StyledStageGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledStageLabel = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.5px;
  margin-bottom: ${themeCssVariables.spacing[1]};
  text-transform: uppercase;
`;

const StyledChip = styled.span<{ bgColor: string; textColor: string }>`
  align-items: center;
  background: ${(props) => props.bgColor};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${(props) => props.textColor};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing[1]};
  margin-right: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const StyledMeetingRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  padding: ${themeCssVariables.spacing[2]} 0;

  &:last-child {
    border-bottom: none;
  }
`;

const StyledMeetingTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledMeetingMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledLoading = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  justify-content: center;
  padding: ${themeCssVariables.spacing[10]};
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} 0;
`;

type PersonNode = {
  id: string;
  name: { firstName: string; lastName: string };
  contactType: string | null;
};

type ProgramNode = {
  id: string;
  name: string;
  stage: string | null;
  closeDate: string | null;
};

type MeetingNoteNode = {
  id: string;
  name: string;
  date: string | null;
  participants: string | null;
};

type DepartmentData = {
  department: {
    id: string;
    name: string;
    category: string | null;
    people: { edges: Array<{ node: PersonNode }> };
    programs: { edges: Array<{ node: ProgramNode }> };
    meetingNotes: { edges: Array<{ node: MeetingNoteNode }> };
  } | null;
};

function formatStageLabel(stage: string): string {
  return stage
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
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

export const DepartmentDashboardWidget = () => {
  const { id } = useTargetRecord();

  const { data, loading, error } = useQuery<DepartmentData>(
    DEPARTMENT_DASHBOARD_QUERY,
    { variables: { id }, skip: !id },
  );

  if (loading) {
    return <StyledLoading>Loading department data...</StyledLoading>;
  }

  if (error) {
    return (
      <StyledLoading>Error loading department: {error.message}</StyledLoading>
    );
  }

  const department = data?.department;

  if (!department) {
    return <StyledLoading>Department not found</StyledLoading>;
  }

  const people = department.people.edges.map((e) => e.node);
  const programs = department.programs.edges.map((e) => e.node);
  const meetingNotes = department.meetingNotes.edges
    .map((e) => e.node)
    .sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 5);

  // Group programs by stage
  const programsByStage = programs.reduce<Record<string, ProgramNode[]>>(
    (acc, program) => {
      const stage = program.stage || 'UNKNOWN';
      if (acc[stage] === undefined) acc[stage] = [];
      acc[stage].push(program);
      return acc;
    },
    {},
  );

  // Order stages by pipeline position
  const stageOrder = [
    'DIRECTIVE_RECEIVED',
    'DESIGN_IN_PROGRESS',
    'BUYER_REVIEW',
    'PRICING_AND_SAMPLING',
    'IN_PRODUCTION',
    'SHIPPED',
    'CLOSED',
  ];

  const orderedStages = stageOrder.filter(
    (s) => programsByStage[s] !== undefined,
  );
  const extraStages = Object.keys(programsByStage).filter(
    (s) => !stageOrder.includes(s),
  );
  const allStages = [...orderedStages, ...extraStages];

  return (
    <StyledContainer>
      <StyledSection>
        <StyledSectionTitle>Contacts ({people.length})</StyledSectionTitle>
        {people.length === 0 ? (
          <StyledEmpty>No contacts linked to this department</StyledEmpty>
        ) : (
          people.map((person) => (
            <StyledContactRow key={person.id}>
              <StyledContactName>
                {person.name.firstName} {person.name.lastName}
              </StyledContactName>
              {person.contactType && (
                <StyledBadge>
                  {person.contactType.replace(/_/g, ' ')}
                </StyledBadge>
              )}
            </StyledContactRow>
          ))
        )}
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>
          Programs by Stage ({programs.length})
        </StyledSectionTitle>
        {programs.length === 0 ? (
          <StyledEmpty>No programs linked to this department</StyledEmpty>
        ) : (
          allStages.map((stage) => {
            // oxlint-disable-next-line twenty/no-hardcoded-colors
            const defaultColors = { bg: '#f3f4f6', text: '#4b5563' };
            const colors = STAGE_COLORS[stage] ?? defaultColors;
            return (
              <StyledStageGroup key={stage}>
                <StyledStageLabel>{formatStageLabel(stage)}</StyledStageLabel>
                <StyledChipRow>
                  {programsByStage[stage].map((program) => (
                    <StyledChip
                      key={program.id}
                      bgColor={colors.bg}
                      textColor={colors.text}
                    >
                      {program.name}
                    </StyledChip>
                  ))}
                </StyledChipRow>
              </StyledStageGroup>
            );
          })
        )}
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Recent Meeting Notes</StyledSectionTitle>
        {meetingNotes.length === 0 ? (
          <StyledEmpty>No meeting notes for this department</StyledEmpty>
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
