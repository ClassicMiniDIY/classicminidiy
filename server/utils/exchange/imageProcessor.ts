import sharp from 'sharp';

/**
 * Instagram aspect ratio requirements:
 * - Minimum: 4:5 (0.8) - Portrait
 * - Maximum: 1.91:1 (1.91) - Landscape
 */
const INSTAGRAM_MIN_RATIO = 0.8; // 4:5 portrait
const INSTAGRAM_MAX_RATIO = 1.91; // 1.91:1 landscape

interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  aspectRatio: number;
  wasCropped: boolean;
  format: 'jpeg' | 'webp';
}

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Fetches an image from a URL and returns it as a buffer.
 * Includes timeout and size limits to avoid downloading huge files.
 */
export async function fetchImageBuffer(url: string, customHeaders?: Record<string, string>): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: customHeaders || {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers?.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large: ${contentLength} bytes`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large: ${arrayBuffer.byteLength} bytes`);
    }

    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Crops an image to fit within Instagram's aspect ratio requirements.
 * Uses center-crop strategy to maintain the most important part of the image.
 *
 * @param imageBuffer - The original image buffer
 * @returns Processed image with metadata
 */
export async function cropToInstagramRatio(imageBuffer: Buffer): Promise<ProcessedImage> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  const currentRatio = metadata.width / metadata.height;
  let newWidth = metadata.width;
  let newHeight = metadata.height;
  let wasCropped = false;

  if (currentRatio < INSTAGRAM_MIN_RATIO) {
    // Image is too tall (portrait) - crop height from center
    // Target ratio: 0.8 (4:5)
    newHeight = Math.floor(metadata.width / INSTAGRAM_MIN_RATIO);
    wasCropped = true;
    console.log(
      `[ImageProcessor] Image too tall (${currentRatio.toFixed(2)}), cropping height from ${metadata.height} to ${newHeight}`
    );
  } else if (currentRatio > INSTAGRAM_MAX_RATIO) {
    // Image is too wide (landscape/panoramic) - crop width from center
    // Target ratio: 1.91
    newWidth = Math.floor(metadata.height * INSTAGRAM_MAX_RATIO);
    wasCropped = true;
    console.log(
      `[ImageProcessor] Image too wide (${currentRatio.toFixed(2)}), cropping width from ${metadata.width} to ${newWidth}`
    );
  }

  let processedImage = image;

  if (wasCropped) {
    // Calculate crop position (center)
    const left = Math.floor((metadata.width - newWidth) / 2);
    const top = Math.floor((metadata.height - newHeight) / 2);

    processedImage = image.extract({
      left,
      top,
      width: newWidth,
      height: newHeight,
    });
  }

  // Convert to JPEG for maximum compatibility (Instagram prefers JPEG)
  // Use high quality to maintain image fidelity
  const outputBuffer = await processedImage.jpeg({ quality: 90, mozjpeg: true }).toBuffer();

  return {
    buffer: outputBuffer,
    width: newWidth,
    height: newHeight,
    aspectRatio: newWidth / newHeight,
    wasCropped,
    format: 'jpeg',
  };
}

/**
 * Processes an image URL for Instagram posting.
 * If the image needs cropping, uploads the cropped version to temporary storage.
 *
 * @param originalUrl - The original image URL
 * @param listingId - The listing ID (for temp file naming)
 * @param photoIndex - The photo index (for temp file naming)
 * @param supabaseClient - Supabase client for uploading
 * @returns The URL to use for Instagram posting (original or cropped)
 */
export async function prepareImageForInstagram(
  originalUrl: string,
  listingId: string,
  photoIndex: number,
  supabaseClient: any
): Promise<{ url: string; wasCropped: boolean }> {
  try {
    // Fetch the original image
    const imageBuffer = await fetchImageBuffer(originalUrl);

    // Check and crop if needed
    const processed = await cropToInstagramRatio(imageBuffer);

    if (!processed.wasCropped) {
      // Image is fine as-is, use original URL
      return { url: originalUrl, wasCropped: false };
    }

    // Upload cropped image to temporary storage
    const tempPath = `temp-social/${listingId}/${photoIndex}-instagram.jpg`;

    const { error: uploadError } = await supabaseClient.storage
      .from('listing-photos')
      .upload(tempPath, processed.buffer, {
        contentType: 'image/jpeg',
        upsert: true, // Overwrite if exists (for retries)
      });

    if (uploadError) {
      console.error('[ImageProcessor] Failed to upload cropped image:', uploadError);
      // Fall back to original URL and hope for the best
      return { url: originalUrl, wasCropped: false };
    }

    // Get public URL for the cropped image
    const config = useRuntimeConfig();
    const croppedUrl = `${config.public.supabaseUrl}/storage/v1/object/public/listing-photos/${tempPath}`;

    console.log(`[ImageProcessor] Uploaded cropped image to ${tempPath}`);

    return { url: croppedUrl, wasCropped: true };
  } catch (error) {
    console.error('[ImageProcessor] Error processing image:', error);
    // Fall back to original URL
    return { url: originalUrl, wasCropped: false };
  }
}

