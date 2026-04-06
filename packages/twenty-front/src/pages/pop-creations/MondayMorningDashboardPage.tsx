import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const MONDAY_DASHBOARD_QUERY = gql`
  query MondayDashboard {
    opportunities(
      filter: { stage: { notIn: ["CLOSED", "SHIPPED"] } }
      first: 20
      orderBy: { hardDeliveryDate: AscNullsLast }
    ) {
      edges {
        node {
          id
          name
          stage
          hardDeliveryDate
          company {
            name
          }
        }
      }
    }
    licensorApprovalThreads(
      filter: { stage: { notIn: ["APPROVED", "REJECTED"] } }
      first: 10
    ) {
      edges {
        node {
          id
          propertyName
          stage
          dueDate
          program {
            name
          }
        }
      }
    }
    tasks(filter: { status: { eq: "TODO" } }, first: 10) {
      edges {
        node {
          id
          title
          dueAt
          assignee {
            name {
              firstName
              lastName
            }
          }
        }
      }
    }
    meetingNotes(first: 5, orderBy: { date: DescNullsLast }) {
      edges {
        node {
          id
          name
          date
          participants
          source
        }
      }
    }
    emailMessages(filter: { routingStatus: { eq: "UNROUTED" } }) {
      totalCount
    }
  }
`;

type OpportunityNode = {
  id: string;
  name: string;
  stage: string;
  hardDeliveryDate: string | null;
  company: { name: string } | null;
};

type LATNode = {
  id: string;
  propertyName: string;
  stage: string;
  dueDate: string | null;
  program: { name: string } | null;
};

type TaskNode = {
  id: string;
  title: string;
  dueAt: string | null;
  assignee: { name: { firstName: string; lastName: string } } | null;
};

type MeetingNoteNode = {
  id: string;
  name: string;
  date: string | null;
  participants: string | null;
  source: string | null;
};

type MondayDashboardData = {
  opportunities: { edges: { node: OpportunityNode }[] };
  licensorApprovalThreads: { edges: { node: LATNode }[] };
  tasks: { edges: { node: TaskNode }[] };
  meetingNotes: { edges: { node: MeetingNoteNode }[] };
  emailMessages: { totalCount: number };
};

const StyledPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  padding: ${themeCssVariables.spacing[8]};
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
`;

const StyledPageTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${themeCssVariables.spacing[4]};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCard = styled.div`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledCardHeading = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledBadge = styled.span`
  background-color: ${themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};
  border-radius: ${themeCssVariables.border.radius.pill};
  padding: 2px 8px;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledItemName = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
`;

const StyledItemMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  flex-shrink: 0;
  margin-left: ${themeCssVariables.spacing[2]};
