'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  Package,
  Settings,
  Trash2,
  Edit,
  ArrowUpRight,
  Calendar,
  DollarSign,
  User,
  MessageSquare,
  X,
  Loader2,
  Bell,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { assignInventoryToProjectAction, removeInventoryFromProjectAction } from '@/app/actions/inventory';
import { createProjectPaymentAction, deleteProjectPaymentAction } from '@/app/actions/finance';
import { formatBudget, formatDue, getInitials } from '@/lib/format';
import { useLanguage, type Language } from '@/lib/translations';
import type { ProjectDetail, ProjectTask, ProjectMember, DashboardUser, Membership } from '@/lib/data';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  planning: { label: 'Planning', color: '#3b82f6', bg: '#eff6ff', icon: FileText },
  active: { label: 'Active', color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle },
  on_hold: { label: 'On Hold', color: '#f59e0b', bg: '#fffbeb', icon: Clock },
  completed: { label: 'Completed', color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
  archived: { label: 'Archived', color: '#6b7280', bg: '#f9fafb', icon: FileText },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'To do', color: '#6b7280', bg: '#f9fafb' },
  in_progress: { label: 'In progress', color: '#3b82f6', bg: '#eff6ff' },
  done: { label: 'Done', color: '#22c55e', bg: '#f0fdf4' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#3b82f6' },
  high: { label: 'High', color: '#f59e0b' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};

type ProjectDetailClientProps = {
  user: DashboardUser;
  membership: Membership | null;
  project: ProjectDetail;
};

export default function ProjectDetailClient({ user, membership, project: initialProject }: ProjectDetailClientProps) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail>(initialProject);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'team' | 'finance' | 'activity'>('overview');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [taskProject, setTaskProject] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDescription, setTaskDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [taskQuery, setTaskQuery] = useState('');
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'kanban'>('list');

  // Payments & Financing state
  const [paymentsList, setPaymentsList] = useState<{
    id: string;
    title: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    status: 'pending' | 'completed' | 'overdue';
    paymentDate: string;
    notes?: string;
  }[]>([]);

  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentTitle, setPaymentTitle] = useState('');
  const [paymentType, setPaymentType] = useState<'income' | 'expense'>('income');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentCategory, setPaymentCategory] = useState('client_payment');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed' | 'overdue'>('completed');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Translations
  const [lang, setLang] = useState<Language>('en');
  useEffect(() => {
    const saved = localStorage.getItem('lang') as Language;
    if (saved && ['en', 'sq', 'mk'].includes(saved)) {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('lang') as Language;
      if (saved && ['en', 'sq', 'mk'].includes(saved)) {
        setLang(saved);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const { t } = useLanguage(lang);

  // Assignment of People to Tasks & Projects
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [allCompanyMembers, setAllCompanyMembers] = useState<{ userId: string; fullName: string }[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  // Assignment of Inventory Materials to Projects
  const [allInventoryItems, setAllInventoryItems] = useState<{ id: string; name: string; unit: string; currentStock: number; unitCost: number }[]>([]);
  const [showAssignMaterial, setShowAssignMaterial] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [assignedQty, setAssignedQty] = useState(1);
  const [assignedMaterials, setAssignedMaterials] = useState<{ id: string; name: string; quantity: number; unit: string; unitCost: number }[]>([]);

  // Linking Documents to Projects
  const [projectDocuments, setProjectDocuments] = useState<{ id: string; name: string; filePath: string }[]>([]);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  // Project Settings Modal state
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [settingsName, setSettingsName] = useState(initialProject.name);
  const [settingsClient, setSettingsClient] = useState(initialProject.clientName || '');
  const [settingsDesc, setSettingsDesc] = useState(initialProject.description || '');
  const [settingsStatus, setSettingsStatus] = useState(initialProject.status);
  const [settingsBudget, setSettingsBudget] = useState(initialProject.budget);
  const [settingsDue, setSettingsDue] = useState(initialProject.dueDate ? initialProject.dueDate.split('T')[0] : '');

  // Edit Task Modal state
  const [editTaskModal, setEditTaskModal] = useState<ProjectTask | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState('medium');
  const [editTaskStatus, setEditTaskStatus] = useState('todo');
  const [editTaskAssignee, setEditTaskAssignee] = useState('');
  const [editTaskDue, setEditTaskDue] = useState('');

  // Custom Activity Notes state
  const [customNotes, setCustomNotes] = useState<{ id: string; author: string; initials: string; text: string; time: string }[]>([]);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Load everything on mount
  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      
      // Load company members
      const { data: cmData } = await supabase
        .from('company_members')
        .select('user_id, profiles(full_name)')
        .eq('company_id', membership?.companyId || '');
      if (cmData) {
        setAllCompanyMembers(cmData.map((m: any) => ({
          userId: m.user_id,
          fullName: m.profiles?.full_name ?? 'Unknown',
        })));
      }

      // Load inventory items
      const { data: invData } = await supabase
        .from('inventory_items')
        .select('id, name, unit, current_stock, unit_cost')
        .eq('company_id', membership?.companyId || '');
      if (invData) {
        setAllInventoryItems(invData.map((i: any) => ({
          id: i.id,
          name: i.name,
          unit: i.unit ?? 'pcs',
          currentStock: Number(i.current_stock) || 0,
          unitCost: Number(i.unit_cost) || 0,
        })));
      }

      // Load project documents
      const { data: docData } = await supabase
        .from('documents')
        .select('id, name, file_path')
        .eq('project_id', project.id);
      if (docData) {
        setProjectDocuments(docData.map((d: any) => ({
          id: d.id,
          name: d.name,
          filePath: d.file_path,
        })));
      }

      // Load project financial payments
      const { data: payData } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', project.id);
      if (payData) {
        setPaymentsList(payData.map((p: any) => ({
          id: p.id,
          title: p.title,
          type: p.type,
          amount: Number(p.amount) || 0,
          category: p.category,
          status: p.status,
          paymentDate: p.payment_date,
          notes: p.notes,
        })));
      }
    }

    if (membership?.companyId) {
      loadData();
      
      // Load assigned materials from project prop or fallback
      if (initialProject.assignedMaterials && initialProject.assignedMaterials.length > 0) {
        setAssignedMaterials(
          initialProject.assignedMaterials.map((m) => ({
            id: m.inventoryItemId,
            name: m.itemName,
            quantity: m.quantity,
            unit: m.unit,
            unitCost: m.unitCost ?? 0,
          }))
        );
      } else {
        const saved = localStorage.getItem(`assigned_materials_${project.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setAssignedMaterials(parsed.map((m: any) => ({ ...m, unitCost: m.unitCost ?? 0 })));
        }
      }

      // Load custom activity notes from localStorage
      const savedNotes = localStorage.getItem(`project_notes_${project.id}`);
      if (savedNotes) {
        setCustomNotes(JSON.parse(savedNotes));
      }
    }
  }, [membership, project.id]);

  // Project member management
  async function handleAddProjectMember() {
    if (!selectedMemberId) return;
    const existing = project.members.some((m) => m.userId === selectedMemberId);
    if (existing) {
      alert('Member is already assigned to this project.');
      return;
    }
    const memberName = allCompanyMembers.find((m) => m.userId === selectedMemberId)?.fullName ?? 'Unknown';
    setProject((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          id: selectedMemberId,
          userId: selectedMemberId,
          fullName: memberName,
          avatarUrl: null,
          role: 'employee',
          jobTitle: null,
          joinedAt: new Date().toISOString(),
        },
      ],
    }));
    setShowAddMember(false);
    // Persist
    const { error } = await createClient().from('project_members').insert({
      project_id: project.id,
      user_id: selectedMemberId,
    });
    if (error) console.error(error);
    router.refresh();
  }

  async function handleRemoveProjectMember(memberUserId: string) {
    if (!confirm('Remove member from this project?')) return;
    setProject((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.userId !== memberUserId),
    }));
    const { error } = await createClient()
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', memberUserId);
    if (error) console.error(error);
    router.refresh();
  }

  // Material assignment with stock deduction and validation
  async function handleAssignMaterial() {
    if (!selectedMaterialId || assignedQty <= 0) return;
    const material = allInventoryItems.find((m) => m.id === selectedMaterialId);
    if (!material) return;

    if (assignedQty > material.currentStock) {
      alert(
        `Cannot assign ${assignedQty} ${material.unit} of "${material.name}".\n\nOnly ${material.currentStock} ${material.unit} currently available in inventory stock!`
      );
      return;
    }

    setBusy(true);
    const res = await assignInventoryToProjectAction(project.id, selectedMaterialId, assignedQty);
    setBusy(false);

    if (!res.success) {
      alert(res.error || 'Failed to assign inventory item.');
      return;
    }

    const existingIdx = assignedMaterials.findIndex((m) => m.id === selectedMaterialId);
    let updated;
    if (existingIdx > -1) {
      updated = assignedMaterials.map((m, idx) => idx === existingIdx ? { ...m, quantity: m.quantity + assignedQty } : m);
    } else {
      updated = [
        ...assignedMaterials,
        { id: material.id, name: material.name, quantity: assignedQty, unit: material.unit, unitCost: material.unitCost ?? 0 },
      ];
    }
    setAssignedMaterials(updated);
    localStorage.setItem(`assigned_materials_${project.id}`, JSON.stringify(updated));

    // Update local inventory stock view
    setAllInventoryItems((prev) =>
      prev.map((i) =>
        i.id === selectedMaterialId ? { ...i, currentStock: Math.max(0, i.currentStock - assignedQty) } : i
      )
    );

    setShowAssignMaterial(false);
    setSelectedMaterialId('');
    setAssignedQty(1);
    router.refresh();
  }

  async function handleUnassignMaterial(materialId: string) {
    const target = assignedMaterials.find((m) => m.id === materialId);
    if (!target) return;

    if (!confirm(`Remove "${target.name}" from project? This will restore ${target.quantity} ${target.unit} back to inventory stock.`)) {
      return;
    }

    setBusy(true);
    const res = await removeInventoryFromProjectAction(project.id, materialId);
    setBusy(false);

    if (!res.success) {
      alert(res.error || 'Failed to unassign inventory item.');
      return;
    }

    const updated = assignedMaterials.filter((m) => m.id !== materialId);
    setAssignedMaterials(updated);
    localStorage.setItem(`assigned_materials_${project.id}`, JSON.stringify(updated));

    // Restore stock in local state
    setAllInventoryItems((prev) =>
      prev.map((i) =>
        i.id === materialId ? { ...i, currentStock: i.currentStock + target.quantity } : i
      )
    );

    router.refresh();
  }

  // Document upload
  async function handleUploadDoc(event: React.FormEvent) {
    event.preventDefault();
    if (!docFile || !membership) return;
    setBusy(true);

    const supabase = createClient();
    const fileExt = docFile.name.split('.').pop();
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, docFile);

    if (uploadError) {
      alert(uploadError.message);
      setBusy(false);
      return;
    }

    const { data: docData, error: dbError } = await supabase
      .from('documents')
      .insert({
        company_id: membership.companyId,
        project_id: project.id,
        name: docName || docFile.name,
        file_path: filePath,
        mime_type: docFile.type,
        size_bytes: docFile.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    setBusy(false);
    if (dbError) {
      alert(dbError.message);
      return;
    }

    setProjectDocuments((prev) => [
      ...prev,
      { id: docData.id, name: docData.name, filePath: docData.file_path },
    ]);
    setShowUploadDoc(false);
    setDocName('');
    setDocFile(null);
  }

  // Sync with server data on refresh
  useEffect(() => {
    setProject(initialProject);
    setSettingsName(initialProject.name);
    setSettingsClient(initialProject.clientName || '');
    setSettingsDesc(initialProject.description || '');
    setSettingsStatus(initialProject.status);
    setSettingsBudget(initialProject.budget);
    setSettingsDue(initialProject.dueDate ? initialProject.dueDate.split('T')[0] : '');
  }, [initialProject]);

  const canManage = membership && ['owner', 'manager', 'engineer'].includes(membership.role);

  async function handleSaveProjectSettings(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    const updates = {
      name: settingsName.trim() || project.name,
      client_name: settingsClient.trim() || null,
      description: settingsDesc.trim() || null,
      status: settingsStatus,
      budget: settingsBudget,
      due_date: settingsDue || null,
    };

    setProject((prev) => ({
      ...prev,
      name: updates.name,
      clientName: updates.client_name,
      description: updates.description,
      status: updates.status,
      budget: updates.budget,
      dueDate: updates.due_date,
    }));

    setShowProjectSettings(false);
    setBusy(false);

    const { error } = await createClient().from('projects').update(updates).eq('id', project.id);
    if (error) console.error(error);
    router.refresh();
  }

  async function handleDeleteProject() {
    if (!confirm(`Delete project "${project.name}"? This will permanently remove all tasks and assignments.`)) return;
    setBusy(true);
    const { error } = await createClient().from('projects').delete().eq('id', project.id);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.push('/projects');
    router.refresh();
  }

  async function toggleTask(taskId: string, currentStatus: string) {
    const next = currentStatus === 'done' ? 'todo' : 'done';
    updateTaskStatus(taskId, next);
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    setProject((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      if (!target) return prev;
      const oldStatus = target.status;
      if (oldStatus === newStatus) return prev;

      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        stats: {
          ...prev.stats,
          completedTasks: newStatus === 'done' ? prev.stats.completedTasks + 1 : oldStatus === 'done' ? prev.stats.completedTasks - 1 : prev.stats.completedTasks,
          inProgressTasks: newStatus === 'in_progress' ? prev.stats.inProgressTasks + 1 : oldStatus === 'in_progress' ? prev.stats.inProgressTasks - 1 : prev.stats.inProgressTasks,
          todoTasks: newStatus === 'todo' ? prev.stats.todoTasks + 1 : oldStatus === 'todo' ? prev.stats.todoTasks - 1 : prev.stats.todoTasks,
        },
      };
    });

    const { error } = await createClient().from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (error) console.error(error);
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title || !membership) return;
    setShowNewTask(false);
    const tempId = 'tmp-' + Date.now();
    const selectedAssignee = taskAssigneeId
      ? {
          id: taskAssigneeId,
          fullName: project.members.find((m) => m.userId === taskAssigneeId)?.fullName ?? 'Unknown',
          avatarUrl: null
        }
      : null;
    const newTaskObj: ProjectTask = {
      id: tempId,
      title,
      description: taskDescription || null,
      status: 'todo',
      priority: taskPriority,
      dueDate: taskDue || null,
      assignee: selectedAssignee,
      createdAt: new Date().toISOString(),
    };
    setProject((prev) => ({
      ...prev,
      tasks: [newTaskObj, ...prev.tasks],
      stats: { ...prev.stats, totalTasks: prev.stats.totalTasks + 1, todoTasks: prev.stats.todoTasks + 1 },
    }));
    setNewTask('');
    setTaskDescription('');
    setTaskDue('');
    setTaskPriority('medium');
    setTaskAssigneeId('');
    const { error } = await createClient().from('tasks').insert({
      company_id: membership.companyId,
      project_id: project.id,
      title,
      description: taskDescription || null,
      priority: taskPriority,
      due_date: taskDue || null,
      assignee_id: taskAssigneeId || null,
      status: 'todo',
    });
    if (error) console.error(error);
    router.refresh();
  }

  async function handleUpdateTask(event: React.FormEvent) {
    event.preventDefault();
    if (!editTaskModal) return;
    const updatedTask = {
      title: editTaskTitle.trim() || editTaskModal.title,
      description: editTaskDesc.trim() || null,
      priority: editTaskPriority,
      status: editTaskStatus,
      due_date: editTaskDue || null,
      assignee_id: editTaskAssignee || null,
    };

    const selectedAssignee = editTaskAssignee
      ? {
          id: editTaskAssignee,
          fullName: project.members.find((m) => m.userId === editTaskAssignee)?.fullName ?? 'Unknown',
          avatarUrl: null,
        }
      : null;

    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === editTaskModal.id
          ? {
              ...t,
              title: updatedTask.title,
              description: updatedTask.description,
              priority: updatedTask.priority,
              status: updatedTask.status,
              dueDate: updatedTask.due_date,
              assignee: selectedAssignee,
            }
          : t
      ),
    }));

    const targetId = editTaskModal.id;
    setEditTaskModal(null);
    const { error } = await createClient().from('tasks').update(updatedTask).eq('id', targetId);
    if (error) console.error(error);
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return;
    setProject((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
        stats: {
          ...prev.stats,
          totalTasks: prev.stats.totalTasks - 1,
          completedTasks: task?.status === 'done' ? prev.stats.completedTasks - 1 : prev.stats.completedTasks,
          todoTasks: task?.status === 'todo' ? prev.stats.todoTasks - 1 : prev.stats.todoTasks,
          inProgressTasks: task?.status === 'in_progress' ? prev.stats.inProgressTasks - 1 : prev.stats.inProgressTasks,
        },
      };
    });
    const { error } = await createClient().from('tasks').delete().eq('id', taskId);
    if (error) console.error(error);
  }

  function handleAddCustomNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const newNote = {
      id: 'note-' + Date.now(),
      author: user.fullName,
      initials: getInitials(user.fullName),
      text: noteText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const nextNotes = [newNote, ...customNotes];
    setCustomNotes(nextNotes);
    localStorage.setItem(`project_notes_${project.id}`, JSON.stringify(nextNotes));
    setNoteText('');
    setShowAddNoteModal(false);
  }

  async function handleCreatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentTitle.trim() || paymentAmount <= 0) return;
    setBusy(true);

    const res = await createProjectPaymentAction({
      projectId: project.id,
      title: paymentTitle,
      type: paymentType,
      amount: paymentAmount,
      category: paymentCategory,
      status: paymentStatus,
      notes: paymentNotes,
    });

    setBusy(false);
    if (!res.success) {
      alert(res.error || 'Failed to record transaction.');
      return;
    }

    if (res.payment) {
      setPaymentsList((prev) => [
        {
          id: res.payment!.id,
          title: res.payment!.title,
          type: res.payment!.type,
          amount: res.payment!.amount,
          category: res.payment!.category,
          status: res.payment!.status,
          paymentDate: res.payment!.paymentDate,
          notes: res.payment!.notes || undefined,
        },
        ...prev,
      ]);
    }

    setPaymentTitle('');
    setPaymentAmount(0);
    setPaymentNotes('');
    setShowAddPaymentModal(false);
    router.refresh();
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('Delete this payment transaction record?')) return;
    setBusy(true);
    const res = await deleteProjectPaymentAction(paymentId, project.id);
    setBusy(false);
    if (!res.success) {
      alert(res.error || 'Failed to delete payment record.');
      return;
    }
    setPaymentsList((prev) => prev.filter((p) => p.id !== paymentId));
    router.refresh();
  }

  function downloadProjectReport() {
    const reportContent = `PROJECT OPERATIONS REPORT: ${project.name.toUpperCase()}
===================================================
Client: ${project.clientName || 'Internal'}
Status: ${project.status.toUpperCase()} (${project.progress}% Complete)
Budget: €${project.budget.toLocaleString()}
Due Date: ${project.dueDate ? project.dueDate.split('T')[0] : 'Not specified'}
Created At: ${project.createdAt.split('T')[0]}

TEAM MEMBERS (${project.members.length}):
${project.members.map((m) => `- ${m.fullName} (${m.role})`).join('\n')}

TASKS SUMMARY (${project.stats.completedTasks}/${project.stats.totalTasks} Done):
${project.tasks.map((t) => `[${t.status.toUpperCase()}] ${t.title} ${t.assignee ? `(Assignee: ${t.assignee.fullName})` : ''}`).join('\n')}

ALLOCATED MATERIALS ON SITE (${assignedMaterials.length}):
${assignedMaterials.map((m) => `- ${m.name}: ${m.quantity} ${m.unit}`).join('\n')}
===================================================
Report generated on ${new Date().toLocaleDateString()} via ConstructOS Operations System`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${project.name.replace(/\s+/g, '_')}_Report.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredTasks = project.tasks.filter((t) =>
    (t.title + ' ' + (t.description ?? '')).toLowerCase().includes(taskQuery.toLowerCase())
  );

  // Material cost calculation (quantity * unitCost)
  const totalMaterialCost = assignedMaterials.reduce((sum, m) => {
    const unitPrice = m.unitCost ?? 0;
    return sum + m.quantity * unitPrice;
  }, 0);

  // Labor cost calculation (members * average hourly baseline * estimated hours)
  const totalLaborCost = project.members.length * 35 * 40; // 35 eur/h * 40h estimate per member

  // Logged incomes and expenses
  const totalReceivedIncome = paymentsList
    .filter((p) => p.type === 'income' && p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalDirectExpenses = paymentsList
    .filter((p) => p.type === 'expense' && p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalIncurredProjectCost = totalMaterialCost + totalLaborCost + totalDirectExpenses;
  const projectNetProfit = (totalReceivedIncome > 0 ? totalReceivedIncome : project.budget) - totalIncurredProjectCost;
  const projectMarginPercent = project.budget > 0 ? Math.round((projectNetProfit / project.budget) * 100) : 0;

  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planning;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span>construct<strong>OS</strong></span>
        </div>
        <div className="company">
          <div className="company-logo">
            {(membership?.companyName ?? user.fullName).charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{membership?.companyName ?? 'Workspace'}</strong>
            <small>Workspace</small>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          <Link href="/" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Overview</span>
          </Link>
          <Link href="/projects" className="nav-item active" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Projects</span>
          </Link>
          <Link href="/people" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>People</span>
          </Link>
          <Link href="/inventory" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span>Inventory</span>
          </Link>
          <Link href="/documents" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Documents</span>
          </Link>
        </nav>
        <div className="nav-label market-label">Connect</div>
        <nav>
          <Link href="/marketplace" className="nav-item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>Marketplace</span>
          </Link>
          <a
            href="#"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-notifications'));
            }}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Bell size={18} />
            <span>Notifications</span>
            <b>3</b>
          </a>
        </nav>
        <div className="side-bottom">
          <a
            href="#"
            className="nav-item"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('open-settings'));
            }}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Settings size={18} />
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <main className="main">
        <header>
          <Link href="/projects" className="back-link" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeft size={20} />
            <span>Projects</span>
          </Link>
          <div className="crumb">
            {project.name} <span>/</span> <strong>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
          </div>
          <div className="header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <select
                value={lang}
                onChange={(e) => {
                  const newLang = e.target.value as Language;
                  setLang(newLang);
                  localStorage.setItem('lang', newLang);
                  window.dispatchEvent(new Event('storage'));
                }}
                style={{
                  border: '1px solid #edf0f3',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 12,
                  background: '#fff',
                  cursor: 'pointer',
                  color: '#3a4150',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="en">EN</option>
                <option value="sq">SQ</option>
                <option value="mk">MK</option>
              </select>
            </div>
            <button className="secondary" onClick={downloadProjectReport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={16} /> Export Report
            </button>
            {canManage && (
              <>
                <button className="secondary" onClick={() => setShowProjectSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Settings size={16} /> Settings
                </button>
                {activeTab === 'tasks' && (
                  <button className="primary" onClick={() => setShowNewTask(true)}>
                    <Plus size={17} /> Add task
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <div className="content">
          {/* Project Header */}
          <div className="project-header">
            <div className="project-header-main">
              <div className="project-status-badge" style={{ background: statusConfig.bg, color: statusConfig.color }}>
                <StatusIcon size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {statusConfig.label}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{project.name}</h1>
                {project.clientName && (
                  <p className="subhead" style={{ margin: '4px 0 0' }}>Client: {project.clientName}</p>
                )}
              </div>
            </div>
            <div className="project-progress">
              <div className="progress-ring">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="#e0e3e9"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke={statusConfig.color}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (project.progress / 100) * 213.6}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                  <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1a1d23">
                    {project.progress}%
                  </text>
                </svg>
              </div>
              <div className="project-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Budget</span>
                  <span className="meta-value"><DollarSign size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {formatBudget(project.budget)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Due date</span>
                  <span className="meta-value"><Calendar size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {project.dueDate ? formatDue(project.dueDate) : 'Not set'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Tasks</span>
                  <span className="meta-value">{project.stats.completedTasks} / {project.stats.totalTasks} done</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Team</span>
                  <span className="meta-value"><Users size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {project.members.length} members</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={activeTab === 'tasks' ? 'active' : ''}
              onClick={() => setActiveTab('tasks')}
            >
              Tasks <b>{project.stats.totalTasks}</b>
            </button>
            <button
              className={activeTab === 'team' ? 'active' : ''}
              onClick={() => setActiveTab('team')}
            >
              Team <b>{project.members.length}</b>
            </button>
            <button
              className={activeTab === 'finance' ? 'active' : ''}
              onClick={() => setActiveTab('finance')}
            >
              Finance & Costs
            </button>
            <button
              className={activeTab === 'activity' ? 'active' : ''}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Description</h2>
                      <p>Project overview and details</p>
                    </div>
                  </div>
                  <div className="description">
                    {project.description ? (
                      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{project.description}</p>
                    ) : (
                      <p className="subhead">No description added yet.</p>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Key metrics</h2>
                      <p>Project health at a glance</p>
                    </div>
                  </div>
                  <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Completion</span>
                        <div className="stat-icon blue"><CheckCircle size={18} /></div>
                      </div>
                      <strong>{project.stats.totalTasks > 0 ? Math.round((project.stats.completedTasks / project.stats.totalTasks) * 100) : 0}%</strong>
                      <p><span className="up">{project.stats.completedTasks} of {project.stats.totalTasks} tasks</span></p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>In progress</span>
                        <div className="stat-icon orange"><Clock size={18} /></div>
                      </div>
                      <strong>{project.stats.inProgressTasks}</strong>
                      <p><em>Tasks being worked on</em></p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>To do</span>
                        <div className="stat-icon gray"><FileText size={18} /></div>
                      </div>
                      <strong>{project.stats.todoTasks}</strong>
                      <p><em>Tasks not started</em></p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Budget</span>
                        <div className="stat-icon green"><DollarSign size={18} /></div>
                      </div>
                      <strong>{formatBudget(project.budget)}</strong>
                      <p><em>Total project budget</em></p>
                    </div>
                  </div>
                </section>
              </div>

              {canManage && (
                <div className="panel" style={{ marginTop: 24 }}>
                  <div className="panel-head">
                    <div>
                      <h2>Quick actions</h2>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => { setActiveTab('tasks'); setShowNewTask(true); }}>
                      <Plus size={16} /> Add task
                    </button>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => { setActiveTab('team'); setShowAddMember(true); }}>
                      <Users size={16} /> Invite member
                    </button>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowUploadDoc(true)}>
                      <FileText size={16} /> Upload document
                    </button>
                    <button className="secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowProjectSettings(true)}>
                      <Settings size={16} /> Project settings
                    </button>
                  </div>
                </div>
              )}

              {/* Materials & Documents Panels */}
              <div className="dashboard-grid" style={{ marginTop: 24 }}>
                {/* Materials Panel */}
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>{t('inventory')} / Materials</h2>
                      <p>Materials currently allocated to this project</p>
                    </div>
                    {canManage && (
                      <button className="text-btn" onClick={() => setShowAssignMaterial(true)}>
                        <Plus size={14} /> Assign Material
                      </button>
                    )}
                  </div>
                  <div className="materials-list">
                    {assignedMaterials.length === 0 ? (
                      <p className="subhead">No materials allocated to this project yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {assignedMaterials.map((m) => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fb', padding: '10px 12px', borderRadius: 8 }}>
                            <div>
                              <strong style={{ fontSize: 13, color: '#202635' }}>{m.name}</strong>
                              <small style={{ display: 'block', color: '#9299a7', marginTop: 2 }}>Allocated resource</small>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#4e64da' }}>
                                {m.quantity} {m.unit}
                              </span>
                              {canManage && (
                                <button className="dots" onClick={() => handleUnassignMaterial(m.id)} style={{ color: '#ef766b', border: 0, background: 'none', cursor: 'pointer' }}>
                                  <X size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Documents Panel */}
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>{t('documents')}</h2>
                      <p>Linked files and records</p>
                    </div>
                    {canManage && (
                      <button className="text-btn" onClick={() => setShowUploadDoc(true)}>
                        <Plus size={14} /> Upload Doc
                      </button>
                    )}
                  </div>
                  <div className="documents-list">
                    {projectDocuments.length === 0 ? (
                      <p className="subhead">No documents linked to this project yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {projectDocuments.map((doc) => (
                          <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fb', padding: '10px 12px', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <FileText size={18} style={{ color: '#5267dc' }} />
                              <div>
                                <strong style={{ fontSize: 13, color: '#202635' }}>{doc.name}</strong>
                              </div>
                            </div>
                            <a href={`/documents`} className="text-btn" style={{ fontSize: 11 }}>
                              View <ArrowUpRight size={13} />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="tab-content">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Tasks</h2>
                    <p>{project.stats.todoTasks} to do, {project.stats.inProgressTasks} in progress, {project.stats.completedTasks} done</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                  <div className="search" style={{ flex: 1 }}>
                    <Search size={17} />
                    <input
                      value={taskQuery}
                      onChange={(e) => setTaskQuery(e.target.value)}
                      placeholder="Search tasks..."
                    />
                  </div>
                  <div style={{ display: 'flex', background: '#f0f2f5', padding: 3, borderRadius: 6, gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => setTaskViewMode('list')}
                      style={{
                        padding: '6px 12px',
                        border: 0,
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background: taskViewMode === 'list' ? '#fff' : 'none',
                        color: taskViewMode === 'list' ? '#1e2433' : '#68707d',
                        cursor: 'pointer',
                        boxShadow: taskViewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      List View
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskViewMode('kanban')}
                      style={{
                        padding: '6px 12px',
                        border: 0,
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background: taskViewMode === 'kanban' ? '#fff' : 'none',
                        color: taskViewMode === 'kanban' ? '#1e2433' : '#68707d',
                        cursor: 'pointer',
                        boxShadow: taskViewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      Kanban Board
                    </button>
                  </div>
                </div>

                {taskViewMode === 'kanban' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
                    {[
                      { key: 'todo', title: 'To Do', color: '#68707d' },
                      { key: 'in_progress', title: 'In Progress', color: '#5267dc' },
                      { key: 'done', title: 'Completed', color: '#43a47d' },
                    ].map((col) => {
                      const colTasks = filteredTasks.filter((t) => t.status === col.key);
                      return (
                        <div key={col.key} style={{ background: '#f8f9fe', border: '1px solid #edf0f4', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #edf0f4', paddingBottom: 8 }}>
                            <strong style={{ fontSize: 13, color: col.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                              {col.title}
                            </strong>
                            <span style={{ fontSize: 11, fontWeight: 700, background: '#fff', padding: '2px 8px', borderRadius: 10, color: col.color, border: '1px solid #edf0f4' }}>
                              {colTasks.length}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gap: 10, flex: 1, alignContent: 'start' }}>
                            {colTasks.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '20px 0', color: '#a0a6b0', fontSize: 12 }}>
                                No tasks in {col.title}
                              </div>
                            ) : (
                              colTasks.map((t) => {
                                const priorityCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
                                return (
                                  <div
                                    key={t.id}
                                    style={{
                                      background: '#fff',
                                      border: '1px solid #edf0f4',
                                      borderRadius: 6,
                                      padding: 12,
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                      display: 'grid',
                                      gap: 8,
                                    }}
                                  >
                                    <strong style={{ fontSize: 13, color: '#1e2433' }}>{t.title}</strong>
                                    {t.description && <p style={{ margin: 0, fontSize: 11, color: '#68707d', lineHeight: 1.4 }}>{t.description}</p>}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                      <span style={{ fontSize: 10, fontWeight: 600, color: priorityCfg.color, background: priorityCfg.color + '20', padding: '2px 6px', borderRadius: 4 }}>
                                        {priorityCfg.label}
                                      </span>
                                      {t.assignee && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#68707d' }}>
                                          <div className="avatar" style={{ width: 20, height: 20, fontSize: 9 }}>{getInitials(t.assignee.fullName)}</div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action buttons to move between columns */}
                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #edf0f4' }}>
                                      {col.key !== 'todo' && (
                                        <button
                                          type="button"
                                          onClick={() => updateTaskStatus(t.id, 'todo')}
                                          style={{ flex: 1, padding: '4px', fontSize: 10, border: '1px solid #e0e3e9', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          ← To Do
                                        </button>
                                      )}
                                      {col.key !== 'in_progress' && (
                                        <button
                                          type="button"
                                          onClick={() => updateTaskStatus(t.id, 'in_progress')}
                                          style={{ flex: 1, padding: '4px', fontSize: 10, border: '1px solid #dce3ff', background: '#eef1ff', color: '#5267dc', fontWeight: 600, borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Progress
                                        </button>
                                      )}
                                      {col.key !== 'done' && (
                                        <button
                                          type="button"
                                          onClick={() => updateTaskStatus(t.id, 'done')}
                                          style={{ flex: 1, padding: '4px', fontSize: 10, border: '1px solid #bbf7d0', background: '#eaf7f0', color: '#166534', fontWeight: 600, borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          ✓ Done
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#c4c9d3', marginBottom: 12 }}>
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                    </svg>
                    <p className="subhead">No tasks yet</p>
                    {canManage && (
                      <button className="primary" onClick={() => setShowNewTask(true)} style={{ marginTop: 12 }}>
                        <Plus size={16} /> Add your first task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="task-list">
                    {filteredTasks.map((t) => {
                      const statusCfg = TASK_STATUS_CONFIG[t.status];
                      const priorityCfg = PRIORITY_CONFIG[t.priority];
                      return (
                        <div key={t.id} className="task-row">
                          <button
                            className={'check ' + (t.status === 'done' ? 'checked' : '')}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTask(t.id, t.status); }}
                            aria-label={t.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {t.status === 'done' && <CheckCircle size={18} />}
                          </button>
                          <div className="task-content" style={{ flex: 1 }}>
                            <strong className={t.status === 'done' ? 'strike' : ''}>{t.title}</strong>
                            {t.description && <p className="subhead" style={{ margin: '4px 0 0', maxWidth: 500 }}>{t.description}</p>}
                            <div className="task-meta">
                              {t.assignee && (
                                <span className="assignee">
                                  <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{getInitials(t.assignee.fullName)}</div>
                                  {t.assignee.fullName}
                                </span>
                              )}
                              <span className="priority-badge" style={{ background: priorityCfg.color + '20', color: priorityCfg.color }}>
                                {priorityCfg.label}
                              </span>
                              <span className="status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                {statusCfg.label}
                              </span>
                              {t.dueDate && (
                                <span className={formatDue(t.dueDate) === 'Today' ? 'today' : ''}>
                                  <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                  {formatDue(t.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          {canManage && (
                            <div className="task-actions" style={{ opacity: 1 }}>
                              <button
                                className="icon-btn"
                                title="Edit Task"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditTaskModal(t);
                                  setEditTaskTitle(t.title);
                                  setEditTaskDesc(t.description || '');
                                  setEditTaskPriority(t.priority);
                                  setEditTaskStatus(t.status);
                                  setEditTaskAssignee(t.assignee?.id || '');
                                  setEditTaskDue(t.dueDate ? t.dueDate.split('T')[0] : '');
                                }}
                              >
                                <Edit size={16} />
                              </button>
                              <button className="icon-btn danger" title="Delete Task" onClick={(e) => { e.stopPropagation(); deleteTask(t.id); }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="tab-content">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Team members</h2>
                    <p>{project.members.length} member{project.members.length === 1 ? '' : 's'} on this project</p>
                  </div>
                  {canManage && (
                    <button className="secondary" onClick={() => setShowAddMember(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Plus size={16} /> Invite
                    </button>
                  )}
                </div>
                <div className="team-list">
                  {project.members.map((m) => (
                    <div key={m.userId} className="team-member">
                      <div className="avatar" style={{ background: '#8b72d9' }}>{getInitials(m.fullName)}</div>
                      <div>
                        <strong>{m.fullName}</strong>
                        <small style={{ textTransform: 'capitalize' }}>{m.role}</small>
                      </div>
                      {canManage && m.userId !== user.id && (
                        <button
                          className="icon-btn danger"
                          title="Remove member from project"
                          onClick={() => handleRemoveProjectMember(m.userId)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Finance & Costs Tab */}
          {activeTab === 'finance' && (
            <div className="tab-content">
              {/* Financial Health Summary Cards */}
              <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Contract Budget</span>
                    <div className="stat-icon green"><DollarSign size={18} /></div>
                  </div>
                  <strong>€{project.budget.toLocaleString()}</strong>
                  <p><span className="up">Agreed contract total</span></p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Incurred Costs</span>
                    <div className="stat-icon orange"><Clock size={18} /></div>
                  </div>
                  <strong>€{totalIncurredProjectCost.toLocaleString()}</strong>
                  <p><em>Materials + Labor + Direct Expenses</em></p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Payments Collected</span>
                    <div className="stat-icon blue"><DollarSign size={18} /></div>
                  </div>
                  <strong>€{totalReceivedIncome.toLocaleString()}</strong>
                  <p><span className="up">Of €{project.budget.toLocaleString()} total</span></p>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Net Margin</span>
                    <div className="stat-icon green"><CheckCircle size={18} /></div>
                  </div>
                  <strong style={{ color: projectNetProfit >= 0 ? '#166534' : '#dc2626' }}>
                    €{projectNetProfit.toLocaleString()}
                  </strong>
                  <p><span className={projectNetProfit >= 0 ? 'up' : 'attention'}>{projectMarginPercent}% Projected Return</span></p>
                </div>
              </div>

              {/* Deep Cost Breakdown Panel */}
              <div className="dashboard-grid" style={{ marginBottom: 24 }}>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Detailed Cost Breakdown</h2>
                      <p>Accurate site allocation & labor accounting</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8f9fe', borderRadius: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#1e2433' }}>📦 Material Costs ({assignedMaterials.length} allocated)</strong>
                        <small style={{ display: 'block', color: '#68707d', marginTop: 2 }}>Calculated from warehouse inventory unit costs</small>
                      </div>
                      <strong style={{ fontSize: 14, color: '#1e2433' }}>€{totalMaterialCost.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8f9fe', borderRadius: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#1e2433' }}>👷 Team Labor Expenses ({project.members.length} site team)</strong>
                        <small style={{ display: 'block', color: '#68707d', marginTop: 2 }}>Estimated 40h work per assigned member @ €35/h</small>
                      </div>
                      <strong style={{ fontSize: 14, color: '#1e2433' }}>€{totalLaborCost.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8f9fe', borderRadius: 8 }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#1e2433' }}>⚡ Direct Site Overhead & Equipment</strong>
                        <small style={{ display: 'block', color: '#68707d', marginTop: 2 }}>Invoices and subcontractor operational expenses</small>
                      </div>
                      <strong style={{ fontSize: 14, color: '#1e2433' }}>€{totalDirectExpenses.toLocaleString()}</strong>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Payments & Invoices</h2>
                      <p>Logged client payment receipts and site expenses</p>
                    </div>
                    {canManage && (
                      <button className="primary" onClick={() => setShowAddPaymentModal(true)} style={{ fontSize: 12, padding: '6px 12px' }}>
                        <Plus size={15} /> Log Payment
                      </button>
                    )}
                  </div>

                  {paymentsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#8f97a5', fontSize: 13 }}>
                      No financial payment receipts or expenses logged yet.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {paymentsList.map((pay) => (
                        <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: pay.type === 'income' ? '#f0fdf4' : '#fff1f0', border: `1px solid ${pay.type === 'income' ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 8 }}>
                          <div>
                            <strong style={{ fontSize: 13, color: pay.type === 'income' ? '#166534' : '#991b1b' }}>
                              {pay.type === 'income' ? '↗ ' : '↘ '} {pay.title}
                            </strong>
                            <small style={{ display: 'block', color: '#68707d', fontSize: 11, marginTop: 2 }}>
                              {pay.category.replace('_', ' ')} · {pay.paymentDate}
                            </small>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <strong style={{ fontSize: 14, color: pay.type === 'income' ? '#166534' : '#dc2626' }}>
                              {pay.type === 'income' ? '+' : '-'}€{pay.amount.toLocaleString()}
                            </strong>
                            {canManage && (
                              <button type="button" onClick={() => handleDeletePayment(pay.id)} style={{ border: 0, background: 'none', color: '#df7f73', cursor: 'pointer' }}>
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="tab-content">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent activity & Notes</h2>
                    <p>Updates, status changes, and team notes</p>
                  </div>
                  <button className="primary" onClick={() => setShowAddNoteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={15} /> Post Note
                  </button>
                </div>
                <div className="activity-feed" style={{ display: 'grid', gap: 12 }}>
                  {customNotes.map((note) => (
                    <div key={note.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#f8f9fe', border: '1px solid #edf0f4', borderRadius: 8 }}>
                      <div className="avatar purple" style={{ width: 34, height: 34 }}>{note.initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: 13, color: '#202635' }}>{note.author}</strong>
                          <small style={{ color: '#9aa1ad', fontSize: 10 }}>{note.time}</small>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#566070' }}>{note.text}</p>
                      </div>
                    </div>
                  ))}
                  <div className="activity-row" style={{ padding: '12px 0' }}>
                    <div className="avatar purple">{getInitials(user.fullName)}</div>
                    <p>
                      <strong>{user.fullName}</strong> created project <b>{project.name}</b>
                      <small>{formatDue(project.createdAt.split('T')[0])}</small>
                    </p>
                  </div>
                  <div className="activity-row" style={{ padding: '12px 0' }}>
                    <div className="avatar blue">T</div>
                    <p>
                      <strong>Team member</strong> added task or updated schedule
                      <small>Recently</small>
                    </p>
                  </div>
                  <div className="activity-row" style={{ padding: '12px 0' }}>
                    <div className="avatar green">M</div>
                    <p>
                      <strong>Maria Santos</strong> updated project status to <b>{statusConfig.label}</b>
                      <small>Earlier</small>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Project Settings Modal */}
        {showProjectSettings && (
          <div className="modal-backdrop" onClick={() => setShowProjectSettings(false)}>
            <form className="modal" onSubmit={handleSaveProjectSettings} onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 540px)' }}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Project Settings</p>
                  <h2>Configure & Manage Project</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowProjectSettings(false)} disabled={busy}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ gridColumn: 'span 2' }}>
                  Project Name <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    required
                    disabled={busy}
                  />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Client Name
                  <input
                    value={settingsClient}
                    onChange={(e) => setSettingsClient(e.target.value)}
                    placeholder="Internal / Client Corp"
                    disabled={busy}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={settingsStatus}
                    onChange={(e) => setSettingsStatus(e.target.value)}
                    disabled={busy}
                    style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    value={settingsDue}
                    onChange={(e) => setSettingsDue(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Budget (€)
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={settingsBudget}
                    onChange={(e) => setSettingsBudget(Number(e.target.value) || 0)}
                    disabled={busy}
                  />
                </label>
                <label style={{ gridColumn: 'span 2' }}>
                  Description
                  <textarea
                    value={settingsDesc}
                    onChange={(e) => setSettingsDesc(e.target.value)}
                    rows={3}
                    disabled={busy}
                    style={{ display: 'block', width: '100%', border: '1px solid #e0e3e9', borderRadius: 6, padding: '10px', marginTop: 8, font: "12px 'DM Sans'" }}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #edf0f4' }}>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  style={{
                    border: '1px solid #fde2ba',
                    background: '#fff0ef',
                    color: '#df7f73',
                    borderRadius: 7,
                    padding: '8px 12px',
                    font: "600 12px 'DM Sans'",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                  disabled={busy}
                >
                  <Trash2 size={15} /> Delete Project
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="secondary" onClick={() => setShowProjectSettings(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button className="primary" type="submit" disabled={busy || !settingsName.trim()}>
                    {busy ? <Loader2 size={16} className="spin" /> : null} Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Edit Task Modal */}
        {editTaskModal && (
          <div className="modal-backdrop" onClick={() => setEditTaskModal(null)}>
            <form className="modal" onSubmit={handleUpdateTask} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Tasks</p>
                  <h2>Edit Task Details</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setEditTaskModal(null)}>
                  <X size={18} />
                </button>
              </div>
              <label>
                Task title <span style={{ color: '#ef4444' }}>*</span>
                <input
                  autoFocus
                  value={editTaskTitle}
                  onChange={(e) => setEditTaskTitle(e.target.value)}
                  required
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Description
                <textarea
                  value={editTaskDesc}
                  onChange={(e) => setEditTaskDesc(e.target.value)}
                  rows={3}
                  style={{ display: 'block', width: '100%', border: '1px solid #e0e3e9', borderRadius: 6, padding: '10px', marginTop: 8, font: "12px 'DM Sans'" }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                <label>
                  Status
                  <select
                    value={editTaskStatus}
                    onChange={(e) => setEditTaskStatus(e.target.value)}
                    style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                  >
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={editTaskPriority}
                    onChange={(e) => setEditTaskPriority(e.target.value)}
                    style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label>
                  Assignee
                  <select
                    value={editTaskAssignee}
                    onChange={(e) => setEditTaskAssignee(e.target.value)}
                    style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                  >
                    <option value="">Unassigned</option>
                    {project.members.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.fullName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    type="date"
                    value={editTaskDue}
                    onChange={(e) => setEditTaskDue(e.target.value)}
                  />
                </label>
              </div>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setEditTaskModal(null)}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={!editTaskTitle.trim()}>
                  Save Task
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Post Note Modal */}
        {showAddNoteModal && (
          <div className="modal-backdrop" onClick={() => setShowAddNoteModal(false)}>
            <form className="modal" onSubmit={handleAddCustomNote} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Activity & Timeline</p>
                  <h2>Post Note to Project Feed</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowAddNoteModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <label>
                Note / Update text <span style={{ color: '#ef4444' }}>*</span>
                <textarea
                  autoFocus
                  required
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. Completed foundation pour on site B. Awaiting curing inspection tomorrow."
                  rows={4}
                  style={{ display: 'block', width: '100%', border: '1px solid #e0e3e9', borderRadius: 6, padding: '12px', marginTop: 8, font: "13px 'DM Sans'" }}
                />
              </label>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="secondary" onClick={() => setShowAddNoteModal(false)}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={!noteText.trim()}>
                  Post Update
                </button>
              </div>
            </form>
          </div>
        )}

        {/* New Task Modal */}
        {showNewTask && (
          <div className="modal-backdrop" onClick={() => setShowNewTask(false)}>
            <form className="modal" onSubmit={createTask} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Tasks</p>
                  <h2>Add a task</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowNewTask(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <label>
                Task title
                <input
                  autoFocus
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="e.g. Review concrete delivery schedule"
                  required
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Description (optional)
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={3}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 80,
                    border: '1px solid #e0e3e9',
                    borderRadius: 6,
                    padding: '10px',
                    marginTop: 8,
                    font: "12px 'DM Sans'",
                    resize: 'vertical',
                  }}
                />
              </label>
              <label style={{ marginTop: 16 }}>
                Priority
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 42,
                    border: '1px solid #e0e3e9',
                    borderRadius: 6,
                    padding: '0 10px',
                    marginTop: 8,
                    font: "12px 'DM Sans'",
                    background: '#fff',
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label style={{ marginTop: 16 }}>
                Assignee (optional)
                <select
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 42,
                    border: '1px solid #e0e3e9',
                    borderRadius: 6,
                    padding: '0 10px',
                    marginTop: 8,
                    font: "12px 'DM Sans'",
                    background: '#fff',
                  }}
                >
                  <option value="">Unassigned</option>
                  {project.members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ marginTop: 16 }}>
                Due date (optional)
                <input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowNewTask(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || !newTask.trim()}>
                  <Plus size={16} /> {busy ? 'Adding...' : 'Add task'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Project Member Modal */}
        {showAddMember && (
          <div className="modal-backdrop" onClick={() => setShowAddMember(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">{t('people')}</p>
                  <h2>Assign Member to Project</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowAddMember(false)}>
                  <X size={18} />
                </button>
              </div>
              <label>
                Select company member
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 42,
                    border: '1px solid #e0e3e9',
                    borderRadius: 6,
                    padding: '0 10px',
                    marginTop: 8,
                    font: "12px 'DM Sans'",
                    background: '#fff',
                  }}
                >
                  <option value="">Choose a member...</option>
                  {allCompanyMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.fullName}</option>
                  ))}
                </select>
              </label>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setShowAddMember(false)}>
                  Cancel
                </button>
                <button className="primary" onClick={handleAddProjectMember} disabled={!selectedMemberId}>
                  <Plus size={16} /> Add member
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Material Modal */}
        {showAssignMaterial && (
          <div className="modal-backdrop" onClick={() => setShowAssignMaterial(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">{t('inventory')}</p>
                  <h2>Allocate Material to Project</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowAssignMaterial(false)} disabled={busy}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <label>
                  Select material
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => {
                      setSelectedMaterialId(e.target.value);
                      const selected = allInventoryItems.find((m) => m.id === e.target.value);
                      if (selected && selected.currentStock > 0) {
                        setAssignedQty(1);
                      }
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 42,
                      border: '1px solid #e0e3e9',
                      borderRadius: 6,
                      padding: '0 10px',
                      marginTop: 8,
                      font: "12px 'DM Sans'",
                      background: '#fff',
                    }}
                  >
                    <option value="">Choose a material...</option>
                    {allInventoryItems.map((item) => (
                      <option key={item.id} value={item.id} disabled={item.currentStock <= 0}>
                        {item.name} ({item.unit}) — Available in stock: {item.currentStock} {item.unit} {item.currentStock <= 0 ? '(Out of stock)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedMaterialId && (() => {
                  const selectedMat = allInventoryItems.find((m) => m.id === selectedMaterialId);
                  if (!selectedMat) return null;
                  const isOver = assignedQty > selectedMat.currentStock;
                  return (
                    <div style={{ padding: '10px 12px', background: isOver ? '#fff1f0' : '#f0fdf4', borderRadius: 6, border: `1px solid ${isOver ? '#fca5a5' : '#bbf7d0'}`, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: isOver ? '#dc2626' : '#166534' }}>
                        Possessed stock: {selectedMat.currentStock} {selectedMat.unit}
                      </span>
                      {isOver && (
                        <p style={{ margin: '4px 0 0', color: '#b91c1c' }}>
                          ⚠️ Error: You can only assign the quantity that you possess ({selectedMat.currentStock} {selectedMat.unit}).
                        </p>
                      )}
                    </div>
                  );
                })()}

                <label>
                  Quantity to assign
                  <input
                    type="number"
                    min="1"
                    value={assignedQty}
                    onChange={(e) => setAssignedQty(Number(e.target.value) || 1)}
                  />
                </label>
              </div>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setShowAssignMaterial(false)} disabled={busy}>
                  Cancel
                </button>
                <button
                  className="primary"
                  onClick={handleAssignMaterial}
                  disabled={
                    busy ||
                    !selectedMaterialId ||
                    assignedQty <= 0 ||
                    (() => {
                      const mat = allInventoryItems.find((m) => m.id === selectedMaterialId);
                      return mat ? assignedQty > mat.currentStock : false;
                    })()
                  }
                >
                  {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Allocate resource
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Doc Modal */}
        {showUploadDoc && (
          <div className="modal-backdrop" onClick={() => setShowUploadDoc(false)}>
            <form className="modal" onSubmit={handleUploadDoc} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">{t('documents')}</p>
                  <h2>Upload and Link File</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowUploadDoc(false)} disabled={busy}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gap: 16 }}>
                <label>
                  File <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="file"
                    required
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    disabled={busy}
                    style={{ display: 'block', width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid #e0e3e9', borderRadius: 6, font: "12px 'DM Sans'" }}
                  />
                </label>
                <label>
                  Document Name (optional)
                  <input
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Leave empty to use file name"
                    disabled={busy}
                  />
                </label>
              </div>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setShowUploadDoc(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || !docFile}>
                  {busy ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Upload and Link
                </button>
              </div>
              <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </form>
          </div>
        )}

        {/* Log Payment / Expense Modal */}
        {showAddPaymentModal && (
          <div className="modal-backdrop" onClick={() => setShowAddPaymentModal(false)}>
            <form className="modal" onSubmit={handleCreatePayment} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <p className="eyebrow">Project Accounting</p>
                  <h2>Record Financial Transaction</h2>
                </div>
                <button type="button" className="modal-close" onClick={() => setShowAddPaymentModal(false)} disabled={busy}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <label>
                  Transaction Type
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setPaymentType('income'); setPaymentCategory('client_payment'); }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #e0e3e9',
                        background: paymentType === 'income' ? '#eaf7f0' : '#fff',
                        color: paymentType === 'income' ? '#166534' : '#313947',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ↗ Payment Received (Income)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentType('expense'); setPaymentCategory('materials'); }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #e0e3e9',
                        background: paymentType === 'expense' ? '#fff1f0' : '#fff',
                        color: paymentType === 'expense' ? '#991b1b' : '#313947',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ↘ Project Expense
                    </button>
                  </div>
                </label>

                <label>
                  Title / Reference <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    autoFocus
                    required
                    placeholder={paymentType === 'income' ? 'e.g. Client Milestone 1 Deposit' : 'e.g. Concrete Pump Rental Fee'}
                    value={paymentTitle}
                    onChange={(e) => setPaymentTitle(e.target.value)}
                    disabled={busy}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <label>
                    Amount (€) <span style={{ color: '#ef4444' }}>*</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentAmount || ''}
                      onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                      disabled={busy}
                    />
                  </label>

                  <label>
                    Category
                    <select
                      value={paymentCategory}
                      onChange={(e) => setPaymentCategory(e.target.value)}
                      disabled={busy}
                      style={{ display: 'block', width: '100%', height: 42, border: '1px solid #e0e3e9', borderRadius: 6, padding: '0 10px', marginTop: 8, font: "12px 'DM Sans'", background: '#fff' }}
                    >
                      {paymentType === 'income' ? (
                        <>
                          <option value="client_payment">Client Invoice / Payment</option>
                          <option value="deposit">Advance Deposit</option>
                          <option value="refund">Refund / Credit</option>
                        </>
                      ) : (
                        <>
                          <option value="materials">Materials & Supplies</option>
                          <option value="subcontractor">Subcontractor Fee</option>
                          <option value="equipment">Equipment & Rental</option>
                          <option value="permits">Permits & Licenses</option>
                          <option value="other">Other Overhead</option>
                        </>
                      )}
                    </select>
                  </label>
                </div>

                <label>
                  Notes / Payment Terms (optional)
                  <input
                    placeholder="e.g. Bank transfer reference #8492"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="secondary" onClick={() => setShowAddPaymentModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy || !paymentTitle.trim() || paymentAmount <= 0}>
                  {busy ? <Loader2 size={16} className="spin" /> : <DollarSign size={16} />} Record Transaction
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
