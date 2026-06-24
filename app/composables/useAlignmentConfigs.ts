import type { AlignmentValues } from '~~/data/models/alignment';

/** A single dated entry in a config's driving journal. */
export interface JournalEntry {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  body: string;
}

export interface SavedAlignmentConfig {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  front_camber: number;
  front_caster: number;
  front_toe: number;
  rear_camber: number;
  rear_toe: number;
  wheel_size: string | null;
  preset: string | null;
  notes: string | null;
  journal: JournalEntry[];
  created_at: string;
  updated_at: string;
}

export interface CreateAlignmentConfigInput {
  name: string;
  front_camber: number;
  front_caster: number;
  front_toe: number;
  rear_camber: number;
  rear_toe: number;
  wheel_size?: string | null;
  preset?: string | null;
  notes?: string | null;
  journal?: JournalEntry[];
  is_public?: boolean;
}

/** Map the tool's camelCase values to the snake_case columns. */
export function alignmentValuesToColumns(v: AlignmentValues) {
  return {
    front_camber: v.frontCamber,
    front_caster: v.frontCaster,
    front_toe: v.frontToe,
    rear_camber: v.rearCamber,
    rear_toe: v.rearToe,
  };
}

/** Map a saved row back to the tool's camelCase values. */
export function columnsToAlignmentValues(c: SavedAlignmentConfig): AlignmentValues {
  return {
    frontCamber: c.front_camber,
    frontCaster: c.front_caster,
    frontToe: c.front_toe,
    rearCamber: c.rear_camber,
    rearToe: c.rear_toe,
  };
}

export const useAlignmentConfigs = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  const configs = useState<SavedAlignmentConfig[]>('alignment-configs', () => []);
  const loading = useState<boolean>('alignment-configs-loading', () => false);

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
      const data = await $fetch<SavedAlignmentConfig[]>('/api/alignment-configs', { headers });
      configs.value = data;
    } catch (error) {
      console.error('Failed to fetch alignment configs:', error);
    } finally {
      loading.value = false;
    }
  };

  const saveConfig = async (input: CreateAlignmentConfigInput): Promise<SavedAlignmentConfig | null> => {
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedAlignmentConfig>('/api/alignment-configs', {
        method: 'POST',
        headers,
        body: input,
      });
      configs.value.unshift(data);
      return data;
    } catch (error) {
      console.error('Failed to save alignment config:', error);
      return null;
    }
  };

  const updateConfig = async (
    id: string,
    updates: Partial<CreateAlignmentConfigInput & { is_public: boolean }>
  ): Promise<SavedAlignmentConfig | null> => {
    try {
      const headers = await getAuthHeaders();
      const data = await $fetch<SavedAlignmentConfig>(`/api/alignment-configs/${id}`, {
        method: 'PUT',
        headers,
        body: updates,
      });
      const index = configs.value.findIndex((c) => c.id === id);
      if (index !== -1) configs.value[index] = data;
      return data;
    } catch (error) {
      console.error('Failed to update alignment config:', error);
      return null;
    }
  };

  const deleteConfig = async (id: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      await $fetch(`/api/alignment-configs/${id}`, { method: 'DELETE', headers });
      configs.value = configs.value.filter((c) => c.id !== id);
      return true;
    } catch (error) {
      console.error('Failed to delete alignment config:', error);
      return false;
    }
  };

  const fetchPublicConfigs = async (userId: string): Promise<SavedAlignmentConfig[]> => {
    try {
      return await $fetch<SavedAlignmentConfig[]>(`/api/alignment-configs/public/${userId}`);
    } catch (error) {
      console.error('Failed to fetch public alignment configs:', error);
      return [];
    }
  };

  // ---- Journal helpers (driving notes over time) ----
  // Each mutation recomputes the journal array and persists it via updateConfig.

  const addJournalEntry = async (id: string, body: string): Promise<SavedAlignmentConfig | null> => {
    const config = configs.value.find((c) => c.id === id);
    if (!config) return null;
    const entry: JournalEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      date: new Date().toISOString().slice(0, 10),
      body: body.trim(),
    };
    const journal = [entry, ...(config.journal ?? [])];
    return updateConfig(id, { journal });
  };

  const updateJournalEntry = async (
    id: string,
    entryId: string,
    body: string
  ): Promise<SavedAlignmentConfig | null> => {
    const config = configs.value.find((c) => c.id === id);
    if (!config) return null;
    const journal = (config.journal ?? []).map((e) => (e.id === entryId ? { ...e, body: body.trim() } : e));
    return updateConfig(id, { journal });
  };

  const deleteJournalEntry = async (id: string, entryId: string): Promise<SavedAlignmentConfig | null> => {
    const config = configs.value.find((c) => c.id === id);
    if (!config) return null;
    const journal = (config.journal ?? []).filter((e) => e.id !== entryId);
    return updateConfig(id, { journal });
  };

  return {
    configs,
    loading,
    fetchConfigs,
    saveConfig,
    updateConfig,
    deleteConfig,
    fetchPublicConfigs,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
  };
};
