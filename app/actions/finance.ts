'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ProjectPayment } from '@/lib/data';

export async function createProjectPaymentAction(payment: {
  projectId: string;
  title: string;
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  status?: 'pending' | 'completed' | 'overdue';
  paymentDate?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string; payment?: ProjectPayment }> {
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

  if (!payment.title.trim() || payment.amount <= 0) {
    return { success: false, error: 'Valid title and positive amount are required' };
  }

  const { data, error } = await supabase
    .from('project_payments')
    .insert({
      company_id: membership.company_id,
      project_id: payment.projectId,
      title: payment.title.trim(),
      type: payment.type,
      amount: payment.amount,
      category: payment.category || 'other',
      status: payment.status || 'completed',
      payment_date: payment.paymentDate || new Date().toISOString().split('T')[0],
      notes: payment.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Log audit event
  try {
    await supabase.from('audit_logs').insert({
      company_id: membership.company_id,
      actor_id: user.id,
      action: `Recorded ${payment.type === 'income' ? 'payment receipt' : 'expense'} of €${payment.amount.toLocaleString()} ("${payment.title}")`,
      entity_type: 'project_payment',
      entity_id: payment.projectId,
      metadata: { amount: payment.amount, type: payment.type },
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }

  revalidatePath(`/projects/${payment.projectId}`);
  revalidatePath('/');

  return {
    success: true,
    payment: {
      id: data.id,
      projectId: data.project_id,
      title: data.title,
      type: data.type,
      amount: Number(data.amount) || 0,
      category: data.category,
      status: data.status,
      paymentDate: data.payment_date,
      notes: data.notes,
      createdAt: data.created_at,
    },
  };
}

export async function deleteProjectPaymentAction(
  paymentId: string,
  projectId: string,
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
    .from('project_payments')
    .delete()
    .eq('id', paymentId)
    .eq('company_id', membership.company_id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/');

  return { success: true };
}
