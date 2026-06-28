import { optimizeImage, isHeicFile, formatFileSize, type OptimizeResult } from '~/utils/imageOptimizer';

// File upload configuration
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB in bytes (post-optimization limit)
const MAX_IMAGE_DIMENSION = 8000; // 8000px max width/height

/**
 * Validate file type for upload (size is checked post-optimization)
 */
const validateImageFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
  // Check MIME type (allow empty for HEIC which may not report type correctly)
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed. Only images (JPEG, PNG, WebP, HEIC) are accepted.`,
    };
  }

  // Check file extension
  const lastDotIndex = file.name.lastIndexOf('.');
  const fileExt = lastDotIndex > 0 ? file.name.slice(lastDotIndex + 1).toLowerCase() : '';
  if (!fileExt) {
    return {
      valid: false,
      error: `File has no extension. Only ${ALLOWED_EXTENSIONS.join(', ')} are accepted.`,
    };
  }
  if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
    return {
      valid: false,
      error: `File extension .${fileExt} is not allowed. Only ${ALLOWED_EXTENSIONS.join(', ')} are accepted.`,
    };
  }

  return { valid: true };
};

/**
 * Get image dimensions from file
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
};

export const useListingPhotos = () => {
  const supabase = useSupabase();
  const { user } = useAuth();

  /**
   * Prepare a file for upload by optimizing it
   * All images are optimized to WebP format regardless of size
   */
  const prepareFileForUpload = async (file: File, onProgress?: (progress: number) => void): Promise<OptimizeResult> => {
    // Validate file type before optimization
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Optimize the image (converts to WebP, resizes, compresses)
    return await optimizeImage(file, { onProgress });
  };

  /**
   * Upload a photo to storage and create a database record
   * Note: File should already be optimized via prepareFileForUpload before calling this
   */
  const uploadPhoto = async (
    file: File,
    listingId: string,
    category: 'body' | 'engine' | 'interior' | 'details',
    displayOrder: number = 0,
    caption?: string,
    isPrimary?: boolean
  ) => {
    if (!user.value) {
      throw new Error('User must be authenticated to upload photos');
    }

    // Generate unique file path
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `${user.value.id}/${listingId}/${category}/${fileName}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('listing-photos')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    // Determine if this photo should be primary
    // When isPrimary is explicitly passed (e.g. from uploadPhotos batch), use it directly
    // to avoid race conditions with concurrent uploads. Otherwise, check the database.
    let shouldBePrimary: boolean;
    if (isPrimary !== undefined) {
      shouldBePrimary = isPrimary;
    } else {
      const { count } = await supabase
        .from('listing_photos')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('is_primary', true);
      shouldBePrimary = !count || count === 0;
    }

    // Create database record
    const { data: photoData, error: dbError } = await supabase
      .from('listing_photos')
      .insert({
        listing_id: listingId,
        storage_path: storagePath,
        category,
        display_order: displayOrder,
        caption,
        is_primary: shouldBePrimary,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete the uploaded file
      await supabase.storage.from('listing-photos').remove([storagePath]);
      throw new Error(`Failed to save photo record: ${dbError.message}`);
    }

    return photoData;
  };

  /**
   * Upload multiple photos at once
   */
  const uploadPhotos = async (
    files: File[],
    listingId: string,
    category: 'body' | 'engine' | 'interior' | 'details',
    captions?: string[]
  ) => {
    // Check once before concurrent uploads to avoid race condition
    // where multiple uploads all see count=0 and set is_primary=true
    const { count } = await supabase
      .from('listing_photos')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('is_primary', true);
    const needsPrimary = !count || count === 0;

    const uploads = files.map((file, index) =>
      uploadPhoto(file, listingId, category, index, captions?.[index], needsPrimary && index === 0)
    );
    return await Promise.all(uploads);
  };

  /**
   * Delete a photo (from both storage and database)
   */
  const deletePhoto = async (photoId: string, storagePath: string) => {
    // Delete from database first
    const { error: dbError } = await supabase.from('listing_photos').delete().eq('id', photoId);

    if (dbError) {
      throw new Error(`Failed to delete photo record: ${dbError.message}`);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage.from('listing-photos').remove([storagePath]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
      // Don't throw - database record is already deleted
    }
  };

  /**
   * Get public URL for a photo
   */
  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('listing-photos').getPublicUrl(storagePath);

    return data.publicUrl;
  };

  /**
   * Get all photos for a listing
   */
  const getListingPhotos = async (listingId: string) => {
    const { data, error } = await supabase
      .from('listing_photos')
      .select('*')
      .eq('listing_id', listingId)
      .order('category')
      .order('display_order');

    if (error) {
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    return data;
  };

  /**
   * Get photos by category
   */
  const getPhotosByCategory = async (listingId: string, category: 'body' | 'engine' | 'interior' | 'details') => {
    const { data, error } = await supabase
      .from('listing_photos')
      .select('*')
      .eq('listing_id', listingId)
      .eq('category', category)
      .order('display_order');

    if (error) {
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    return data;
  };

  /**
   * Update photo order
   */
  const updatePhotoOrder = async (photoId: string, newOrder: number) => {
    const { error } = await supabase.from('listing_photos').update({ display_order: newOrder }).eq('id', photoId);

    if (error) {
      throw new Error(`Failed to update photo order: ${error.message}`);
    }
  };

  /**
   * Set primary photo
   */
  const setPrimaryPhoto = async (listingId: string, photoId: string) => {
    // First, unset all primary photos for this listing
    await supabase.from('listing_photos').update({ is_primary: false }).eq('listing_id', listingId);

    // Set the new primary photo
    const { error } = await supabase.from('listing_photos').update({ is_primary: true }).eq('id', photoId);

    if (error) {
      throw new Error(`Failed to set primary photo: ${error.message}`);
    }
  };

  /**
   * Update photo caption
   */
  const updatePhotoCaption = async (photoId: string, caption: string) => {
    const { error } = await supabase.from('listing_photos').update({ caption }).eq('id', photoId);

    if (error) {
      throw new Error(`Failed to update caption: ${error.message}`);
    }
  };

  return {
    prepareFileForUpload,
    uploadPhoto,
    uploadPhotos,
    deletePhoto,
    getPhotoUrl,
    getListingPhotos,
    getPhotosByCategory,
    updatePhotoOrder,
    setPrimaryPhoto,
    updatePhotoCaption,
    // Re-export utilities for convenience
    formatFileSize,
    isHeicFile,
  };
};
