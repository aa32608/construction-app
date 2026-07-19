import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData, getCompanyMembers } from '@/lib/data';
import PeopleClient from './PeopleClient';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const supabase = await createClient();
  const [dashboard, members] = await Promise.all([
    getDashboardData(supabase),
    getCompanyMembers(supabase),
  ]);

  if (!dashboard) {
    redirect('/login');
  }

  return (
    <PeopleClient
      user={dashboard.user}
      membership={dashboard.membership}
      members={members}
      stats={dashboard.stats}
    />
  );
}