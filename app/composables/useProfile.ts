export interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  username: string | null;
  social_links: Record<string, string>;
  show_vehicles: boolean;
  is_sustaining_member: boolean;
  created_at: string | null;
}

export interface Vehicle {
  id: string;
  name: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
}

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const useProfile = () => {
  const supabase = useSupabase();
  const { user } = useAuth();
  const { capture } = usePostHog();

  /**
   * Fetch the authenticated user's full profile
   */
  const fetchProfile = async () => {
    if (!user.value) throw new Error('Not authenticated');

    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.value.id).single();

    if (error) throw error;
    return data;
  };

  /**
   * Update the authenticated user's profile
   */
  const updateProfile = async (updates: {
    display_name?: string | null;
    bio?: string | null;
    location?: string | null;
    avatar_url?: string | null;
    username?: string | null;
    is_public?: boolean;
    show_vehicles?: boolean;
    social_links?: Record<string, string>;
  }) => {
    if (!user.value) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.value.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  /**
   * Upload avatar to Supabase storage
   */
  const uploadAvatar = async (file: File): Promise<string> => {
    if (!user.value) throw new Error('Not authenticated');

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File too large. Maximum size is 5MB.');
    }

    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${user.value.id}/avatar/${fileName}`;

    // Delete old avatar (best-effort)
    try {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.value.id)
        .maybeSingle();

      if (currentProfile?.avatar_url) {
        const url = new URL(currentProfile.avatar_url);
        const pathParts = url.pathname.split('/');
        const avatarsIndex = pathParts.indexOf('avatars');
        if (avatarsIndex !== -1 && avatarsIndex < pathParts.length - 1) {
          const oldPath = pathParts.slice(avatarsIndex + 1).join('/');
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }
    } catch {
      // Continue even if old avatar cleanup fails
    }

    const { error: uploadError } = await supabase.storage.from('avatars').upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);

    capture('avatar_uploaded', {
      file_size_kb: Math.round(file.size / 1024),
    });

    return urlData.publicUrl;
  };

  /**
   * Check if a username is available via RPC
   */
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    if (!USERNAME_REGEX.test(username)) return false;

    const { data, error } = await supabase.rpc('is_username_available', { p_username: username });

    if (error) throw error;
    return !!data;
  };

  /**
   * Get a public profile by UUID or username
   */
  const getPublicProfile = async (identifier: string): Promise<PublicProfile | null> => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const rpcName = isUuid ? 'get_public_profile_by_id' : 'get_public_profile_by_username';
    const param = isUuid ? { p_user_id: identifier } : { p_username: identifier };

    const { data, error } = await supabase.rpc(rpcName, param).single();

    if (error) return null;
    return data as PublicProfile;
  };

  /**
   * Get vehicles for a public profile
   */
  const getPublicProfileVehicles = async (userId: string): Promise<Vehicle[]> => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, name, year, make, model, color')
      .eq('user_id', userId)
      .order('year', { ascending: false });

    if (error) return [];
    return data as Vehicle[];
  };

  return {
    fetchProfile,
    updateProfile,
    uploadAvatar,
    checkUsernameAvailability,
    getPublicProfile,
    getPublicProfileVehicles,
  };
};
