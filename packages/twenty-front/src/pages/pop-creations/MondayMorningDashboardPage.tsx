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

/* oxlint-disable twenty/no-hardcoded-colors */
const PROGRAM_STAGE_COLORS: Record<string, string> = {
  DIRECTIVE_RECEIVED: '#3b82f6',
  DESIGN_IN_PROGRESS: '#a855f7',
  BUYER_REVIEW: '#14b8a6',
  PRICING_AND_SAMPLING: '#eab308',
  AWAITING_SALES_ORDER: '#f97316',
  IN_PRODUCTION: '#22c55e',
};
/* oxlint-enable twenty/no-hardcoded-colors */

const LAT_STAGE_LABELS: Record<string, string> = {
  CONCEPT_SUBMIT: 'Concept Submit',
  CONCEPT_REVISIONS: 'Concept Revisions',
  RESUBMIT: 'Resubmit',
  CONCEPT_APPROVED_WITH_COMMENTS: 'Approved w/ Comments',
  CONCEPT_APPROVED: 'Concept Approved',
  PPS_SUBMIT: 'PPS Submit',
};

// ---------------------------------------------------------------------------
// Status colors — semantic overdue/warning/fireflies indicators
// ---------------------------------------------------------------------------

// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_RED = '#ef4444';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_ORANGE = '#f97316';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_INDIGO = '#6366f1';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_RED_BG_CARD = 'rgba(239,68,68,0.07)';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_RED_BORDER_CARD = 'rgba(239,68,68,0.35)';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_RED_BG_TAG = 'rgba(239,68,68,0.1)';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_ORANGE_BG_TAG = 'rgba(249,115,22,0.1)';
// oxlint-disable-next-line twenty/no-hardcoded-colors
const STATUS_INDIGO_BG_TAG = 'rgba(99,102,241,0.1)';

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

const StyledPage = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[5]};
  margin: 0 auto;
  max-width: 1280px;
  padding: ${themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledPageTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 ${themeCssVariables.spacing[1]};
`;

const StyledPageSubtitle = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

// -- Stat cards row --

const StyledStatRow = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(4, 1fr);
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 500px) {
    grid-template-columns: 1fr;
  }
`;

const StyledStatCard = styled.div<{ urgent?: boolean }>`
  background: ${({ urgent }) =>
    urgent ? STATUS_RED_BG_CARD : themeCssVariables.background.primary};
  border: 1px solid
    ${({ urgent }) =>
      urgent ? STATUS_RED_BORDER_CARD : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledStatValue = styled.div<{ urgent?: boolean }>`
  color: ${({ urgent }) =>
    urgent ? STATUS_RED : themeCssVariables.font.color.primary};
  font-size: 2rem;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1;
`;

const StyledStatLabel = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

// -- Two-column layout --

const StyledTwoCol = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: 1fr 1fr;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

// -- Cards --

const StyledCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledCardHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledCardTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.04em;
  margin: 0;
  text-transform: uppercase;
`;

const StyledCardCount = styled.span`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.pill};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 1px 7px;
`;

const StyledCardBody = styled.div`
  flex: 1;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

// -- Stage pipeline bar --

const StyledPipelineGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const StyledStageRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  &:last-child {
    border-bottom: none;
  }
`;

const StyledStageDot = styled.span<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  width: 8px;
`;

const StyledStageName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledStageBar = styled.div<{ pct: number; color: string }>`
  background: ${({ color }) => color};
  border-radius: 3px;
  height: 6px;
  max-width: 40%;
  opacity: 0.7;
  transition: width 0.3s ease;
  width: ${({ pct }) => Math.max(pct, 2)}%;
`;

const StyledStageCount = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  min-width: 18px;
  text-align: right;
`;

// -- List rows --

const StyledListRow = styled.div`
  align-items: baseline;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  &:last-child {
    border-bottom: none;
  }
`;

const StyledRowMain = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowSub = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledTag = styled.span<{ color?: string; bg?: string }>`
  background: ${({ bg }) => bg ?? themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ color }) => color ?? themeCssVariables.font.color.secondary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 1px 5px;
  white-space: nowrap;
`;

const StyledEmptyRow = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]};
  text-align: center;
