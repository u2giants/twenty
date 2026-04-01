import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { Button } from '@/ui/input/button/components/Button';
import { Card } from '@/ui/layout/card/components/Card';
import { Section } from '@/ui/layout/page/components/Section';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import {
  IconCheck,
  IconMail,
  IconRefresh,
  IconSettings,
  IconX,
} from 'twenty-ui/display';

type DomainStatus = 'pending' | 'verified' | 'failed';

interface DomainRecord {
  id: string;
  name: string;
  status: DomainStatus;
  company?: {
    id: string;
    name: string;
  };
}

export const DomainManager = () => {
  const { t } = useLingui();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    records: domains,
    loading,
    refetch,
  } = useFindManyRecords({
    objectNameSingular: 'company',
    filter: {},
    limit: 100,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleVerifyDomain = (domainId: string) => {
    console.log('Verify domain:', domainId);
  };

  const getStatusColor = (status: DomainStatus) => {
    switch (status) {
      case 'verified':
        return 'green';
      case 'pending':
        return 'orange';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: DomainStatus) => {
    switch (status) {
      case 'verified':
        return IconCheck;
      case 'pending':
        return IconRefresh;
      case 'failed':
        return IconX;
      default:
        return IconMail;
    }
  };

  return (
    <div>
      <Section>
        <Card>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <h1>Domain Manager</h1>
            <Button
              onClick={handleRefresh}
              loading={isRefreshing}
              variant="secondary"
              size="small"
              leftIcon={IconRefresh}
            >
              {t`Refresh`}
            </Button>
          </div>

          <p>
            Manage company domains and their verification status for email
            routing.
          </p>
        </Card>
      </Section>

      <Section>
        <Card>
          <h2>Domains</h2>

          {loading ? (
            <p>Loading domains...</p>
          ) : domains.length === 0 ? (
            <p>No domains found</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Domain</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Company</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td style={{ padding: '8px' }}>
                      <IconMail size={16} />
                      {domain.domainName || domain.name}
                    </td>
                    <td style={{ padding: '8px' }}>{domain.name}</td>
                    <td style={{ padding: '8px' }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {t(getStatusIcon(domain.status)?.name || 'unknown')}
                        {domain.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <Button
                        onClick={() => handleVerifyDomain(domain.id)}
                        variant="secondary"
                        size="tiny"
                        leftIcon={IconSettings}
                      >
                        {t`Settings`}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </Section>
    </div>
  );
};
