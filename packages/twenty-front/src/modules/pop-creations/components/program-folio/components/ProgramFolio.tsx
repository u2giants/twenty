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
  IconCalendar,
  IconChartPie,
  IconClipboardList,
  IconFileText,
  IconUsers,
} from 'twenty-ui/display';

const PROGRAM_TABS = [
  { id: 'overview', label: 'Overview', icon: IconChartPie },
  { id: 'documents', label: 'Documents', icon: IconFileText },
  { id: 'team', label: 'Team', icon: IconUsers },
  { id: 'schedule', label: 'Schedule', icon: IconCalendar },
  { id: 'tasks', label: 'Tasks', icon: IconClipboardList },
] as const;

export const ProgramFolio = () => {
  const { t } = useLingui();
  const { programId } = useParams<{ programId: string }>();
  const [activeTabId, setActiveTabId] = useState<string>('overview');

  const { objectMetadataItem: programMetadata } = useObjectMetadataItem({
    objectNameSingular: 'opportunity',
  });

  const { records: meetingNotes } = useFindManyRecords({
    objectNameSingular: 'meetingNote',
    filter: {
      opportunityId: { eq: programId },
    },
    limit: 50,
  });

  const { records: tasks } = useFindManyRecords({
    objectNameSingular: 'task',
    filter: {
      opportunityId: { eq: programId },
    },
    limit: 50,
  });

  const programStats = {
    totalDocuments: meetingNotes.length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
  };

  return (
    <div>
      <Section>
        <Card>
          <h1>{programMetadata?.labelSingular}</h1>
          <div>
            <h2>{programStats.totalDocuments} Documents</h2>
            <h2>{programStats.totalTasks} Tasks</h2>
            <h2>{programStats.completedTasks} Completed</h2>
          </div>
        </Card>
      </Section>

      <TabList>
        {PROGRAM_TABS.map((tab) => (
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
            <h2>Program Overview</h2>
            <p>Overview content for program {programId}</p>
          </Card>
        </Section>
      )}

      {activeTabId === 'documents' && (
        <Section>
          <Card>
            <h2>Documents</h2>
            {meetingNotes.length === 0 ? (
              <p>No documents found</p>
            ) : (
              <ul>
                {meetingNotes.map((note) => (
                  <li key={note.id}>{note.title}</li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      )}

      {activeTabId === 'tasks' && (
        <Section>
          <Card>
            <h2>Tasks</h2>
            {tasks.length === 0 ? (
              <p>No tasks found</p>
            ) : (
              <ul>
                {tasks.map((task) => (
                  <li key={task.id}>
                    {task.title} - {task.status}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      )}
    </div>
  );
};
