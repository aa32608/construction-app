import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData, getDocuments, getDocumentStats, getProjectsList } from '@/lib/data';
import DocumentsClient from './DocumentsClient';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [dashboard, documents, stats, projects] = await Promise.all([
    getDashboardData(supabase),
    getDocuments(supabase),
    getDocumentStats(supabase),
    getProjectsList(supabase),
  ]);

  if (!dashboard) {
    redirect('/login');
  }

  return (
    <DocumentsClient
      user={dashboard.user}
      membership={dashboard.membership}
      documents={documents}
      stats={stats}
      projects={projects}
      dashboardStats={dashboard.stats}
    />
  );
}