import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMemo, useState } from 'react';

const EMAIL_DOMAINS_QUERY = gql`
  query EmailDomains {
    emailMessages(first: 500) {
      edges {
        node {
          sender
          recipients
          companyId
          company {
            id
            name
            customerStatus
          }
        }
      }
    }
  }
`;

const ALL_COMPANIES_QUERY = gql`
  query AllCompanies {
    companies(first: 500) {
      edges {
        node {
          id
          name
          customerStatus
          domainName {
            primaryLinkUrl
          }
        }
      }
    }
  }
`;

type EmailMessageNode = {
  sender: string | null;
  recipients: string | null;
  companyId: string | null;
  company: {
    id: string;
    name: string;
    customerStatus: string | null;
  } | null;
};

type CompanyNode = {
  id: string;
  name: string;
  customerStatus: string | null;
  domainName: { primaryLinkUrl: string | null } | null;
};

type DomainEntry = {
  domain: string;
  emailCount: number;
  company: { id: string; name: string; customerStatus: string | null } | null;
};

const StyledPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  padding: ${themeCssVariables.spacing[8]};
  max-width: 1100px;
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

const StyledDescription = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledSearchContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  align-items: center;
`;

const StyledSearchInput = styled.input`
  flex: 1;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledFilterSelect = styled.select`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
`;

const StyledTableHeader = styled.thead`
  background-color: ${themeCssVariables.background.secondary};
`;

const StyledTh = styled.th`
  text-align: left;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  white-space: nowrap;
`;

const StyledTd = styled.td`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  vertical-align: middle;
`;

const StyledTr = styled.tr`
  &:last-child td {
    border-bottom: none;
  }

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledStatusBadge = styled.span<{ status: string | null }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${themeCssVariables.border.radius.pill};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  background-color: ${({ status }) => {
    switch (status) {
      case 'ACTIVE_CUSTOMER':
        return themeCssVariables.color.green;
      case 'POTENTIAL_CUSTOMER':
        return themeCssVariables.color.blue;
      default:
        return themeCssVariables.background.tertiary;
    }
  }};
  color: ${({ status }) => {
    switch (status) {
      case 'ACTIVE_CUSTOMER':
      case 'POTENTIAL_CUSTOMER':
        return themeCssVariables.font.color.inverted;
      default:
        return themeCssVariables.font.color.tertiary;
    }
  }};
`;

const StyledCompanySelect = styled.select`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xs};
  cursor: pointer;
  max-width: 200px;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
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

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
`;

const StyledSummary = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[6]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledSummaryItem = styled.span`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  align-items: center;
`;

