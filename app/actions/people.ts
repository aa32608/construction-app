'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function inviteUserAction(
  email: string,
  role: string = 'employee',
  jobTitle?: string,
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

  // Check if user can invite (owner/manager)
  const canInvite = ['owner', 'manager'].includes(membership.role);
  if (!canInvite) return { success: false, error: 'Insufficient permissions' };

  // Auth Admin endpoints reject the public/anon client with “User not allowed”.
  // Use the server-only service-role client for this operation.
  let admin;
  try { admin = createAdminClient(); } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Server invite configuration is missing' };
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { company_id: membership.company_id, role, job_title: jobTitle ?? null },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/people');
  return { success: true };
}

export async function updateMemberRoleAction(
  targetUserId: string,
  newRole: string,
  jobTitle?: string,
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

  // Only owners can change roles
  if (membership.role !== 'owner') {
    return { success: false, error: 'Only owners can change roles' };
  }

  // Cannot change own role
  if (targetUserId === user.id) {
    return { success: false, error: 'Cannot change your own role' };
  }

  const { error } = await supabase
    .from('company_members')
    .update({ role: newRole as any, job_title: jobTitle ?? null })
    .eq('company_id', membership.company_id)
    .eq('user_id', targetUserId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/people');
  return { success: true };
}

export async function removeMemberAction(
  targetUserId: string,
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

  // Only owners can remove members
  if (membership.role !== 'owner') {
    return { success: false, error: 'Only owners can remove members' };
  }

  // Cannot remove self
  if (targetUserId === user.id) {
    return { success: false, error: 'Cannot remove yourself' };
  }

  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('company_id', membership.company_id)
    .eq('user_id', targetUserId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/people');
  return { success: true };
}