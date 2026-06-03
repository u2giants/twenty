import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const DASHBOARD_QUERY = gql`
  query POPDashboard {
    activePrograms: opportunities(
      filter: { stage: { notIn: ["CLOSED", "SHIPPED"] } }
      first: 100
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
    pendingLATs: licensorApprovalThreads(
      filter: { stage: { notIn: ["PPS_APPROVED", "APPROVED", "REJECTED"] } }
      first: 100
      orderBy: { dueDate: AscNullsLast }
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
    openTasks: tasks(
      filter: { status: { eq: "TODO" } }
      first: 20
      orderBy: { dueAt: AscNullsLast }
    ) {
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
    recentMeetings: meetingNotes(first: 10, orderBy: { date: DescNullsLast }) {
      edges {
        node {
          id
          name
          date
          source
          company {
            name
          }
          department {
            name
          }
        }
      }
    }
    unroutedEmails: emailMessages(
      filter: { routingStatus: { eq: "UNROUTED" } }
    ) {
      totalCount
    }
    needsReviewEmails: emailMessages(
      filter: {
        routingStatus: { in: ["UNROUTED", "CUSTOMER_EMAIL_NO_COMPANY"] }
      }
    ) {
      totalCount
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProgramNode = {
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

type MeetingNode = {
  id: string;
  name: string;
  date: string | null;
  source: string | null;
  company: { name: string } | null;
  department: { name: string } | null;
};

type DashboardData = {
  activePrograms: { edges: { node: ProgramNode }[] };
  pendingLATs: { edges: { node: LATNode }[] };
  openTasks: { edges: { node: TaskNode }[] };
  recentMeetings: { edges: { node: MeetingNode }[] };
  unroutedEmails: { totalCount: number };
  needsReviewEmails: { totalCount: number };
};

// ---------------------------------------------------------------------------
// Stage config — mirrors the field-metadata options
// ---------------------------------------------------------------------------

const PROGRAM_STAGE_ORDER = [
  'DIRECTIVE_RECEIVED',
  'DESIGN_IN_PROGRESS',
  'BUYER_REVIEW',
  'PRICING_AND_SAMPLING',
  'AWAITING_SALES_ORDER',
  'IN_PRODUCTION',
];

const PROGRAM_STAGE_LABELS: Record<string, string> = {
  DIRECTIVE_RECEIVED: 'Directive Received',
  DESIGN_IN_PROGRESS: 'Design in Progress',
  BUYER_REVIEW: 'Buyer Review',
  PRICING_AND_SAMPLING: 'Pricing & Sampling',
  AWAITING_SALES_ORDER: 'Awaiting Sales Order',
  IN_PRODUCTION: 'In Production',
};

const PROGRAM_STAGE_COLORS: Record<string, string> = {
  DIRECTIVE_RECEIVED: '#3b82f6', // blue
  DESIGN_IN_PROGRESS: '#a855f7', // purple
  BUYER_REVIEW: '#14b8a6', // teal
  PRICING_AND_SAMPLING: '#eab308', // yellow
  AWAITING_SALES_ORDER: '#f97316', // orange
  IN_PRODUCTION: '#22c55e', // green
};

const LAT_STAGE_LABELS: Record<string, string> = {
  CONCEPT_SUBMIT: 'Concept Submit',
  CONCEPT_REVISIONS: 'Concept Revisions',
  RESUBMIT: 'Resubmit',
  CONCEPT_APPROVED_WITH_COMMENTS: 'Approved w/ Comments',
  CONCEPT_APPROVED: 'Concept Approved',
  PPS_SUBMIT: 'PPS Submit',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000);
};

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[5]};
  padding: ${themeCssVariables.spacing[8]};
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
`;

const PageTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 ${themeCssVariables.spacing[1]};
`;

const PageSubtitle = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

// -- Stat cards row --

const StatRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${themeCssVariables.spacing[4]};
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 500px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div<{ urgent?: boolean }>`
  background: ${({ urgent }) =>
    urgent ? 'rgba(239,68,68,0.07)' : themeCssVariables.background.primary};
  border: 1px solid
    ${({ urgent }) =>
      urgent ? 'rgba(239,68,68,0.35)' : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StatValue = styled.div<{ urgent?: boolean }>`
  font-size: 2rem;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${({ urgent }) =>
    urgent ? '#ef4444' : themeCssVariables.font.color.primary};
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

// -- Two-column layout --

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${themeCssVariables.spacing[4]};
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

// -- Cards --

const Card = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardTitle = styled.h2`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const CardCount = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.pill};
  padding: 1px 7px;
`;

const CardBody = styled.div`
  padding: ${themeCssVariables.spacing[2]} 0;
  flex: 1;
`;

// -- Stage pipeline bar --

const PipelineGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const StageRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  &:last-child {
    border-bottom: none;
  }
`;

const StageDot = styled.span<{ color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ color }) => color};
  flex-shrink: 0;
