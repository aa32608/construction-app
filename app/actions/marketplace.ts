'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Vendor, Product, RFQ, RFQItem, PurchaseOrder, MarketplaceFilters } from '@/lib/data';

export async function createVendorAction(
  vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<{ success: boolean; error?: string; vendor?: Vendor }> {
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
    .from('vendors')
    .insert({
      company_id: membership.company_id,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      categories: vendor.categories,
      rating: vendor.rating,
      is_verified: vendor.isVerified,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath('/marketplace');
  return {
    success: true,
    vendor: {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      categories: data.categories ?? [],
      rating: Number(data.rating) || 0,
      isVerified: data.is_verified ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function createProductAction(
  product: Omit<Product, 'id' | 'vendorName' | 'createdAt' | 'updatedAt'>,
): Promise<{ success: boolean; error?: string; product?: Product }> {
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
    .from('products')
    .insert({
      company_id: membership.company_id,
      vendor_id: product.vendorId,
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      unit_price: product.unitPrice,
      currency: product.currency,
      min_order_qty: product.minOrderQty,
      lead_time_days: product.leadTimeDays,
      is_active: product.isActive,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath('/marketplace');
  return {
    success: true,
    product: {
      id: data.id,
      vendorId: data.vendor_id,
      vendorName: '',
      name: data.name,
      description: data.description,
      sku: data.sku,
      category: data.category,
      unit: data.unit,
      unitPrice: Number(data.unit_price) || 0,
      currency: data.currency,
      minOrderQty: Number(data.min_order_qty) || 1,
      leadTimeDays: Number(data.lead_time_days) || 0,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function createRFQAction(
  rfq: Omit<RFQ, 'id' | 'rfqNumber' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt' | 'quotesCount'>,
  items: Omit<RFQItem, 'id' | 'rfqId'>[],
): Promise<{ success: boolean; error?: string; rfq?: RFQ }> {
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

  // Generate RFQ number
  const { data: lastRFQ } = await supabase
    .from('rfqs')
    .select('rfq_number')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (lastRFQ && lastRFQ.length > 0) {
    const match = lastRFQ[0].rfq_number?.match(/RFQ-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const rfqNumber = `RFQ-${String(nextNum).padStart(4, '0')}`;

  const { data: newRFQ, error } = await supabase
    .from('rfqs')
    .insert({
      company_id: membership.company_id,
      rfq_number: rfqNumber,
      project_id: rfq.projectId,
      title: rfq.title,
      description: rfq.description,
      status: 'draft',
      due_date: rfq.dueDate,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Insert RFQ items
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('rfq_items')
      .insert(
        items.map((item) => ({
          rfq_id: newRFQ.id,
          product_name: item.productName,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          needed_by: item.neededBy,
        })),
      );

    if (itemsError) {
      await supabase.from('rfqs').delete().eq('id', newRFQ.id);
      return { success: false, error: itemsError.message };
    }
  }

  revalidatePath('/marketplace');
  return {
    success: true,
    rfq: {
      id: newRFQ.id,
      rfqNumber: newRFQ.rfq_number,
      projectId: newRFQ.project_id,
      projectName: rfq.projectName,
      title: newRFQ.title,
      description: newRFQ.description,
      status: newRFQ.status,
      dueDate: newRFQ.due_date,
      createdBy: newRFQ.created_by,
      createdByName: '',
      createdAt: newRFQ.created_at,
      updatedAt: newRFQ.updated_at,
      items: items.map((item) => ({
        ...item,
        id: '',
        rfqId: newRFQ.id,
      })),
      quotesCount: 0,
    },
  };
}

export async function sendRFQAction(
  rfqId: string,
  vendorIds: string[],
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

  const canManage = ['owner', 'manager', 'engineer'].includes(membership.role);
  if (!canManage) return { success: false, error: 'Insufficient permissions' };

  // Update RFQ status
  const { error } = await supabase
    .from('rfqs')
    .update({ status: 'sent' })
    .eq('id', rfqId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  // TODO: Create quote requests for each vendor (could be a separate table)
  // For now, just update status

  revalidatePath('/marketplace');
  return { success: true };
}

export async function submitQuoteAction(
  quoteId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // In a real app, this would be called by the vendor via a magic link
  // For now, we just allow updating quote status

  const { error } = await supabase
    .from('quotes')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', quoteId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/marketplace');
  return { success: true };
}

export async function acceptQuoteAction(
  quoteId: string,
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

  // Get quote with RFQ
  const { data: quote } = await supabase
    .from('quotes')
    .select(`*, rfqs!quotes_rfq_id_fkey(*)`)
    .eq('id', quoteId)
    .eq('company_id', membership.company_id)
    .single();

  if (!quote) return { success: false, error: 'Quote not found' };

  // Update quote status
  const { error: quoteError } = await supabase
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', quoteId);

  if (quoteError) return { success: false, error: quoteError.message };

  // Reject other quotes for this RFQ
  await supabase
    .from('quotes')
    .update({ status: 'rejected' })
    .eq('rfq_id', quote.rfq_id)
    .neq('id', quoteId);

  // Update RFQ status
  await supabase
    .from('rfqs')
    .update({ status: 'awarded' })
    .eq('id', quote.rfq_id);

  revalidatePath('/marketplace');
  return { success: true };
}

export async function createPurchaseOrderFromQuoteAction(
  quoteId: string,
): Promise<{ success: boolean; error?: string; po?: PurchaseOrder }> {
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

  // Get quote with items
  const { data: quote } = await supabase
    .from('quotes')
    .select(`*, quote_items(*), rfqs!quotes_rfq_id_fkey(rfq_number, project_id), vendors!quotes_vendor_id_fkey(name)`)
    .eq('id', quoteId)
    .eq('company_id', membership.company_id)
    .eq('status', 'accepted')
    .single();

  if (!quote) return { success: false, error: 'Quote not found or not accepted' };

  // Check if PO already exists
  const { data: existingPO } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('rfq_id', quote.rfq_id)
    .eq('vendor_id', quote.vendor_id)
    .eq('company_id', membership.company_id)
    .maybeSingle();

  if (existingPO) return { success: false, error: 'Purchase order already exists for this quote' };

  // Generate PO number
  const { data: lastPO } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (lastPO && lastPO.length > 0) {
    const match = lastPO[0].po_number?.match(/PO-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const poNumber = `PO-${String(nextNum).padStart(4, '0')}`;

  const { data: newPO, error } = await supabase
    .from('purchase_orders')
    .insert({
      company_id: membership.company_id,
      po_number: poNumber,
      rfq_id: quote.rfq_id,
      vendor_id: quote.vendor_id,
      project_id: quote.rfqs?.project_id,
      status: 'draft',
      total_amount: quote.total_amount,
      currency: quote.currency,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Insert PO items from quote items
  const { error: itemsError } = await supabase
    .from('po_items')
    .insert(
      (quote.quote_items ?? []).map((qi: any) => ({
        purchase_order_id: newPO.id,
        product_name: qi.product_name,
        description: qi.notes,
        quantity: qi.quantity,
        unit: qi.unit,
        unit_price: qi.unit_price,
        total_price: qi.total_price,
        received_qty: 0,
      })),
    );

  if (itemsError) {
    await supabase.from('purchase_orders').delete().eq('id', newPO.id);
    return { success: false, error: itemsError.message };
  }

  // Update quote status
  await supabase
    .from('quotes')
    .update({ status: 'awarded' })
    .eq('id', quoteId);

  revalidatePath('/marketplace');
  return {
    success: true,
    po: {
      id: newPO.id,
      poNumber: newPO.po_number,
      rfqId: newPO.rfq_id,
      rfqNumber: quote.rfqs?.rfq_number,
      vendorId: newPO.vendor_id,
      vendorName: quote.vendors?.name,
      projectId: newPO.project_id,
      projectName: null,
      status: newPO.status,
      totalAmount: Number(newPO.total_amount) || 0,
      currency: newPO.currency,
      expectedDate: newPO.expected_date,
      createdBy: newPO.created_by,
      createdByName: '',
      createdAt: newPO.created_at,
      updatedAt: newPO.updated_at,
      items: [],
    },
  };
}

export async function receivePOItemAction(
  poItemId: string,
  receivedQty: number,
  inventoryItemId?: string,
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

  // Get PO item
  const { data: poItem } = await supabase
    .from('po_items')
    .select(`*, purchase_orders!po_items_purchase_order_id_fkey(company_id, vendor_id, project_id, id)`)
    .eq('id', poItemId)
    .eq('purchase_orders.company_id', membership.company_id)
    .single();

  if (!poItem) return { success: false, error: 'PO item not found' };

  const newReceivedQty = Number(poItem.received_qty) + receivedQty;
  if (newReceivedQty > Number(poItem.quantity)) {
    return { success: false, error: 'Received quantity exceeds ordered quantity' };
  }

  // Update PO item
  const { error: updateError } = await supabase
    .from('po_items')
    .update({ received_qty: newReceivedQty, inventory_item_id: inventoryItemId ?? null })
    .eq('id', poItemId);

  if (updateError) return { success: false, error: updateError.message };

  // If inventory item linked, increment stock
  if (inventoryItemId) {
    const { data: invItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', inventoryItemId)
      .eq('company_id', membership.company_id)
      .single();

    if (invItem) {
      const newStock = Number(invItem.current_stock) + receivedQty;
      await supabase
        .from('inventory_items')
        .update({ current_stock: newStock })
        .eq('id', inventoryItemId);
    }
  }

  // Check if all items fully received
  const { data: allItems } = await supabase
    .from('po_items')
    .select('quantity, received_qty')
    .eq('purchase_order_id', poItem.purchase_orders.id);

  const allReceived = (allItems ?? []).every((item: any) => Number(item.received_qty) >= Number(item.quantity));

  if (allReceived) {
    await supabase
      .from('purchase_orders')
      .update({ status: 'received' })
      .eq('id', poItem.purchase_orders.id);
  } else {
    await supabase
      .from('purchase_orders')
      .update({ status: 'partial_received' })
      .eq('id', poItem.purchase_orders.id);
  }

  revalidatePath('/marketplace');
  revalidatePath('/inventory');
  return { success: true };
}