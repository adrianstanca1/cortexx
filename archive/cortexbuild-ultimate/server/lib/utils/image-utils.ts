/**
 * Image Utilities for CortexBuild Ultimate
 * 
 * Provides reusable image processing functions for AI services.
 * Centralizes image handling to prevent duplication across services.
 */

/**
 * Supported image MIME types.
 */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | string;

/**
 * Result of parsing a data URL.
 */
export interface ParsedDataUrl {
  mimeType: ImageMimeType;
  base64Data: string;
}

/**
 * Parse a data URL into its components.
 * 
 * @param dataUrl - Data URL in format: data:image/jpeg;base64,/9j/4AAQ...
 * @returns Parsed data URL components
 * @throws Error if data URL format is invalid
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL format. Expected: data:<mimeType>;base64,<data>');
  }

  return {
    mimeType: matches[1] as ImageMimeType,
    base64Data: matches[2],
  };
}

/**
 * Extract base64 data from a data URL.
 * 
 * @param dataUrl - Data URL in format: data:image/jpeg;base64,/9j/4AAQ...
 * @returns Base64 encoded image data (without prefix)
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  // Handle both formats: with and without data URL prefix
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

/**
 * Create a data URL from base64 data and MIME type.
 * 
 * @param base64Data - Base64 encoded image data
 * @param mimeType - Image MIME type (default: image/jpeg)
 * @returns Data URL in format: data:image/jpeg;base64,/9j/4AAQ...
 */
export function createDataUrl(base64Data: string, mimeType: ImageMimeType = 'image/jpeg'): string {
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Validate image MIME type.
 * 
 * @param mimeType - MIME type to validate
 * @returns true if valid image MIME type
 */
export function isValidImageMimeType(mimeType: string): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return mimeType.startsWith('image/') || validTypes.includes(mimeType);
}

/**
 * Create inline data object for Gemini AI API.
 * 
 * @param dataUrl - Data URL or base64 image data
 * @param mimeType - Optional MIME type (auto-detected from data URL if not provided)
 * @returns Inline data object for Gemini API
 */
export function createGeminiInlineData(
  dataUrl: string,
  mimeType?: ImageMimeType
): { inlineData: { mimeType: ImageMimeType; data: string } } {
  let base64Data: string;
  let finalMimeType: ImageMimeType;

  // Check if it's a data URL
  if (dataUrl.includes('data:')) {
    const parsed = parseDataUrl(dataUrl);
    base64Data = parsed.base64Data;
    finalMimeType = mimeType || parsed.mimeType;
  } else {
    // Assume it's raw base64 data
    base64Data = dataUrl;
    finalMimeType = mimeType || 'image/jpeg';
  }

  return {
    inlineData: {
      mimeType: finalMimeType,
      data: base64Data,
    },
  };
}

/**
 * Create inline data object for Ollama API.
 * 
 * @param dataUrl - Data URL or base64 image data
 * @returns Base64 image data (Ollama expects raw base64)
 */
export function createOllamaImageData(dataUrl: string): string {
  return extractBase64FromDataUrl(dataUrl);
}

/**
 * Process multiple images for batch AI processing.
 * 
 * @param imageData Array of data URLs or base64 image data
 * @param mimeType Optional MIME type for all images
 * @returns Array of inline data objects for Gemini API
 */
export function processMultipleImages(
  imageData: string[],
  mimeType?: ImageMimeType
): Array<{ inlineData: { mimeType: ImageMimeType; data: string } }> {
  return imageData.map(data => createGeminiInlineData(data, mimeType));
}

/**
 * Estimate base64 image size in bytes.
 * 
 * @param base64Data - Base64 encoded image data
 * @returns Estimated size in bytes
 */
export function estimateBase64Size(base64Data: string): number {
  // Base64 encoding adds ~33% overhead
  // Each 4 base64 characters = 3 bytes
  const paddingCount = (base64Data.match(/=/g) || []).length;
  const cleanLength = base64Data.replace(/=/g, '').length;
  return Math.max(0, Math.floor((base64Data.length * 3) / 4) - paddingCount);
}

/**
 * Check if image data exceeds size limit.
 * 
 * @param base64Data - Base64 encoded image data
 * @param maxBytes - Maximum size in bytes (default: 10MB)
 * @returns true if image exceeds limit
 */
export function exceedsSizeLimit(base64Data: string, maxBytes: number = 10 * 1024 * 1024): boolean {
  return estimateBase64Size(base64Data) > maxBytes;
}
