import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData, getInventoryItems, getInventoryStats } from '@/lib/data';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const supabase = await createClient();
  const [dashboard, items, stats] = await Promise.all([
    getDashboardData(supabase),
    getInventoryItems(supabase),
    getInventoryStats(supabase),
  ]);

  if (!dashboard) {
    redirect('/login');
  }

  return (
    <InventoryClient
      user={dashboard.user}
      membership={dashboard.membership}
      items={items}
      stats={stats}
      dashboardStats={dashboard.stats}
    />
  );
}