`;

const StyledStageBadge = styled.span`
  background-color: ${themeCssVariables.background.tertiary};
  color: ${themeCssVariables.font.color.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: 1px 6px;
  font-size: ${themeCssVariables.font.size.xs};
  flex-shrink: 0;
  margin-left: ${themeCssVariables.spacing[2]};
`;

const StyledOverdueBadge = styled.span`
  background-color: ${themeCssVariables.color.red};
  color: ${themeCssVariables.font.color.inverted};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: 1px 6px;
  font-size: ${themeCssVariables.font.size.xs};
  flex-shrink: 0;
  margin-left: ${themeCssVariables.spacing[1]};
`;

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]};
  text-align: center;
`;

const StyledUnroutedCard = styled.div`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledUnroutedCount = styled.span`
  font-size: ${themeCssVariables.font.size.xxl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.color.orange};
`;

const StyledLoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[10]};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[10]};
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.md};
`;

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const isOverdue = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

const formatStageName = (stage: string): string => {
  return stage
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const MondayMorningDashboardPage = () => {
  const { data, loading, error } = useQuery<MondayDashboardData>(
    MONDAY_DASHBOARD_QUERY,
    { fetchPolicy: 'cache-and-network' },
  );

  if (loading && !data) {
    return (
      <StyledPageContainer>
        <StyledLoadingContainer>Loading dashboard...</StyledLoadingContainer>
      </StyledPageContainer>
    );
  }

  if (error && !data) {
    return (
      <StyledPageContainer>
        <StyledErrorContainer>
          Failed to load dashboard: {error.message}
        </StyledErrorContainer>
      </StyledPageContainer>
    );
  }

  const opportunities = data?.opportunities.edges.map((e) => e.node) ?? [];
  const lats = data?.licensorApprovalThreads.edges.map((e) => e.node) ?? [];
  const tasks = data?.tasks.edges.map((e) => e.node) ?? [];
  const meetingNotes = data?.meetingNotes.edges.map((e) => e.node) ?? [];
  const unroutedCount = data?.emailMessages.totalCount ?? 0;

  const today = new Date().toISOString().slice(0, 10);
  const overdueLATs = lats.filter(
    (lat) => lat.dueDate && lat.dueDate < today,
  );

  return (
    <StyledPageContainer>
      <StyledPageTitle>Monday Morning Dashboard</StyledPageTitle>

      <StyledUnroutedCard>
        <StyledCardHeading>Unrouted Emails</StyledCardHeading>
        <StyledUnroutedCount>{unroutedCount}</StyledUnroutedCount>
      </StyledUnroutedCard>

      <StyledGrid>
        <StyledCard>
          <StyledCardHeading>
            Programs Needing Attention
            <StyledBadge>{opportunities.length}</StyledBadge>
          </StyledCardHeading>
          {opportunities.length === 0 ? (
            <StyledEmptyState>No active programs</StyledEmptyState>
          ) : (
            <StyledList>
              {opportunities.map((opp) => (
                <StyledListItem key={opp.id}>
                  <StyledItemName>
                    {opp.name}
                    {opp.company?.name ? ` — ${opp.company.name}` : ''}
                  </StyledItemName>
                  <StyledStageBadge>{formatStageName(opp.stage)}</StyledStageBadge>
                  <StyledItemMeta>
                    {formatDate(opp.hardDeliveryDate)}
                    {isOverdue(opp.hardDeliveryDate) && (
                      <StyledOverdueBadge>Overdue</StyledOverdueBadge>
                    )}
                  </StyledItemMeta>
                </StyledListItem>
              ))}
            </StyledList>
          )}
        </StyledCard>

        <StyledCard>
          <StyledCardHeading>
            Overdue Licensor Approvals
            <StyledBadge>{overdueLATs.length}</StyledBadge>
          </StyledCardHeading>
          {overdueLATs.length === 0 ? (
            <StyledEmptyState>No overdue approvals</StyledEmptyState>
          ) : (
            <StyledList>
              {overdueLATs.map((lat) => (
                <StyledListItem key={lat.id}>
                  <StyledItemName>
                    {lat.propertyName}
                    {lat.program?.name ? ` — ${lat.program.name}` : ''}
                  </StyledItemName>
                  <StyledStageBadge>{formatStageName(lat.stage)}</StyledStageBadge>
                  <StyledItemMeta>
                    Due {formatDate(lat.dueDate)}
                  </StyledItemMeta>
                </StyledListItem>
              ))}
            </StyledList>
          )}
        </StyledCard>

        <StyledCard>
          <StyledCardHeading>
            Open Tasks
            <StyledBadge>{tasks.length}</StyledBadge>
          </StyledCardHeading>
          {tasks.length === 0 ? (
            <StyledEmptyState>No open tasks</StyledEmptyState>
          ) : (
            <StyledList>
              {tasks.map((task) => (
                <StyledListItem key={task.id}>
                  <StyledItemName>{task.title}</StyledItemName>
                  <StyledItemMeta>
                    {task.assignee
                      ? `${task.assignee.name.firstName} ${task.assignee.name.lastName}`
                      : 'Unassigned'}
                    {task.dueAt ? ` | ${formatDate(task.dueAt)}` : ''}
                  </StyledItemMeta>
                </StyledListItem>
              ))}
            </StyledList>
          )}
        </StyledCard>

        <StyledCard>
          <StyledCardHeading>Recent Meeting Notes</StyledCardHeading>
          {meetingNotes.length === 0 ? (
            <StyledEmptyState>No recent meetings</StyledEmptyState>
          ) : (
            <StyledList>
              {meetingNotes.map((note) => (
                <StyledListItem key={note.id}>
                  <StyledItemName>{note.name}</StyledItemName>
                  <StyledItemMeta>
                    {formatDate(note.date)}
                    {note.source === 'FIREFLIES_AUTO_IMPORT' ? ' (Fireflies)' : ''}
                  </StyledItemMeta>
                </StyledListItem>
              ))}
            </StyledList>
          )}
        </StyledCard>
      </StyledGrid>
    </StyledPageContainer>
  );
};
