import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData, getProjectsList } from '@/lib/data';
import { formatBudget, formatDue } from '@/lib/format';
import ProjectsClient from './ProjectsClient';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [dashboard, projects] = await Promise.all([
    getDashboardData(supabase),
    getProjectsList(supabase),
  ]);

  if (!dashboard) {
    redirect('/login');
  }

  return (
    <ProjectsClient
      user={dashboard.user}
      membership={dashboard.membership}
      projects={projects}
      stats={dashboard.stats}
    />
  );
}