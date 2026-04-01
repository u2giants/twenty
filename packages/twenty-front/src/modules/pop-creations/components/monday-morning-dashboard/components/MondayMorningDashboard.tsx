import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { Card } from '@/ui/layout/card/components/Card';
import { CardContent } from '@/ui/layout/card/components/CardContent';
import { Section } from '@/ui/layout/page/components/Section';
import { useLingui } from '@lingui/react/macro';
import {
  IconBuildingFactory,
  IconCalendarEvent,
  IconClipboardList,
  IconTarget,
} from 'twenty-ui/display';

interface DashboardMetric {
  label: string;
  value: number;
  change?: number;
  icon: React.ComponentType<{ size?: number }>;
}

export const MondayMorningDashboard = () => {
  const { t } = useLingui();

  // Fetch key metrics
  const { records: tasks } = useFindManyRecords({
    objectNameSingular: 'task',
    filter: {
      dueDate: {
        gte: new Date().toISOString(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    limit: 100,
  });

  const { records: opportunities } = useFindManyRecords({
    objectNameSingular: 'opportunity',
    filter: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    limit: 100,
  });

  const { records: meetingNotes } = useFindManyRecords({
    objectNameSingular: 'meetingNote',
    filter: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    limit: 50,
  });

  const { records: companies } = useFindManyRecords({
    objectNameSingular: 'company',
    limit: 10,
  });

  const metrics: DashboardMetric[] = [
    {
      label: 'Tasks This Week',
      value: tasks.length,
      icon: IconClipboardList,
    },
    {
      label: 'New Programs',
      value: opportunities.length,
      icon: IconTarget,
    },
    {
      label: 'Meetings',
      value: meetingNotes.length,
      icon: IconCalendarEvent,
    },
    {
      label: 'Active Companies',
      value: companies.length,
      icon: IconBuildingFactory,
    },
  ];

  const upcomingTasks = tasks
    .filter((task) => task.dueDate)
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
    .slice(0, 5);

  const recentPrograms = opportunities
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div>
      <Section>
        <Card>
          <h1>Monday Morning Dashboard</h1>
          <p>Your weekly overview and key metrics</p>
        </Card>
      </Section>

      <Section>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <metric.icon size={24} />
                  <div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                      }}
                    >
                      {metric.value}
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#666',
                      }}
                    >
                      {metric.label}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        <Section>
          <Card>
            <h2>
              <IconClipboardList size={16} /> Upcoming Tasks
            </h2>
            {upcomingTasks.length === 0 ? (
              <p>No upcoming tasks</p>
            ) : (
              <ul>
                {upcomingTasks.map((task) => (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    <br />
                    <small>
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>

        <Section>
          <Card>
            <h2>
              <IconTarget size={16} /> Recent Programs
            </h2>
            {recentPrograms.length === 0 ? (
              <p>No recent programs</p>
            ) : (
              <ul>
                {recentPrograms.map((program) => (
                  <li key={program.id}>
                    <strong>{program.name}</strong>
                    <br />
                    <small>Stage: {program.stage}</small>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      </div>
    </div>
  );
};
