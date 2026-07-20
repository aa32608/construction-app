import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData, getAuditLogs, getCompanyFinancialSummary } from '@/lib/data';
import { getGreeting, getTodayLabel } from '@/lib/format';
import Dashboard from './_components/Dashboard';

// The dashboard is fully dynamic: it depends on the request cookies (session)
// and reads tenant-scoped data on every render.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();
  const data = await getDashboardData(supabase);

  if (!data) {
    redirect('/login');
  }

  const [auditLogs, financialSummary] = await Promise.all([
    getAuditLogs(supabase, 8),
    getCompanyFinancialSummary(supabase),
  ]);

  return (
    <Dashboard
      user={data.user}
      membership={data.membership}
      projects={data.projects}
      tasks={data.tasks}
      stats={data.stats}
      auditLogs={auditLogs}
      financialSummary={financialSummary}
      greeting={getGreeting(data.user.fullName)}
      todayLabel={getTodayLabel()}
    />
  );
}
