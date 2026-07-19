import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData, getProjectDetail } from '@/lib/data';
import ProjectDetailClient from './ProjectDetailClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [dashboard, project] = await Promise.all([
    getDashboardData(supabase),
    getProjectDetail(supabase, id),
  ]);

  if (!dashboard) {
    redirect('/login');
  }

  if (!project) {
    notFound();
  }

  return (
    <ProjectDetailClient
      user={dashboard.user}
      membership={dashboard.membership}
      project={project}
    />
  );
}