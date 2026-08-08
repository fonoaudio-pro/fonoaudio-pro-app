import { supabase } from '../utils/supabaseClient';

export type UserRole = 'admin' | 'profesional' | 'secretaria' | 'supervisor';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  consultorio_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ProfileService = {
  async getCurrent(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('[ProfileService] Error fetching profile:', error.message);
      return null;
    }
    return data;
  },

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async getAll(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (error) throw error;
    return data || [];
  },

  async updateRole(id: string, role: UserRole): Promise<void> {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const resp = await fetch(`${backendUrl}/api/admin/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, role }),
      });
      if (resp.ok) return;
    } catch (e) {
      console.warn('[ProfileService] Backend updateRole failed, trying direct Supabase:', e);
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async updateConsultorios(id: string, consultorio_ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ consultorio_ids, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async updateProfile(id: string, updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'is_active'>>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },
};