`;

const StyledLoadingWrap = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: ${themeCssVariables.spacing[12]};
`;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MondayMorningDashboardPage = () => {
  const { data, loading, error } = useQuery<DashboardData>(DASHBOARD_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  if (loading && !data) {
    return <StyledLoadingWrap>Loading…</StyledLoadingWrap>;
  }

  if (error && !data) {
    return (
      <StyledLoadingWrap style={{ color: 'red' }}>
        Error: {error.message}
      </StyledLoadingWrap>
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
    (p) => p.hardDeliveryDate != null && p.hardDeliveryDate < todayStr,
  );
  const overdueLATs = lats.filter(
    (l) => l.dueDate != null && l.dueDate < todayStr,
  );
  const overdueCount = overduePrograms.length + overdueLATs.length;

  // Tasks due this week
  const weekEnd = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tasksDueThisWeek = tasks.filter(
    (t) => t.dueAt != null && t.dueAt.slice(0, 10) <= weekEnd,
  );

  const nowStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <StyledPage>
      <div>
        <StyledPageTitle>Dashboard</StyledPageTitle>
        <StyledPageSubtitle>{nowStr}</StyledPageSubtitle>
      </div>

      {/* ── Stat cards ── */}
      <StyledStatRow>
        <StyledStatCard urgent={unroutedCount > 0}>
          <StyledStatValue urgent={unroutedCount > 0}>
            {unroutedCount}
          </StyledStatValue>
          <StyledStatLabel>Emails Needing Attention</StyledStatLabel>
        </StyledStatCard>
        <StyledStatCard>
          <StyledStatValue>{programs.length}</StyledStatValue>
          <StyledStatLabel>Active Programs</StyledStatLabel>
        </StyledStatCard>
        <StyledStatCard urgent={overdueCount > 0}>
          <StyledStatValue urgent={overdueCount > 0}>
            {overdueCount}
          </StyledStatValue>
          <StyledStatLabel>Overdue Items</StyledStatLabel>
        </StyledStatCard>
        <StyledStatCard urgent={tasksDueThisWeek.length > 0}>
          <StyledStatValue urgent={tasksDueThisWeek.length > 5}>
            {tasksDueThisWeek.length}
          </StyledStatValue>
          <StyledStatLabel>Tasks Due This Week</StyledStatLabel>
        </StyledStatCard>
      </StyledStatRow>

      {/* ── Pipeline + Overdue ── */}
      <StyledTwoCol>
        {/* Programs by stage */}
        <StyledCard>
          <StyledCardHeader>
            <StyledCardTitle>Programs by Stage</StyledCardTitle>
            <StyledCardCount>{programs.length} active</StyledCardCount>
          </StyledCardHeader>
          <StyledCardBody>
            {programs.length === 0 ? (
              <StyledEmptyRow>No active programs</StyledEmptyRow>
            ) : (
              <StyledPipelineGrid>
                {PROGRAM_STAGE_ORDER.map((stage) => {
                  const count = stageCounts[stage] ?? 0;
                  if (count === 0) return null;
                  return (
                    <StyledStageRow key={stage}>
                      <StyledStageDot color={PROGRAM_STAGE_COLORS[stage]} />
                      <StyledStageName>
                        {PROGRAM_STAGE_LABELS[stage]}
                      </StyledStageName>
                      <StyledStageBar
                        pct={(count / maxStageCount) * 100}
                        color={PROGRAM_STAGE_COLORS[stage]}
                      />
                      <StyledStageCount>{count}</StyledStageCount>
                    </StyledStageRow>
                  );
                })}
              </StyledPipelineGrid>
            )}
          </StyledCardBody>
        </StyledCard>

        {/* Overdue items */}
        <StyledCard>
          <StyledCardHeader>
            <StyledCardTitle>Overdue Items</StyledCardTitle>
            <StyledCardCount>{overdueCount}</StyledCardCount>
          </StyledCardHeader>
          <StyledCardBody>
            {overdueCount === 0 ? (
              <StyledEmptyRow>Nothing overdue ✓</StyledEmptyRow>
            ) : (
              <>
                {overduePrograms.map((p) => {
                  const days = daysUntil(p.hardDeliveryDate);
                  return (
                    <StyledListRow key={p.id}>
                      <StyledTag bg={STATUS_RED_BG_TAG} color={STATUS_RED}>
                        Program
                      </StyledTag>
                      <StyledRowMain>
                        {p.name}
                        {p.company ? ` · ${p.company.name}` : ''}
                      </StyledRowMain>
                      <StyledRowSub>
                        {days !== null ? `${Math.abs(days)}d overdue` : ''}
                      </StyledRowSub>
                    </StyledListRow>
                  );
                })}
                {overdueLATs.map((l) => {
                  const days = daysUntil(l.dueDate);
                  return (
                    <StyledListRow key={l.id}>
                      <StyledTag
                        bg={STATUS_ORANGE_BG_TAG}
                        color={STATUS_ORANGE}
                      >
                        LAT
                      </StyledTag>
                      <StyledRowMain>
                        {l.propertyName}
                        {l.program ? ` · ${l.program.name}` : ''}
                      </StyledRowMain>
                      <StyledRowSub>
                        {days !== null ? `${Math.abs(days)}d overdue` : ''}{' '}
                        {LAT_STAGE_LABELS[l.stage] ?? l.stage}
                      </StyledRowSub>
                    </StyledListRow>
                  );
                })}
              </>
            )}
          </StyledCardBody>
        </StyledCard>
      </StyledTwoCol>

      {/* ── Tasks + Meetings ── */}
      <StyledTwoCol>
        {/* Open tasks */}
        <StyledCard>
          <StyledCardHeader>
            <StyledCardTitle>Open Tasks</StyledCardTitle>
            <StyledCardCount>{tasks.length}</StyledCardCount>
          </StyledCardHeader>
          <StyledCardBody>
            {tasks.length === 0 ? (
              <StyledEmptyRow>No open tasks</StyledEmptyRow>
            ) : (
              tasks.map((t) => {
                const days = daysUntil(t.dueAt);
                const overdue = days !== null && days < 0;
                const soon = days !== null && days >= 0 && days <= 2;
                const assigneeName = t.assignee
                  ? `${t.assignee.name.firstName} ${t.assignee.name.lastName}`.trim()
                  : 'Unassigned';
                return (
                  <StyledListRow key={t.id}>
                    <StyledRowMain>{t.title}</StyledRowMain>
                    <StyledRowSub>{assigneeName}</StyledRowSub>
                    {t.dueAt != null && (
                      <StyledTag
                        bg={
                          overdue
                            ? STATUS_RED_BG_TAG
                            : soon
                              ? STATUS_ORANGE_BG_TAG
                              : themeCssVariables.background.tertiary
                        }
                        color={
                          overdue
                            ? STATUS_RED
                            : soon
                              ? STATUS_ORANGE
                              : themeCssVariables.font.color.secondary
                        }
                      >
                        {overdue
                          ? `${Math.abs(days!)}d overdue`
                          : days === 0
                            ? 'Today'
                            : formatDate(t.dueAt)}
                      </StyledTag>
                    )}
                  </StyledListRow>
                );
              })
            )}
          </StyledCardBody>
        </StyledCard>

        {/* Recent meeting notes */}
        <StyledCard>
          <StyledCardHeader>
            <StyledCardTitle>Recent Meeting Notes</StyledCardTitle>
            <StyledCardCount>{meetings.length}</StyledCardCount>
          </StyledCardHeader>
          <StyledCardBody>
            {meetings.length === 0 ? (
              <StyledEmptyRow>No recent meetings</StyledEmptyRow>
            ) : (
              meetings.map((m) => {
                const context = m.department?.name ?? m.company?.name ?? null;
                return (
                  <StyledListRow key={m.id}>
                    <StyledRowMain>{m.name || '(untitled)'}</StyledRowMain>
                    {context != null && <StyledRowSub>{context}</StyledRowSub>}
                    <StyledTag>{formatDate(m.date)}</StyledTag>
                    {m.source === 'FIREFLIES_AUTO_IMPORT' && (
                      <StyledTag
                        bg={STATUS_INDIGO_BG_TAG}
                        color={STATUS_INDIGO}
                      >
                        FF
                      </StyledTag>
                    )}
                  </StyledListRow>
                );
              })
            )}
          </StyledCardBody>
        </StyledCard>
      </StyledTwoCol>

      {/* ── All pending LATs ── */}
      <StyledCard>
        <StyledCardHeader>
          <StyledCardTitle>Pending Licensor Approvals</StyledCardTitle>
          <StyledCardCount>{lats.length}</StyledCardCount>
        </StyledCardHeader>
        <StyledCardBody>
          {lats.length === 0 ? (
            <StyledEmptyRow>No pending approvals ✓</StyledEmptyRow>
          ) : (
            lats.map((l) => {
              const days = daysUntil(l.dueDate);
              const overdue = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 3;
              return (
                <StyledListRow key={l.id}>
                  <StyledRowMain>
                    {l.propertyName}
                    {l.program ? ` · ${l.program.name}` : ''}
                  </StyledRowMain>
                  <StyledTag>{LAT_STAGE_LABELS[l.stage] ?? l.stage}</StyledTag>
                  {l.dueDate != null && (
                    <StyledTag
                      bg={
                        overdue
                          ? STATUS_RED_BG_TAG
                          : soon
                            ? STATUS_ORANGE_BG_TAG
                            : themeCssVariables.background.tertiary
                      }
                      color={
                        overdue
                          ? STATUS_RED
                          : soon
                            ? STATUS_ORANGE
                            : themeCssVariables.font.color.secondary
                      }
                    >
                      {overdue
                        ? `${Math.abs(days!)}d overdue`
                        : days === 0
                          ? 'Today'
                          : `Due ${formatDate(l.dueDate)}`}
                    </StyledTag>
                  )}
                </StyledListRow>
              );
            })
          )}
        </StyledCardBody>
      </StyledCard>
    </StyledPage>
  );
};
