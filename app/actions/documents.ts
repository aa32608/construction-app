'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Document } from '@/lib/data';

export async function uploadDocumentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; document?: Document }> {
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

  // All authenticated members can upload
  const file = formData.get('file') as File;
  if (!file) return { success: false, error: 'No file provided' };

  const projectId = formData.get('projectId') as string || null;
  const name = formData.get('name') as string || file.name;

  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { success: false, error: 'File size exceeds 50MB limit' };
  }

  // Upload to Supabase Storage
  const fileExt = file.name.split('.').pop() || '';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const filePath = `${membership.company_id}/${projectId || 'general'}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { success: false, error: uploadError.message };

  // Create database record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      company_id: membership.company_id,
      project_id: projectId,
      name,
      file_path: filePath,
      mime_type: file.type,
      size_bytes: file.size,
      version: 1,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // Cleanup storage on DB error
    await supabase.storage.from('documents').remove([filePath]);
    return { success: false, error: error.message };
  }

  revalidatePath('/documents');
  return {
    success: true,
    document: {
      id: data.id,
      name: data.name,
      filePath: data.file_path,
      mimeType: data.mime_type,
      sizeBytes: Number(data.size_bytes) || 0,
      version: data.version ?? 1,
      projectId: data.project_id,
      projectName: null,
      uploadedBy: data.uploaded_by,
      uploadedByName: '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function deleteDocumentAction(
  documentId: string,
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

  const canDelete = ['owner', 'manager'].includes(membership.role);
  if (!canDelete) return { success: false, error: 'Insufficient permissions' };

  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('company_id', membership.company_id)
    .single();

  if (fetchError || !doc) return { success: false, error: 'Document not found' };

  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([doc.file_path]);

  if (storageError) return { success: false, error: storageError.message };

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('company_id', membership.company_id);

  if (dbError) return { success: false, error: dbError.message };

  revalidatePath('/documents');
  return { success: true };
}

export async function getDocumentDownloadUrlAction(
  filePath: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { success: false, error: 'No company membership' };

  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('file_path', filePath)
    .eq('company_id', membership.company_id)
    .maybeSingle();

  if (!doc) return { success: false, error: 'Document not found' };

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 60 * 60);

  if (error) return { success: false, error: error.message };

  return { success: true, url: data.signedUrl };
}