// Optimization configuration
const IMAGE_OPTIMIZE_DEFAULTS = {
  maxSizeMB: 3,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  initialQuality: 0.8,
  fileType: 'image/webp' as const,
  preserveExif: false,
};

export interface OptimizeResult {
  file: File;
  preview: string;
  originalSize: number;
  optimizedSize: number;
  wasOptimized: boolean;
}

export interface OptimizeOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Check if browser supports WebP
 */
const supportsWebP = (): boolean => {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
};

/**
 * Check if file is HEIC/HEIF format
 */
export const isHeicFile = (file: File): boolean => {
  const type = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif';
};

/**
 * Convert HEIC file to JPEG using heic2any (dynamically imported)
 */
const convertHeicToJpeg = async (file: File): Promise<File> => {
  // Browser-only: heic2any bundles a multi-MB libheif WASM blob. The
  // import.meta.client guard lets the SSR/server build dead-code-eliminate this
  // path so heic2any is never traced into the Vercel serverless function.
  if (!import.meta.client) throw new Error('convertHeicToJpeg is browser-only');
  try {
    const heic2any = await import('heic2any');
    const blob = await heic2any.default({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    // heic2any can return a single blob or array of blobs
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');

    return new File([resultBlob], newName, { type: 'image/jpeg' });
  } catch (error) {
    throw new Error('Failed to convert HEIC image. Please convert to JPEG or PNG before uploading.');
  }
};

/**
 * Create a preview URL from a file
 */
const createPreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to create preview'));
    reader.readAsDataURL(file);
  });
};

/**
 * Optimize an image file for upload
 * - Converts HEIC to JPEG first if needed
 * - Resizes to max dimensions
 * - Compresses to target quality
 * - Outputs WebP (or JPEG fallback)
 */
export const optimizeImage = async (file: File, opts: OptimizeOptions = {}): Promise<OptimizeResult> => {
  // Browser-only: uses canvas/FileReader/web-workers + dynamically imports
  // browser-image-compression (and heic2any via convertHeicToJpeg). The guard
  // keeps both out of the SSR/server build + the Vercel serverless function.
  if (!import.meta.client) throw new Error('optimizeImage is browser-only');
  const originalSize = file.size;
  let fileToProcess = file;

  // Convert HEIC to JPEG first
  if (isHeicFile(file)) {
    fileToProcess = await convertHeicToJpeg(file);
  }

  // Determine output format
  const outputType = supportsWebP() ? 'image/webp' : 'image/jpeg';
  const outputExt = supportsWebP() ? 'webp' : 'jpg';

  // Resolve effective max size once so the final-size check honors caller overrides
  const maxSizeMB = opts.maxSizeMB ?? IMAGE_OPTIMIZE_DEFAULTS.maxSizeMB;

  // Compression options
  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight: opts.maxWidthOrHeight ?? IMAGE_OPTIMIZE_DEFAULTS.maxWidthOrHeight,
    useWebWorker: IMAGE_OPTIMIZE_DEFAULTS.useWebWorker,
    initialQuality: opts.quality ?? IMAGE_OPTIMIZE_DEFAULTS.initialQuality,
    fileType: outputType,
    preserveExif: IMAGE_OPTIMIZE_DEFAULTS.preserveExif,
    onProgress: opts.onProgress,
  };

  try {
    // Dynamically import to keep it out of the initial bundle
    const { default: imageCompression } = await import('browser-image-compression');
    // Compress the image
    const compressedBlob = await imageCompression(fileToProcess, compressionOptions);

    // Create new filename with correct extension
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const newFileName = `${baseName}.${outputExt}`;

    // Convert blob to File
    const optimizedFile = new File([compressedBlob], newFileName, {
      type: outputType,
    });

    // Validate final size
    if (optimizedFile.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`Image could not be compressed below ${maxSizeMB}MB. Please use a smaller image.`);
    }

    // Create preview
    const preview = await createPreview(optimizedFile);

    return {
      file: optimizedFile,
      preview,
      originalSize,
      optimizedSize: optimizedFile.size,
      wasOptimized: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to optimize image. Please try a different file.');
  }
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
