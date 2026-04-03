import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface FamilyMember {
  id: string;
  created_at: string;
  owner_id: string | null;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  avatar_url: string | null;
  notes: string | null;
}

export interface Restriction {
  id: string;
  created_at: string;
  member_id: string;
  restriction_type: string;
  item_name: string;
  severity: string;
  reaction: string | null;
  notes: string | null;
  source: string;
  source_report_id: string | null;
  confirmed: boolean;
}

export interface HealthReport {
  id: string;
  created_at: string;
  member_id: string;
  report_type: string;
  report_date: string | null;
  title: string;
  file_url: string | null;
  storage_type: string;
  file_mime_type: string | null;
  ai_summary: string | null;
  structured_data: Record<string, unknown> | null;
  body_regions: string[] | null;
  processing_status: string;
}

export interface HealthMetric {
  id: string;
  member_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  status: string | null;
  ref_range_low: number | null;
  ref_range_high: number | null;
  body_region: string | null;
  recorded_date: string;
  source: string;
}

export interface Vital {
  id: string;
  member_id: string;
  vital_type: string;
  value_primary: number;
  value_secondary: number | null;
  unit: string | null;
  recorded_at: string;
  source: string;
  notes: string | null;
}

export type RegionStatus = 'normal' | 'warning' | 'critical' | 'nodata';

interface HealthState {
  familyMembers: FamilyMember[];
  activeMemberId: string | null;
  reports: HealthReport[];
  restrictions: Restriction[];
  metrics: HealthMetric[];
  vitals: Vital[];
  regionHealthMap: Record<string, RegionStatus>;
  loading: boolean;

  loadFamilyMembers: () => Promise<void>;
  setActiveMember: (id: string) => void;
  loadMemberData: (memberId: string) => Promise<void>;
  addFamilyMember: (member: Partial<FamilyMember>) => Promise<void>;
  updateFamilyMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  deleteFamilyMember: (id: string) => Promise<void>;
  addRestriction: (r: Partial<Restriction>) => Promise<void>;
  updateRestriction: (id: string, updates: Partial<Restriction>) => Promise<void>;
  deleteRestriction: (id: string) => Promise<void>;
  computeRegionHealth: () => void;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  familyMembers: [],
  activeMemberId: null,
  reports: [],
  restrictions: [],
  metrics: [],
  vitals: [],
  regionHealthMap: {},
  loading: false,

  loadFamilyMembers: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Failed to load family members');
      set({ loading: false });
      return;
    }

    const members = data ?? [];
    set({ familyMembers: members, loading: false });

    // Auto-select first member if none selected
    if (!get().activeMemberId && members.length > 0) {
      set({ activeMemberId: members[0].id });
      get().loadMemberData(members[0].id);
    }
  },

  setActiveMember: (id: string) => {
    set({ activeMemberId: id });
    get().loadMemberData(id);
  },

  loadMemberData: async (memberId: string) => {
    const [reportsRes, restrictionsRes, metricsRes, vitalsRes] = await Promise.all([
      supabase.from('health_reports').select('*').eq('member_id', memberId).order('report_date', { ascending: false }),
      supabase.from('restrictions').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('health_metrics').select('*').eq('member_id', memberId).order('recorded_date', { ascending: false }).limit(200),
      supabase.from('vitals').select('*').eq('member_id', memberId).order('recorded_at', { ascending: false }).limit(100),
    ]);

    set({
      reports: reportsRes.data ?? [],
      restrictions: restrictionsRes.data ?? [],
      metrics: metricsRes.data ?? [],
      vitals: vitalsRes.data ?? [],
    });

    get().computeRegionHealth();
  },

  addFamilyMember: async (member: Partial<FamilyMember>) => {
    const { error } = await supabase.from('family_members').insert(member);
    if (error) {
      toast.error('Failed to add family member');
      return;
    }
    toast.success('Family member added');
    get().loadFamilyMembers();
  },

  updateFamilyMember: async (id: string, updates: Partial<FamilyMember>) => {
    const { error } = await supabase.from('family_members').update(updates).eq('id', id);
    if (error) {
      toast.error('Failed to update family member');
      return;
    }
    toast.success('Family member updated');
    get().loadFamilyMembers();
  },

  deleteFamilyMember: async (id: string) => {
    const { error } = await supabase.from('family_members').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete family member');
      return;
    }
    toast.success('Family member deleted');
    const members = get().familyMembers.filter(m => m.id !== id);
    set({ familyMembers: members });
    if (get().activeMemberId === id) {
      const next = members[0]?.id ?? null;
      set({ activeMemberId: next });
      if (next) get().loadMemberData(next);
    }
  },

  addRestriction: async (r: Partial<Restriction>) => {
    const { error } = await supabase.from('restrictions').insert(r);
    if (error) {
      toast.error('Failed to add restriction');
      return;
    }
    toast.success('Restriction added');
    const memberId = get().activeMemberId;
    if (memberId) get().loadMemberData(memberId);
  },

  updateRestriction: async (id: string, updates: Partial<Restriction>) => {
    const { error } = await supabase.from('restrictions').update(updates).eq('id', id);
    if (error) {
      toast.error('Failed to update restriction');
      return;
    }
    toast.success('Restriction updated');
    const memberId = get().activeMemberId;
    if (memberId) get().loadMemberData(memberId);
  },

  deleteRestriction: async (id: string) => {
    const { error } = await supabase.from('restrictions').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete restriction');
      return;
    }
    toast.success('Restriction deleted');
    const memberId = get().activeMemberId;
    if (memberId) get().loadMemberData(memberId);
  },

  computeRegionHealth: () => {
    const metrics = get().metrics;
    const regionMap: Record<string, RegionStatus> = {};
    const regionMetrics: Record<string, string[]> = {};

    for (const m of metrics) {
      if (!m.body_region) continue;
      if (!regionMetrics[m.body_region]) regionMetrics[m.body_region] = [];
      if (m.status) regionMetrics[m.body_region].push(m.status);
    }

    for (const [region, statuses] of Object.entries(regionMetrics)) {
      if (statuses.includes('critical')) {
        regionMap[region] = 'critical';
      } else if (statuses.includes('high') || statuses.includes('low')) {
        regionMap[region] = 'warning';
      } else {
        regionMap[region] = 'normal';
      }
    }

    set({ regionHealthMap: regionMap });
  },
}));
