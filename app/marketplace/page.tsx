import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { 
  getDashboardData, 
  getMarketplaceStats, 
  getVendors, 
  getProducts, 
  getRFQs, 
  getPurchaseOrders,
  getProjectsList 
} from '@/lib/data';
import MarketplaceClient from './MarketplaceClient';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  const supabase = await createClient();
  const [dashboard, stats, vendors, products, rfqs, pos, projects] = await Promise.all([
    getDashboardData(supabase),
    getMarketplaceStats(supabase),
    getVendors(supabase),
    getProducts(supabase),
    getRFQs(supabase),
    getPurchaseOrders(supabase),
    getProjectsList(supabase),
  ]);

  if (!dashboard) {
    redirect('/login');
  }

  return (
    <MarketplaceClient
      user={dashboard.user}
      membership={dashboard.membership}
      stats={stats}
      vendors={vendors}
      products={products}
      rfqs={rfqs}
      pos={pos}
      projects={projects}
      dashboardStats={dashboard.stats}
    />
  );
}