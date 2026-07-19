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

// ============================================
// PROJECT INVENTORY ASSIGNMENT ACTIONS
// ============================================

/**
 * Assigns a specific quantity of an inventory item to a project.
 * Deducts the quantity from the inventory item stock.
 * Enforces that you can only assign up to the available quantity in stock.
 */
export async function assignInventoryToProjectAction(
  projectId: string,
  inventoryItemId: string,
  quantity: number,
): Promise<{ success: boolean; error?: string; remainingStock?: number }> {
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

  const canManage = ['owner', 'manager', 'engineer'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions to assign inventory' };

  if (quantity <= 0) {
    return { success: false, error: 'Quantity to assign must be greater than 0' };
  }

  // Fetch target inventory item
  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('id, name, unit, current_stock')
    .eq('id', inventoryItemId)
    .eq('company_id', membership.company_id)
    .single();

  if (itemError || !item) {
    return { success: false, error: 'Inventory item not found' };
  }

  const currentStock = Number(item.current_stock) || 0;

  // Validate stock constraint: cannot assign more than currentStock
  if (quantity > currentStock) {
    return {
      success: false,
      error: `Cannot assign ${quantity} ${item.unit} of "${item.name}". Only ${currentStock} ${item.unit} available in stock.`,
    };
  }

  const newStock = currentStock - quantity;

  // Deduct stock from inventory
  const { error: stockError } = await supabase
    .from('inventory_items')
    .update({ current_stock: newStock })
    .eq('id', inventoryItemId)
    .eq('company_id', membership.company_id);

  if (stockError) {
    return { success: false, error: stockError.message };
  }

  // Upsert into project_inventory_assignments
  try {
    const { data: existing } = await supabase
      .from('project_inventory_assignments')
      .select('id, quantity')
      .eq('project_id', projectId)
      .eq('inventory_item_id', inventoryItemId)
      .maybeSingle();

    if (existing) {
      const updatedQty = Number(existing.quantity) + quantity;
      const { error: updateAssignError } = await supabase
        .from('project_inventory_assignments')
        .update({ quantity: updatedQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateAssignError) {
        // Rollback stock if assignment record write failed
        await supabase
          .from('inventory_items')
          .update({ current_stock: currentStock })
          .eq('id', inventoryItemId);
        return { success: false, error: updateAssignError.message };
      }
    } else {
      const { error: insertAssignError } = await supabase
        .from('project_inventory_assignments')
        .insert({
          company_id: membership.company_id,
          project_id: projectId,
          inventory_item_id: inventoryItemId,
          quantity: quantity,
          created_by: user.id,
        });

      if (insertAssignError) {
        // Rollback stock if assignment record insert failed
        await supabase
          .from('inventory_items')
          .update({ current_stock: currentStock })
          .eq('id', inventoryItemId);
        return { success: false, error: insertAssignError.message };
      }
    }
  } catch (err) {
    console.error('Assignment table operation error:', err);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/inventory');
  revalidatePath('/');

  return { success: true, remainingStock: newStock };
}

/**
 * Removes or unassigns an inventory assignment from a project.
 * Reverts/restores the assigned quantity back into the inventory item's stock.
 */
export async function removeInventoryFromProjectAction(
  projectId: string,
  inventoryItemId: string,
  assignmentId?: string,
): Promise<{ success: boolean; error?: string; restoredStock?: number }> {
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

  const canManage = ['owner', 'manager', 'engineer'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  let assignedQuantity = 0;
  let targetAssignmentId = assignmentId;

  // Find assignment record
  if (targetAssignmentId) {
    const { data: assignData } = await supabase
      .from('project_inventory_assignments')
      .select('id, quantity, inventory_item_id')
      .eq('id', targetAssignmentId)
      .maybeSingle();

    if (assignData) {
      assignedQuantity = Number(assignData.quantity) || 0;
    }
  } else {
    const { data: assignData } = await supabase
      .from('project_inventory_assignments')
      .select('id, quantity')
      .eq('project_id', projectId)
      .eq('inventory_item_id', inventoryItemId)
      .maybeSingle();

    if (assignData) {
      targetAssignmentId = assignData.id;
      assignedQuantity = Number(assignData.quantity) || 0;
    }
  }

  // Delete assignment record if present
  if (targetAssignmentId) {
    const { error: deleteError } = await supabase
      .from('project_inventory_assignments')
      .delete()
      .eq('id', targetAssignmentId);

    if (deleteError) {
      console.error('Error deleting assignment record:', deleteError);
    }
  }

  // Restore assigned quantity back to inventory item's current stock
  const { data: item } = await supabase
    .from('inventory_items')
    .select('current_stock')
    .eq('id', inventoryItemId)
    .eq('company_id', membership.company_id)
    .single();

  let restoredStock = 0;
  if (item) {
    restoredStock = Number(item.current_stock) + assignedQuantity;
    await supabase
      .from('inventory_items')
      .update({ current_stock: restoredStock })
      .eq('id', inventoryItemId)
      .eq('company_id', membership.company_id);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/inventory');
  revalidatePath('/');

  return { success: true, restoredStock };
}
