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

type EmailDomainsQueryData = {
  emailMessages: {
    edges: Array<{ node: EmailMessageNode }>;
  } | null;
};

type AllCompaniesQueryData = {
  companies: {
    edges: Array<{ node: CompanyNode }>;
  } | null;
};

type DomainEntry = {
  domain: string;
  emailCount: number;
  company: { id: string; name: string; customerStatus: string | null } | null;
};

const StyledPageContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  margin: 0 auto;
  max-width: 1100px;
  padding: ${themeCssVariables.spacing[8]};
  width: 100%;
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
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSearchInput = styled.input`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledFilterSelect = styled.select`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledTable = styled.table`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-collapse: collapse;
  border-radius: ${themeCssVariables.border.radius.md};
  overflow: hidden;
  width: 100%;
`;

const StyledTableHeader = styled.thead`
  background-color: ${themeCssVariables.background.secondary};
`;

const StyledTh = styled.th`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  text-align: left;
  white-space: nowrap;
`;

const StyledTd = styled.td`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
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
  border-radius: ${themeCssVariables.border.radius.pill};
  color: ${({ status }) => {
    switch (status) {
      case 'ACTIVE_CUSTOMER':
      case 'POTENTIAL_CUSTOMER':
        return themeCssVariables.font.color.inverted;
      default:
        return themeCssVariables.font.color.tertiary;
    }
  }};
  display: inline-block;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 2px 8px;
`;

const StyledCompanySelect = styled.select`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  max-width: 200px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledLoadingContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: ${themeCssVariables.spacing[10]};
`;

const StyledErrorContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.danger};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: ${themeCssVariables.spacing[10]};
`;

const StyledEmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
`;

const StyledSummary = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[6]};
`;

const StyledSummaryItem = styled.span`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSummaryCount = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.semiBold};
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
      allAddresses.push(...email.recipients.split(',').map((r) => r.trim()));
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
  } = useQuery<EmailDomainsQueryData>(EMAIL_DOMAINS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: companiesData,
    loading: companiesLoading,
    error: companiesError,
  } = useQuery<AllCompaniesQueryData>(ALL_COMPANIES_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

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
        <StyledLoadingContainer>Loading domain data...</StyledLoadingContainer>
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
          Total domains:{' '}
          <StyledSummaryCount>{domainEntries.length}</StyledSummaryCount>
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
                  <StyledStatusBadge
                    status={entry.company?.customerStatus ?? null}
                  >
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
