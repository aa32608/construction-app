'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { InventoryItem } from '@/lib/data';

export async function createInventoryItemAction(
  item: Omit<InventoryItem, 'id' | 'lowStock' | 'createdAt' | 'updatedAt'>,
): Promise<{ success: boolean; error?: string; item?: InventoryItem }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      company_id: membership.company_id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      warehouse: item.warehouse,
      unit: item.unit,
      current_stock: item.currentStock,
      minimum_stock: item.minimumStock,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath('/inventory');
  return {
    success: true,
    item: {
      id: data.id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      warehouse: data.warehouse,
      unit: data.unit,
      currentStock: Number(data.current_stock) || 0,
      minimumStock: Number(data.minimum_stock) || 0,
      lowStock: data.low_stock ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function updateInventoryItemAction(
  itemId: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  const { error } = await supabase
    .from('inventory_items')
    .update({
      name: updates.name,
      sku: updates.sku,
      category: updates.category,
      warehouse: updates.warehouse,
      unit: updates.unit,
      current_stock: updates.currentStock,
      minimum_stock: updates.minimumStock,
    })
    .eq('id', itemId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/inventory');
  return { success: true };
}

export async function adjustStockAction(
  itemId: string,
  delta: number,
): Promise<{ success: boolean; error?: string; newStock?: number }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const canManage = ['owner', 'manager'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('current_stock')
    .eq('id', itemId)
    .eq('company_id', membership.company_id)
    .single();

  if (fetchError || !item) return { success: false, error: 'Item not found' };

  const newStock = Math.max(0, Number(item.current_stock) + delta);

  const { error } = await supabase
    .from('inventory_items')
    .update({ current_stock: newStock })
    .eq('id', itemId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/inventory');
  return { success: true, newStock };
}

export async function deleteInventoryItemAction(
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  if (membership.role !== 'owner') {
    return { success: false, error: 'Only owners can delete items' };
  }

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/inventory');
  return { success: true };
}