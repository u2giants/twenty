import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { Card } from '@/ui/layout/card/components/Card';
import { Section } from '@/ui/layout/page/components/Section';
import { Tab } from '@/ui/layout/tab/components/Tab';
import { TabList } from '@/ui/layout/tab/components/TabList';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IconBuildingSkyscraper,
  IconChartBar,
  IconSettings,
  IconUsers,
} from 'twenty-ui/display';

const DEPARTMENT_TABS = [
  { id: 'overview', label: 'Overview', icon: IconChartBar },
  { id: 'members', label: 'Members', icon: IconUsers },
  { id: 'programs', label: 'Programs', icon: IconBuildingSkyscraper },
  { id: 'settings', label: 'Settings', icon: IconSettings },
] as const;

export const DepartmentDashboard = () => {
  const { t } = useLingui();
  const { departmentId } = useParams<{ departmentId: string }>();
  const [activeTabId, setActiveTabId] = useState<string>('overview');

  const { objectMetadataItem: departmentMetadata } = useObjectMetadataItem({
    objectNameSingular: 'department',
  });

  const { records: departmentMembers } = useFindManyRecords({
    objectNameSingular: 'person',
    filter: {
      departmentId: { eq: departmentId },
    },
    limit: 100,
  });

  const { records: programs } = useFindManyRecords({
    objectNameSingular: 'opportunity',
    filter: {
      departmentId: { eq: departmentId },
    },
    limit: 100,
  });

  const departmentStats = {
    totalMembers: departmentMembers.length,
    totalPrograms: programs.length,
    activePrograms: programs.filter((p) => p.stage === 'active').length,
  };

  return (
    <div>
      <Section>
        <Card>
          <h1>{departmentMetadata?.labelPlural}</h1>
          <div>
            <h2>{departmentStats.totalMembers} Members</h2>
            <h2>{departmentStats.totalPrograms} Programs</h2>
            <h2>{departmentStats.activePrograms} Active</h2>
          </div>
        </Card>
      </Section>

      <TabList>
        {DEPARTMENT_TABS.map((tab) => (
          <Tab
            key={tab.id}
            id={tab.id}
            active={activeTabId === tab.id}
            onClick={() => setActiveTabId(tab.id)}
            label={tab.label}
            Icon={tab.icon}
          />
        ))}
      </TabList>

      {activeTabId === 'overview' && (
        <Section>
          <Card>
            <h2>Department Overview</h2>
            <p>Overview content for {departmentId}</p>
          </Card>
        </Section>
      )}

      {activeTabId === 'members' && (
        <Section>
          <Card>
            <h2>Department Members</h2>
            {departmentMembers.length === 0 ? (
              <p>No members found</p>
            ) : (
              <ul>
                {departmentMembers.map((member) => (
                  <li key={member.id}>{member.name}</li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      )}

      {activeTabId === 'programs' && (
        <Section>
          <Card>
            <h2>Programs</h2>
            {programs.length === 0 ? (
              <p>No programs found</p>
            ) : (
              <ul>
                {programs.map((program) => (
                  <li key={program.id}>{program.name}</li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      )}

      {activeTabId === 'settings' && (
        <Section>
          <Card>
            <h2>Department Settings</h2>
            <p>Settings content for {departmentId}</p>
          </Card>
        </Section>
      )}
    </div>
  );
};