/**
 * Cleans up temporary Instagram images for a listing.
 * Should be called after successful posting or periodically.
 */
export async function cleanupTempImages(listingId: string, supabaseClient: any): Promise<void> {
  try {
    const { data: files } = await supabaseClient.storage.from('listing-photos').list(`temp-social/${listingId}`);

    if (files && files.length > 0) {
      const filePaths = files.map((f: { name: string }) => `temp-social/${listingId}/${f.name}`);
      await supabaseClient.storage.from('listing-photos').remove(filePaths);
      console.log(`[ImageProcessor] Cleaned up ${filePaths.length} temp files for listing ${listingId}`);
    }
  } catch (error) {
    // Non-critical, just log
    console.warn('[ImageProcessor] Failed to cleanup temp images:', error);
  }
}

/**
 * Bluesky image size limit: 976.56KB (1,000,000 bytes).
 * Compresses and resizes images to fit within this limit.
 */
const BLUESKY_MAX_BYTES = 1_000_000;

/**
 * Compresses an image to fit within Bluesky's size limit.
 * Progressively reduces quality and dimensions until the image fits.
 *
 * @param imageBuffer - The original image buffer
 * @returns Compressed JPEG buffer under the size limit
 */
export async function compressImageForBluesky(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  // If already under limit, just return as JPEG
  const asJpeg = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
  if (asJpeg.length <= BLUESKY_MAX_BYTES) {
    return asJpeg;
  }

  // Try reducing quality first (keep original dimensions)
  for (const quality of [80, 70, 60]) {
    const compressed = await sharp(imageBuffer).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (compressed.length <= BLUESKY_MAX_BYTES) {
      console.log(
        `[ImageProcessor] Bluesky: compressed to ${(compressed.length / 1024).toFixed(0)}KB at quality ${quality}`
      );
      return compressed;
    }
  }

  // If quality alone isn't enough, resize down and compress
  let scale = 0.75;
  while (scale >= 0.25) {
    const newWidth = Math.round(metadata.width * scale);
    const newHeight = Math.round(metadata.height * scale);
    const compressed = await sharp(imageBuffer)
      .resize(newWidth, newHeight, { fit: 'inside' })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();

    if (compressed.length <= BLUESKY_MAX_BYTES) {
      console.log(
        `[ImageProcessor] Bluesky: resized to ${newWidth}x${newHeight} (${(compressed.length / 1024).toFixed(0)}KB)`
      );
      return compressed;
    }
    scale -= 0.15;
  }

  // Last resort: aggressive resize
  const compressed = await sharp(imageBuffer)
    .resize(800, 800, { fit: 'inside' })
    .jpeg({ quality: 60, mozjpeg: true })
    .toBuffer();
  console.log(`[ImageProcessor] Bluesky: aggressively resized to 800px (${(compressed.length / 1024).toFixed(0)}KB)`);
  return compressed;
}

/**
 * Checks if an image URL meets Instagram's aspect ratio requirements without modifying it.
 * Useful for validation/preview purposes.
 */
export async function checkInstagramCompatibility(
  url: string
): Promise<{ compatible: boolean; aspectRatio: number; recommendation?: string }> {
  try {
    const imageBuffer = await fetchImageBuffer(url);
    const metadata = await sharp(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      return { compatible: false, aspectRatio: 0, recommendation: 'Unable to read image dimensions' };
    }

    const aspectRatio = metadata.width / metadata.height;

    if (aspectRatio < INSTAGRAM_MIN_RATIO) {
      return {
        compatible: false,
        aspectRatio,
        recommendation: `Image is too tall (${aspectRatio.toFixed(2)}). Will be cropped to 4:5 ratio.`,
      };
    }

    if (aspectRatio > INSTAGRAM_MAX_RATIO) {
      return {
        compatible: false,
        aspectRatio,
        recommendation: `Image is too wide (${aspectRatio.toFixed(2)}). Will be cropped to 1.91:1 ratio.`,
      };
    }

    return { compatible: true, aspectRatio };
  } catch (error) {
    return { compatible: false, aspectRatio: 0, recommendation: `Error checking image: ${error}` };
  }
}