`;

const StageName = styled.span`
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StageBar = styled.div<{ pct: number; color: string }>`
  width: ${({ pct }) => Math.max(pct, 2)}%;
  max-width: 40%;
  height: 6px;
  border-radius: 3px;
  background: ${({ color }) => color};
  opacity: 0.7;
  transition: width 0.3s ease;
`;

const StageCount = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.secondary};
  min-width: 18px;
  text-align: right;
`;

// -- List rows --

const ListRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  &:last-child {
    border-bottom: none;
  }
`;

const RowMain = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const RowSub = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
`;

const Tag = styled.span<{ color?: string; bg?: string }>`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${({ color }) => color ?? themeCssVariables.font.color.secondary};
  background: ${({ bg }) => bg ?? themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: 1px 5px;
  flex-shrink: 0;
  white-space: nowrap;
`;

const EmptyRow = styled.div`
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
`;

const LoadingWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[12]};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
`;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MondayMorningDashboardPage = () => {
  const { data, loading, error } = useQuery<DashboardData>(DASHBOARD_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  if (loading && !data) {
    return <LoadingWrap>Loading…</LoadingWrap>;
  }

  if (error && !data) {
    return (
      <LoadingWrap style={{ color: 'red' }}>Error: {error.message}</LoadingWrap>
    );
  }

  const programs = data?.activePrograms.edges.map((e) => e.node) ?? [];
  const lats = data?.pendingLATs.edges.map((e) => e.node) ?? [];
  const tasks = data?.openTasks.edges.map((e) => e.node) ?? [];
  const meetings = data?.recentMeetings.edges.map((e) => e.node) ?? [];
  const unroutedCount = data?.needsReviewEmails.totalCount ?? 0;

  // Programs by stage counts
  const stageCounts: Record<string, number> = {};
  for (const p of programs) {
    stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  }
  const maxStageCount = Math.max(1, ...Object.values(stageCounts));

  // Overdue items: programs past delivery date + LATs with due date passed
  const todayStr = today();
  const overduePrograms = programs.filter(
    (p) => p.hardDeliveryDate && p.hardDeliveryDate < todayStr,
  );
  const overdueLATs = lats.filter((l) => l.dueDate && l.dueDate < todayStr);
  const overdueCount = overduePrograms.length + overdueLATs.length;

  // Tasks due this week
  const weekEnd = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tasksDueThisWeek = tasks.filter(
    (t) => t.dueAt && t.dueAt.slice(0, 10) <= weekEnd,
  );

  const nowStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Page>
      <div>
        <PageTitle>Dashboard</PageTitle>
        <PageSubtitle>{nowStr}</PageSubtitle>
      </div>

      {/* ── Stat cards ── */}
      <StatRow>
        <StatCard urgent={unroutedCount > 0}>
          <StatValue urgent={unroutedCount > 0}>{unroutedCount}</StatValue>
          <StatLabel>Emails Needing Attention</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{programs.length}</StatValue>
          <StatLabel>Active Programs</StatLabel>
        </StatCard>
        <StatCard urgent={overdueCount > 0}>
          <StatValue urgent={overdueCount > 0}>{overdueCount}</StatValue>
          <StatLabel>Overdue Items</StatLabel>
        </StatCard>
        <StatCard urgent={tasksDueThisWeek.length > 0}>
          <StatValue urgent={tasksDueThisWeek.length > 5}>
            {tasksDueThisWeek.length}
          </StatValue>
          <StatLabel>Tasks Due This Week</StatLabel>
        </StatCard>
      </StatRow>

      {/* ── Pipeline + Overdue ── */}
      <TwoCol>
        {/* Programs by stage */}
        <Card>
          <CardHeader>
            <CardTitle>Programs by Stage</CardTitle>
            <CardCount>{programs.length} active</CardCount>
          </CardHeader>
          <CardBody>
            {programs.length === 0 ? (
              <EmptyRow>No active programs</EmptyRow>
            ) : (
              <PipelineGrid>
                {PROGRAM_STAGE_ORDER.map((stage) => {
                  const count = stageCounts[stage] ?? 0;
                  if (count === 0) return null;
                  return (
                    <StageRow key={stage}>
                      <StageDot color={PROGRAM_STAGE_COLORS[stage]} />
                      <StageName>{PROGRAM_STAGE_LABELS[stage]}</StageName>
                      <StageBar
                        pct={(count / maxStageCount) * 100}
                        color={PROGRAM_STAGE_COLORS[stage]}
                      />
                      <StageCount>{count}</StageCount>
                    </StageRow>
                  );
                })}
              </PipelineGrid>
            )}
          </CardBody>
        </Card>

        {/* Overdue items */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Items</CardTitle>
            <CardCount>{overdueCount}</CardCount>
          </CardHeader>
          <CardBody>
            {overdueCount === 0 ? (
              <EmptyRow>Nothing overdue ✓</EmptyRow>
            ) : (
              <>
                {overduePrograms.map((p) => {
                  const days = daysUntil(p.hardDeliveryDate);
                  return (
                    <ListRow key={p.id}>
                      <Tag bg="rgba(239,68,68,0.1)" color="#ef4444">
                        Program
                      </Tag>
                      <RowMain>
                        {p.name}
                        {p.company ? ` · ${p.company.name}` : ''}
                      </RowMain>
                      <RowSub>
                        {days !== null ? `${Math.abs(days)}d overdue` : ''}
                      </RowSub>
                    </ListRow>
                  );
                })}
                {overdueLATs.map((l) => {
                  const days = daysUntil(l.dueDate);
                  return (
                    <ListRow key={l.id}>
                      <Tag bg="rgba(249,115,22,0.1)" color="#f97316">
                        LAT
                      </Tag>
                      <RowMain>
                        {l.propertyName}
                        {l.program ? ` · ${l.program.name}` : ''}
                      </RowMain>
                      <RowSub>
                        {days !== null ? `${Math.abs(days)}d overdue` : ''}{' '}
                        {LAT_STAGE_LABELS[l.stage] ?? l.stage}
                      </RowSub>
                    </ListRow>
                  );
                })}
              </>
            )}
          </CardBody>
        </Card>
      </TwoCol>

      {/* ── Tasks + Meetings ── */}
      <TwoCol>
        {/* Open tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Open Tasks</CardTitle>
            <CardCount>{tasks.length}</CardCount>
          </CardHeader>
          <CardBody>
            {tasks.length === 0 ? (
              <EmptyRow>No open tasks</EmptyRow>
            ) : (
              tasks.map((t) => {
                const days = daysUntil(t.dueAt);
                const overdue = days !== null && days < 0;
                const soon = days !== null && days >= 0 && days <= 2;
                const assigneeName = t.assignee
                  ? `${t.assignee.name.firstName} ${t.assignee.name.lastName}`.trim()
                  : 'Unassigned';
                return (
                  <ListRow key={t.id}>
                    <RowMain>{t.title}</RowMain>
                    <RowSub>{assigneeName}</RowSub>
                    {t.dueAt && (
                      <Tag
                        bg={
                          overdue
                            ? 'rgba(239,68,68,0.1)'
                            : soon
                              ? 'rgba(249,115,22,0.1)'
                              : themeCssVariables.background.tertiary
                        }
                        color={
                          overdue
                            ? '#ef4444'
                            : soon
                              ? '#f97316'
                              : themeCssVariables.font.color.secondary
                        }
                      >
                        {overdue
                          ? `${Math.abs(days!)}d overdue`
                          : days === 0
                            ? 'Today'
                            : formatDate(t.dueAt)}
                      </Tag>
                    )}
                  </ListRow>
                );
              })
            )}
          </CardBody>
        </Card>

        {/* Recent meeting notes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Meeting Notes</CardTitle>
            <CardCount>{meetings.length}</CardCount>
          </CardHeader>
          <CardBody>
            {meetings.length === 0 ? (
              <EmptyRow>No recent meetings</EmptyRow>
            ) : (
              meetings.map((m) => {
                const context = m.department?.name ?? m.company?.name ?? null;
                return (
                  <ListRow key={m.id}>
                    <RowMain>{m.name || '(untitled)'}</RowMain>
                    {context && <RowSub>{context}</RowSub>}
                    <Tag>{formatDate(m.date)}</Tag>
                    {m.source === 'FIREFLIES_AUTO_IMPORT' && (
                      <Tag bg="rgba(99,102,241,0.1)" color="#6366f1">
                        FF
                      </Tag>
                    )}
                  </ListRow>
                );
              })
            )}
          </CardBody>
        </Card>
      </TwoCol>

      {/* ── All pending LATs ── */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Licensor Approvals</CardTitle>
          <CardCount>{lats.length}</CardCount>
        </CardHeader>
        <CardBody>
          {lats.length === 0 ? (
            <EmptyRow>No pending approvals ✓</EmptyRow>
          ) : (
            lats.map((l) => {
              const days = daysUntil(l.dueDate);
              const overdue = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 3;
              return (
                <ListRow key={l.id}>
                  <RowMain>
                    {l.propertyName}
                    {l.program ? ` · ${l.program.name}` : ''}
                  </RowMain>
                  <Tag>{LAT_STAGE_LABELS[l.stage] ?? l.stage}</Tag>
                  {l.dueDate && (
                    <Tag
                      bg={
                        overdue
                          ? 'rgba(239,68,68,0.1)'
                          : soon
                            ? 'rgba(249,115,22,0.1)'
                            : themeCssVariables.background.tertiary
                      }
                      color={
                        overdue
                          ? '#ef4444'
                          : soon
                            ? '#f97316'
                            : themeCssVariables.font.color.secondary
                      }
                    >
                      {overdue
                        ? `${Math.abs(days!)}d overdue`
                        : days === 0
                          ? 'Today'
                          : `Due ${formatDate(l.dueDate)}`}
                    </Tag>
                  )}
                </ListRow>
              );
            })
          )}
        </CardBody>
      </Card>
    </Page>
  );
};
