export interface SavedGearConfig {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  tire: string;
  gearset: string;
  final_drive: string;
  drop_gear: string;
  speedo_drive: string;
  max_rpm: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGearConfigInput {
  name: string;
  tire: string;
  gearset: string;
  final_drive: string;
  drop_gear: string;
  speedo_drive: string;
  max_rpm: number;
  is_public?: boolean;
}

export const useGearConfigs = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  const configs = useState<SavedGearConfig[]>('gear-configs', () => []);
  const loading = useState<boolean>('gear-configs-loading', () => false);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchConfigs = async () => {
    if (!user.value) return;
    loading.value = true;
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedGearConfig[]>('/api/gear-configs', { headers });
      configs.value = data;
    } catch (error) {
      console.error('Failed to fetch gear configs:', error);
    } finally {
      loading.value = false;
    }
  };

  const saveConfig = async (input: CreateGearConfigInput): Promise<SavedGearConfig | null> => {
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedGearConfig>('/api/gear-configs', {
        method: 'POST',
        headers,
        body: input,
      });
      configs.value.unshift(data);
      return data;
    } catch (error) {
      console.error('Failed to save gear config:', error);
      return null;
    }
  };

  const updateConfig = async (
    id: string,
    updates: Partial<CreateGearConfigInput & { is_public: boolean }>
  ): Promise<SavedGearConfig | null> => {
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedGearConfig>(`/api/gear-configs/${id}`, {
        method: 'PUT',
        headers,
        body: updates,
      });
      const index = configs.value.findIndex((c) => c.id === id);
      if (index !== -1) configs.value[index] = data;
      return data;
    } catch (error) {
      console.error('Failed to update gear config:', error);
      return null;
    }
  };

  const deleteConfig = async (id: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      await $fetch(`/api/gear-configs/${id}`, {
        method: 'DELETE',
        headers,
      });
      configs.value = configs.value.filter((c) => c.id !== id);
      return true;
    } catch (error) {
      console.error('Failed to delete gear config:', error);
      return false;
    }
  };

  const fetchPublicConfigs = async (userId: string): Promise<SavedGearConfig[]> => {
    try {
      return await $fetch<SavedGearConfig[]>(`/api/gear-configs/public/${userId}`);
    } catch (error) {
      console.error('Failed to fetch public gear configs:', error);
      return [];
    }
  };

  return {
    configs,
    loading,
    fetchConfigs,
    saveConfig,
    updateConfig,
    deleteConfig,
    fetchPublicConfigs,
  };
};
