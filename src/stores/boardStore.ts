import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

/* ─── Types ─── */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
}

export interface BoardGroup {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  collapsed?: boolean;
}

export interface BoardColumn {
  id: string;
  project_id: string;
  name: string;
  type: 'status' | 'person' | 'date' | 'text' | 'number' | 'checkbox' | 'priority' | 'timeline';
  width: number;
  sort_order: number;
  settings: Record<string, unknown> | null;
}

export interface Task {
  id: string;
  project_id: string;
  group_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  status?: string;
}

export interface TaskValue {
  id: string;
  task_id: string;
  column_id: string;
  value: string;
}

export interface StaffMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  permission_level: string | null;
  is_active: boolean;
  auth_user_id: string | null;
}

/* ─── Store ─── */
interface BoardState {
  projects: Project[];
  currentProjectId: string | null;
  groups: BoardGroup[];
  columns: BoardColumn[];
  tasks: Task[];
  taskValues: Record<string, Record<string, string>>;
  staff: StaffMember[];
  loading: boolean;
  selectedTasks: Record<string, boolean>;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  searchQuery: string;
  collapsedGroups: Record<string, boolean>;

  // Actions
  loadProjects: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  loadBoardData: (projectId: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  toggleSort: (colId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;
  toggleTaskSelection: (taskId: string) => void;
  selectAllTasks: (selected: boolean) => void;
  clearSelection: () => void;

  // CRUD
  addTask: (groupId: string, title: string) => Promise<void>;
  updateTaskTitle: (taskId: string, title: string) => Promise<void>;
  updateCellValue: (taskId: string, columnId: string, value: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  deleteTasks: (taskIds: string[]) => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  updateGroupName: (groupId: string, name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  addColumn: (name: string, type: BoardColumn['type']) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<string | null>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  groups: [],
  columns: [],
  tasks: [],
  taskValues: {},
  staff: [],
  loading: false,
  selectedTasks: {},
  sortCol: null,
  sortDir: 'asc',
  searchQuery: '',
  collapsedGroups: {},

  loadProjects: async () => {
    const { data } = await supabase
      .from('hq_projects')
      .select('*')
      .order('created_at', { ascending: false });
    const projects = data || [];
    set({ projects });
    if (projects.length > 0 && !get().currentProjectId) {
      await get().selectProject(projects[0].id);
    }
  },

  selectProject: async (projectId: string) => {
    set({ currentProjectId: projectId, searchQuery: '', selectedTasks: {}, sortCol: null });
    await get().loadBoardData(projectId);
  },

  loadBoardData: async (projectId: string) => {
    set({ loading: true });
    try {
      const [groupsRes, colsRes, tasksRes, staffRes] = await Promise.all([
        supabase.from('hq_board_groups').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('hq_board_columns').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('hq_tasks').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('corporate_staff').select('id, email, first_name, last_name, permission_level, is_active, auth_user_id').eq('is_active', true),
      ]);

      const groups = groupsRes.data || [];
      const columns = colsRes.data || [];
      const tasks = tasksRes.data || [];
      const staff = staffRes.data || [];

      // Fetch task values
      const taskIds = tasks.map(t => t.id);
      let taskValues: Record<string, Record<string, string>> = {};
      if (taskIds.length > 0) {
        const { data: vals } = await supabase
          .from('hq_task_values')
          .select('*')
          .in('task_id', taskIds);
        if (vals) {
          for (const v of vals) {
            if (!taskValues[v.task_id]) taskValues[v.task_id] = {};
            taskValues[v.task_id][v.column_id] = v.value;
          }
        }
      }

      set({ groups, columns, tasks, taskValues, staff, loading: false });
    } catch (err) {
      console.error('[boardStore] loadBoardData error:', err);
      set({ loading: false });
      toast.error('Failed to load board data');
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleSort: (colId) =>
    set((s) => {
      if (s.sortCol === colId) {
        return { sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' };
      }
      return { sortCol: colId, sortDir: 'asc' };
    }),

  toggleGroupCollapse: (groupId) =>
    set((s) => ({
      collapsedGroups: { ...s.collapsedGroups, [groupId]: !s.collapsedGroups[groupId] },
    })),

  toggleTaskSelection: (taskId) =>
    set((s) => {
      const next = { ...s.selectedTasks };
      if (next[taskId]) delete next[taskId];
      else next[taskId] = true;
      return { selectedTasks: next };
    }),

  selectAllTasks: (selected) =>
    set((s) => {
      if (!selected) return { selectedTasks: {} };
      const next: Record<string, boolean> = {};
      s.tasks.forEach((t) => { next[t.id] = true; });
      return { selectedTasks: next };
    }),

  clearSelection: () => set({ selectedTasks: {} }),

  addTask: async (groupId, title) => {
    const { currentProjectId, tasks } = get();
    if (!currentProjectId) return;
    const maxOrder = tasks
      .filter(t => t.group_id === groupId)
      .reduce((m, t) => Math.max(m, t.sort_order || 0), 0);

    const { data, error } = await supabase
      .from('hq_tasks')
      .insert({
        project_id: currentProjectId,
        group_id: groupId,
        title,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to add item'); return; }
    if (data) set((s) => ({ tasks: [...s.tasks, data] }));
  },

  updateTaskTitle: async (taskId, title) => {
    const { error } = await supabase
      .from('hq_tasks')
      .update({ title })
      .eq('id', taskId);
    if (error) { toast.error('Failed to update'); return; }
    set((s) => ({
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, title } : t),
    }));
  },

  updateCellValue: async (taskId, columnId, value) => {
    // Optimistic update
    set((s) => {
      const tv = { ...s.taskValues };
      if (!tv[taskId]) tv[taskId] = {};
      tv[taskId] = { ...tv[taskId], [columnId]: value };
      return { taskValues: tv };
    });

    const { error } = await supabase
      .from('hq_task_values')
      .upsert(
        { task_id: taskId, column_id: columnId, value },
        { onConflict: 'task_id,column_id' }
      );

    if (error) {
      toast.error('Failed to save');
      console.error('[updateCellValue]', error);
    }
  },

  deleteTask: async (taskId) => {
    const { error } = await supabase.from('hq_tasks').delete().eq('id', taskId);
    if (error) { toast.error('Failed to delete'); return; }
    set((s) => ({
      tasks: s.tasks.filter(t => t.id !== taskId),
      selectedTasks: (() => { const n = { ...s.selectedTasks }; delete n[taskId]; return n; })(),
    }));
  },

  deleteTasks: async (taskIds) => {
    const { error } = await supabase.from('hq_tasks').delete().in('id', taskIds);
    if (error) { toast.error('Failed to delete'); return; }
    set((s) => ({
      tasks: s.tasks.filter(t => !taskIds.includes(t.id)),
      selectedTasks: {},
    }));
  },

  addGroup: async (name) => {
    const { currentProjectId, groups } = get();
    if (!currentProjectId) return;
    const colors = ['#579bfc', '#fdab3d', '#00c875', '#e2445c', '#a25ddc', '#0086c0', '#ff642e'];
    const maxOrder = groups.reduce((m, g) => Math.max(m, g.sort_order || 0), 0);

    const { data, error } = await supabase
      .from('hq_board_groups')
      .insert({
        project_id: currentProjectId,
        name,
        color: colors[groups.length % colors.length],
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to add group'); return; }
    if (data) set((s) => ({ groups: [...s.groups, data] }));
  },

  updateGroupName: async (groupId, name) => {
    const { error } = await supabase.from('hq_board_groups').update({ name }).eq('id', groupId);
    if (error) { toast.error('Failed to update group'); return; }
    set((s) => ({
      groups: s.groups.map(g => g.id === groupId ? { ...g, name } : g),
    }));
  },

  deleteGroup: async (groupId) => {
    const { error } = await supabase.from('hq_board_groups').delete().eq('id', groupId);
    if (error) { toast.error('Failed to delete group'); return; }
    set((s) => ({
      groups: s.groups.filter(g => g.id !== groupId),
      tasks: s.tasks.filter(t => t.group_id !== groupId),
    }));
  },

  addColumn: async (name, type) => {
    const { currentProjectId, columns } = get();
    if (!currentProjectId) return;
    const maxOrder = columns.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
    const widthMap: Record<string, number> = {
      status: 140, person: 120, date: 130, text: 180, number: 100, checkbox: 80, priority: 140, timeline: 200,
    };

    const { data, error } = await supabase
      .from('hq_board_columns')
      .insert({
        project_id: currentProjectId,
        name,
        type,
        width: widthMap[type] || 150,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to add column'); return; }
    if (data) set((s) => ({ columns: [...s.columns, data] }));
  },

  deleteColumn: async (columnId) => {
    const { error } = await supabase.from('hq_board_columns').delete().eq('id', columnId);
    if (error) { toast.error('Failed to delete column'); return; }
    set((s) => ({ columns: s.columns.filter(c => c.id !== columnId) }));
  },

  createProject: async (name, description) => {
    const { data, error } = await supabase
      .from('hq_projects')
      .insert({ name, description: description || null })
      .select()
      .single();

    if (error) { toast.error('Failed to create board'); return null; }
    if (data) {
      set((s) => ({ projects: [data, ...s.projects] }));
      return data.id;
    }
    return null;
  },

  deleteProject: async (projectId) => {
    const { error } = await supabase.from('hq_projects').delete().eq('id', projectId);
    if (error) { toast.error('Failed to delete board'); return; }
    const { projects } = get();
    const remaining = projects.filter(p => p.id !== projectId);
    set({ projects: remaining, currentProjectId: remaining[0]?.id ?? null });
    if (remaining.length > 0) {
      await get().loadBoardData(remaining[0].id);
    }
  },
}));