const StyledSummaryCount = styled.span`
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const extractDomain = (email: string | null): string | null => {
  if (!email) return null;
  const match = email.trim().match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
};

const extractAllDomains = (
  emails: EmailMessageNode[],
): Map<string, DomainEntry> => {
  const domainMap = new Map<string, DomainEntry>();

  for (const email of emails) {
    const allAddresses: string[] = [];

    if (email.sender) {
      allAddresses.push(email.sender);
    }
    if (email.recipients) {
      allAddresses.push(
        ...email.recipients.split(',').map((r) => r.trim()),
      );
    }

    for (const addr of allAddresses) {
      const domain = extractDomain(addr);
      if (!domain) continue;

      const existing = domainMap.get(domain);
      if (existing) {
        existing.emailCount += 1;
        if (!existing.company && email.company) {
          existing.company = email.company;
        }
      } else {
        domainMap.set(domain, {
          domain,
          emailCount: 1,
          company: email.company ?? null,
        });
      }
    }
  }

  return domainMap;
};

const formatCustomerStatus = (status: string | null): string => {
  if (!status) return '--';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

type FilterMode = 'all' | 'linked' | 'unlinked';

export const DomainManagerPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const {
    data: emailData,
    loading: emailsLoading,
    error: emailsError,
  } = useQuery(EMAIL_DOMAINS_QUERY, { fetchPolicy: 'cache-and-network' });

  const {
    data: companiesData,
    loading: companiesLoading,
    error: companiesError,
  } = useQuery(ALL_COMPANIES_QUERY, { fetchPolicy: 'cache-and-network' });

  const domainEntries = useMemo(() => {
    if (!emailData?.emailMessages?.edges) return [];
    const emails = emailData.emailMessages.edges.map(
      (e: { node: EmailMessageNode }) => e.node,
    );
    const domainMap = extractAllDomains(emails);
    return Array.from(domainMap.values()).sort(
      (a, b) => b.emailCount - a.emailCount,
    );
  }, [emailData]);

  const companies: CompanyNode[] = useMemo(() => {
    if (!companiesData?.companies?.edges) return [];
    return companiesData.companies.edges
      .map((e: { node: CompanyNode }) => e.node)
      .sort((a: CompanyNode, b: CompanyNode) => a.name.localeCompare(b.name));
  }, [companiesData]);

  const filteredDomains = useMemo(() => {
    let result = domainEntries;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.domain.includes(query) ||
          (entry.company?.name ?? '').toLowerCase().includes(query),
      );
    }

    if (filterMode === 'linked') {
      result = result.filter((entry) => entry.company !== null);
    } else if (filterMode === 'unlinked') {
      result = result.filter((entry) => entry.company === null);
    }

    return result;
  }, [domainEntries, searchQuery, filterMode]);

  const linkedCount = domainEntries.filter((e) => e.company !== null).length;
  const unlinkedCount = domainEntries.filter((e) => e.company === null).length;

  const loading = emailsLoading || companiesLoading;
  const error = emailsError || companiesError;

  if (loading && domainEntries.length === 0) {
    return (
      <StyledPageContainer>
        <StyledLoadingContainer>
          Loading domain data...
        </StyledLoadingContainer>
      </StyledPageContainer>
    );
  }

  if (error && domainEntries.length === 0) {
    return (
      <StyledPageContainer>
        <StyledErrorContainer>
          Failed to load data: {error.message}
        </StyledErrorContainer>
      </StyledPageContainer>
    );
  }

  return (
    <StyledPageContainer>
      <StyledPageTitle>Domain Manager</StyledPageTitle>
      <StyledDescription>
        Manage email domain to company mappings. Link unrecognized domains to
        companies to improve email routing accuracy.
      </StyledDescription>

      <StyledSummary>
        <StyledSummaryItem>
          Total domains: <StyledSummaryCount>{domainEntries.length}</StyledSummaryCount>
        </StyledSummaryItem>
        <StyledSummaryItem>
          Linked: <StyledSummaryCount>{linkedCount}</StyledSummaryCount>
        </StyledSummaryItem>
        <StyledSummaryItem>
          Unlinked: <StyledSummaryCount>{unlinkedCount}</StyledSummaryCount>
        </StyledSummaryItem>
      </StyledSummary>

      <StyledSearchContainer>
        <StyledSearchInput
          type="text"
          placeholder="Search by domain or company name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <StyledFilterSelect
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
        >
          <option value="all">All domains</option>
          <option value="linked">Linked only</option>
          <option value="unlinked">Unlinked only</option>
        </StyledFilterSelect>
      </StyledSearchContainer>

      {filteredDomains.length === 0 ? (
        <StyledEmptyState>
          {searchQuery || filterMode !== 'all'
            ? 'No domains match the current filters.'
            : 'No email domains found.'}
        </StyledEmptyState>
      ) : (
        <StyledTable>
          <StyledTableHeader>
            <tr>
              <StyledTh>Domain</StyledTh>
              <StyledTh>Email Count</StyledTh>
              <StyledTh>Company</StyledTh>
              <StyledTh>Customer Status</StyledTh>
            </tr>
          </StyledTableHeader>
          <tbody>
            {filteredDomains.map((entry) => (
              <StyledTr key={entry.domain}>
                <StyledTd>{entry.domain}</StyledTd>
                <StyledTd>{entry.emailCount}</StyledTd>
                <StyledTd>
                  {entry.company ? (
                    entry.company.name
                  ) : (
                    <StyledCompanySelect defaultValue="">
                      <option value="" disabled>
                        Link to company...
                      </option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </StyledCompanySelect>
                  )}
                </StyledTd>
                <StyledTd>
                  <StyledStatusBadge status={entry.company?.customerStatus ?? null}>
                    {entry.company
                      ? formatCustomerStatus(entry.company.customerStatus)
                      : '--'}
                  </StyledStatusBadge>
                </StyledTd>
              </StyledTr>
            ))}
          </tbody>
        </StyledTable>
      )}
    </StyledPageContainer>
  );
};
